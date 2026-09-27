// AniList を「シーズン作品リスト源」、TMDb を「表示データ源」として橋渡しするヘルパ
//
// TMDb は2期エピソードが1期に統合されているなどシーズン管理に不備があるため、
// AniList から正確な季別タイトル一覧を取得し、各タイトルを TMDb 名前検索で解決して
// TMDb 側の作品データ（poster/backdrop/score/詳細リンク）を返す。
//
// TMDb に該当が無い作品は捨てずに AniList のデータのまま返す。実測で
// 1 シーズンあたり 20〜40 件がここに落ちており、その大半はショート・特別編・
// 劇場版といった TMDb が TV 作品として持たないもの。
//
// 使用箇所:
//   - /browse/season/[year]/[season]
//   - /browse/airing
//   - ホーム「現クール TOP10」

import {
  getAniListAnimeAiringInRange,
  getAniListSeasonAnime,
  toAniListSeason,
  type AniListMedia,
  type AniListMediaPage,
} from "@/lib/anilist";
import { getAnimeBySeason, searchAnime, searchMovie } from "@/lib/tmdb";
import { getSeasonDateRange, type SeasonSlug } from "@/lib/seasons";
import { stripSeasonSuffix } from "@/lib/title-strip";
import { matchTitles } from "@/lib/title-match";
import type { TMDbAnime, TMDbMovie } from "@/types/tmdb";

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────

/** AniList の 1 ページあたり取得件数（API 上限が 50） */
const ANILIST_PAGE_SIZE = 50;

/**
 * AniList を辿る最大ページ数。
 * 1 シーズンは 140 件前後（2026 SUMMER は 138 件）なので 4 ページ取る。
 * 上限を設けるのは、AniList 側の想定外の応答で無限にページを辿らないため。
 */
const MAX_ANILIST_PAGES = 4;

/**
 * 既定の取得上限。
 *
 * かつて 100 にしていたため、2026 SUMMER では 138 件中 38 件が
 * 照合すら試されずに捨てられていた。1 シーズン分を取り切れる値にする。
 */
const DEFAULT_LIMIT = 200;

/**
 * 「話数未定」の作品を長寿作品とみなす基準（対象年から遡る年数）。
 *
 * ONE PIECE / 名探偵コナン / サザエさん のような終わりの無い作品は、
 * 人気順の上位を占有して当季の新作を押し出してしまう。
 * 実データでこの条件が該当 9 件を正確に落とすことを確認している。
 */
const LONG_RUNNER_START_YEARS_AGO = 1;

/** TMDb 検索結果のキャッシュ秒数。AniList 由来の固定語彙なので長く持てる */
const TITLE_SEARCH_CACHE_SECONDS = 86400;

// ──────────────────────────────────────────
// 公開 API
// ──────────────────────────────────────────

/**
 * 一覧に並べる 1 件。
 *
 * TMDb に無い作品（`unlisted`）は詳細ページを持たないため、
 * 呼び出し側はリンクを張らずに描画すること。
 */
export type SeasonalEntry =
  | { kind: "tv"; anime: TMDbAnime }
  | { kind: "movie"; movie: TMDbMovie }
  | { kind: "unlisted"; media: AniListMedia };

export interface SeasonalAnimeOptions {
  /** 最終的に返す作品数の上限 (default: 200) */
  limit?: number;
  /** TMDb 名前検索の並列度 (default: 6) */
  concurrency?: number;
  /** AniList 失敗時に TMDb の discover フォールバックを使うか (default: true) */
  fallbackToTmdbDiscover?: boolean;
}

export interface SeasonalAnimeResult {
  /** 人気順。画面の描画にはこれを使う */
  entries: SeasonalEntry[];
  /**
   * TMDb の TV 作品のみ。TMDb id が要る用途（ホームの列・声優集約）向けに
   * 従来どおりの形で残してある
   */
  items: TMDbAnime[];
  /** 取得経路 */
  source: "anilist+tmdb" | "tmdb-fallback" | "empty";
  /** AniList から取れたタイトル総数（参考） */
  anilistTotal: number;
  /** TMDb に該当が無かったタイトル（= entries の unlisted。観測用） */
  unmatchedTitles: string[];
}

/**
 * 指定シーズンの作品を AniList ベースで取得し、TMDb の作品データで返す。
 *
 * 流れ:
 *   1. AniList を **2 系統** で引き、和集合を取る
 *      - シーズンクエリ: その季に開始した作品
 *      - 期間クエリ: 放送期間がその季と重なる作品（前クールからの継続を拾う）
 *   2. 同季の TMDb プールも並列で取得（一次マッチ用）
 *   3. 常時放送の長寿作品を落とし、人気順に並べる
 *   4. 各作品を TMDb と突き合わせる。**形式で行き先を分ける**
 *      - MOVIE → `/search/movie`
 *      - それ以外 → TMDb プール → `/search/tv`
 *      - どちらにも無ければ AniList のデータのまま返す
 *
 * **2 系統で引く理由**: シーズンクエリだけだと 2 クール作品が前の季に属したまま
 * 当季のリストから消える（転生したらスライムだった件 第4期 は 2026 SPRING 所属）。
 * 逆に期間クエリだけだと、終了日が未定の作品が AniList 側の絞り込みから外れ、
 * これから始まる季のページがほぼ空になる（2026 FALL は 67 件中 6 件しか返らない）。
 *
 * AniList が両系統とも失敗した場合は fallbackToTmdbDiscover=true なら TMDb discover に倒す。
 */
export async function fetchSeasonalAnime(
  year: number,
  season: SeasonSlug,
  options: SeasonalAnimeOptions = {},
): Promise<SeasonalAnimeResult> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const concurrency = options.concurrency ?? 6;
  const fallbackToTmdbDiscover = options.fallbackToTmdbDiscover ?? true;

  const { from, to } = getSeasonDateRange(year, season);
  const { start, end } = seasonBoundsToFuzzyInts(from, to);

  // 1 & 2. AniList（2 系統）と TMDb プールを並列取得
  const [seasonPages, rangePages, tmdbP1, tmdbP2] = await Promise.allSettled([
    collectAniListPages((page) =>
      getAniListSeasonAnime(
        year,
        toAniListSeason(season),
        page,
        ANILIST_PAGE_SIZE,
      ),
    ),
    collectAniListPages((page) =>
      getAniListAnimeAiringInRange(start, end, page, ANILIST_PAGE_SIZE),
    ),
    // TMDb プールはマッチ用に 6h キャッシュ
    getAnimeBySeason(from, to, 1, 21600),
    getAnimeBySeason(from, to, 2, 21600),
  ]);

  // 和集合（AniList の id で重複排除）
  const merged = new Map<number, AniListMedia>();
  for (const settled of [seasonPages, rangePages]) {
    if (settled.status !== "fulfilled") continue;
    for (const m of settled.value) {
      if (!merged.has(m.id)) merged.set(m.id, m);
    }
  }
  const anilistTotal = merged.size;

  const tmdbPool = dedupeById([
    ...(tmdbP1.status === "fulfilled" ? tmdbP1.value.results : []),
    ...(tmdbP2.status === "fulfilled" ? tmdbP2.value.results : []),
  ]);

  // AniList が両系統とも失敗 → フォールバック判定
  if (anilistTotal === 0) {
    if (fallbackToTmdbDiscover && tmdbPool.length > 0) {
      const items = tmdbPool.slice(0, limit);
      return {
        entries: items.map((anime) => ({ kind: "tv", anime })),
        items,
        source: "tmdb-fallback",
        anilistTotal: 0,
        unmatchedTitles: [],
      };
    }
    return {
      entries: [],
      items: [],
      source: "empty",
      anilistTotal: 0,
      unmatchedTitles: [],
    };
  }

  // 3. 長寿作品を落として人気順に並べる
  const candidates = Array.from(merged.values())
    .filter((m) => !isPerpetualLongRunner(m, year))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);

  // 4. 各作品を TMDb と突き合わせる
  const resolved = await pMapLimit(candidates, concurrency, (media) =>
    resolveMedia(media, tmdbPool),
  );

  // 重複排除（同じ TMDb 作品に複数の AniList 作品がマッチしたら人気の高い方を優先）
  const seenTv = new Set<number>();
  const seenMovie = new Set<number>();
  const entries: SeasonalEntry[] = [];
  const unmatchedTitles: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const media = candidates[i];
    const hit = resolved[i];

    if (hit === null) {
      unmatchedTitles.push(pickDisplayTitle(media));
      entries.push({ kind: "unlisted", media });
      continue;
    }
    if (hit.kind === "tv") {
      if (seenTv.has(hit.anime.id)) continue;
      seenTv.add(hit.anime.id);
      entries.push(hit);
      continue;
    }
    if (seenMovie.has(hit.movie.id)) continue;
    seenMovie.add(hit.movie.id);
    entries.push(hit);
  }

  return {
    entries,
    items: entries
      .filter((e): e is { kind: "tv"; anime: TMDbAnime } => e.kind === "tv")
      .map((e) => e.anime),
    source: "anilist+tmdb",
    anilistTotal,
    unmatchedTitles,
  };
}

/**
 * AniList の FuzzyDate を `YYYYMMDD` の整数に変換する。
 * 月日が欠けている場合は 1 で埋め、大小比較できる値にする。
 */
export function toFuzzyDateInt(date: {
  year: number | null;
  month: number | null;
  day: number | null;
}): number | null {
  if (date.year === null) return null;
  return date.year * 10000 + (date.month ?? 1) * 100 + (date.day ?? 1);
}

/**
 * シーズンの開始・終了日（`YYYY-MM-DD`）を、期間クエリに渡す FuzzyDateInt にする。
 *
 * AniList の `startDate_lesser` / `endDate_greater` は排他的な比較なので、
 * 前後に 1 だけ広げないと「初日に始まる作品」「最終日に終わる作品」が落ちる。
 */
export function seasonBoundsToFuzzyInts(
  from: string,
  to: string,
): { start: number; end: number } {
  return {
    start: dateStringToInt(from) - 1,
    end: dateStringToInt(to) + 1,
  };
}

/**
 * 終わりの無い長寿作品か。
 *
 * 「話数が未定」かつ「開始が対象年より十分前」の両方を満たすものだけを落とす。
 * **開始年が不明な作品は落とさない**。分類できないものを切ると、放送開始日が
 * AniList に入っていないだけの新作（例: ジャンケットバンク）を巻き込む。
 */
export function isPerpetualLongRunner(
  media: AniListMedia,
  targetYear: number,
): boolean {
  if (media.episodes !== null) return false;
  const startYear = media.startDate.year;
  if (startYear === null) return false;
  return startYear < targetYear - LONG_RUNNER_START_YEARS_AGO;
}

// ──────────────────────────────────────────
// 内部: TMDb との突き合わせ
// ──────────────────────────────────────────

type ResolvedEntry =
  { kind: "tv"; anime: TMDbAnime } | { kind: "movie"; movie: TMDbMovie };

/** AniList 側の照合候補となるタイトル群 */
function candidateTitles(media: AniListMedia): string[] {
  return [
    media.title.native,
    media.title.romaji,
    media.title.english,
    ...(media.synonyms ?? []),
  ].filter((s): s is string => !!s);
}

/** 検索に投げるクエリ。原題と、サフィックスを剥がした版 */
function searchQueries(media: AniListMedia): string[] {
  const primary =
    media.title.native ?? media.title.romaji ?? media.title.english;
  if (!primary) return [];
  const stripped = stripSeasonSuffix(primary);
  return stripped && stripped !== primary ? [primary, stripped] : [primary];
}

/**
 * 候補の中から最も確からしいものを選ぶ。
 * 完全一致があればそれを、無ければ最初の前方一致を返す。
 */
function pickBest<T>(
  items: T[],
  namesOf: (item: T) => string[],
  titles: string[],
): T | null {
  let prefixHit: T | null = null;

  for (const item of items) {
    for (const name of namesOf(item)) {
      const kind = matchTitles(titles, name);
      if (kind === "exact") return item;
      if (kind === "prefix" && prefixHit === null) prefixHit = item;
    }
  }
  return prefixHit;
}

const tvNames = (a: TMDbAnime): string[] =>
  [a.name, a.original_name].filter((s): s is string => !!s);

const movieNames = (m: TMDbMovie): string[] =>
  [m.title, m.original_title].filter((s): s is string => !!s);

/**
 * 1 作品を TMDb へ解決する。**形式で行き先を分ける**。
 *
 * 劇場版を TV 検索に投げても当たらないし、TV 作品を映画検索に投げても当たらない。
 * 振り分けることで TMDb への問い合わせ回数も半分になる。
 */
async function resolveMedia(
  media: AniListMedia,
  tmdbPool: TMDbAnime[],
): Promise<ResolvedEntry | null> {
  return media.format === "MOVIE"
    ? resolveAsMovie(media)
    : resolveAsTv(media, tmdbPool);
}

async function resolveAsTv(
  media: AniListMedia,
  tmdbPool: TMDbAnime[],
): Promise<ResolvedEntry | null> {
  const titles = candidateTitles(media);
  if (titles.length === 0) return null;

  // 同季の discover プールに居れば問い合わせ不要
  const fromPool = pickBest(tmdbPool, tvNames, titles);
  if (fromPool) return { kind: "tv", anime: fromPool };

  for (const query of searchQueries(media)) {
    try {
      const sr = await searchAnime(query, TITLE_SEARCH_CACHE_SECONDS);
      const hit = pickBest(sr.results, tvNames, titles);
      if (hit) return { kind: "tv", anime: hit };
    } catch {
      // 個別の失敗は次のクエリへ
    }
  }
  return null;
}

async function resolveAsMovie(
  media: AniListMedia,
): Promise<ResolvedEntry | null> {
  const titles = candidateTitles(media);
  if (titles.length === 0) return null;

  for (const query of searchQueries(media)) {
    try {
      const sr = await searchMovie(query, TITLE_SEARCH_CACHE_SECONDS);
      const hit = pickBest(sr.results, movieNames, titles);
      if (hit) return { kind: "movie", movie: hit };
    } catch {
      // 個別の失敗は次のクエリへ
    }
  }
  return null;
}

// ──────────────────────────────────────────
// 内部ヘルパ
// ──────────────────────────────────────────

/** `YYYY-MM-DD` → `YYYYMMDD` の整数 */
function dateStringToInt(date: string): number {
  return Number(date.replace(/-/g, ""));
}

/** id で重複排除（先着優先） */
function dedupeById(items: TMDbAnime[]): TMDbAnime[] {
  const map = new Map<number, TMDbAnime>();
  for (const item of items) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values());
}

/**
 * 次ページが無くなるまで AniList を辿る（最大 MAX_ANILIST_PAGES ページ）。
 * 1 ページで打ち切るとその季の後半が丸ごと落ちるため、必ず辿り切ること。
 */
async function collectAniListPages(
  fetchPage: (page: number) => Promise<AniListMediaPage>,
): Promise<AniListMedia[]> {
  const acc: AniListMedia[] = [];
  for (let page = 1; page <= MAX_ANILIST_PAGES; page++) {
    const result = await fetchPage(page);
    acc.push(...result.results);
    if (!result.hasNextPage) break;
  }
  return acc;
}

/** 同時実行数を制限する並列 mapper（レートリミット対策） */
async function pMapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i]);
    }
  }
  const concurrent = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: concurrent }, () => run()));
  return results;
}

/** 一覧の key。TMDb の TV と映画は id 空間が別なので接頭辞で分ける */
export function entryKey(entry: SeasonalEntry): string {
  if (entry.kind === "tv") return `tv-${entry.anime.id}`;
  if (entry.kind === "movie") return `movie-${entry.movie.id}`;
  return `anilist-${entry.media.id}`;
}

/** 表示・観測用のタイトル（日本語優先） */
export function pickDisplayTitle(media: AniListMedia): string {
  return (
    media.title.native ??
    media.title.romaji ??
    media.title.english ??
    `(anilist:${media.id})`
  );
}
