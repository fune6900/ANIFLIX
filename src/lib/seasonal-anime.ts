// AniList を「シーズン作品リスト源」、TMDb を「表示データ源」として橋渡しするヘルパ
//
// TMDb は2期エピソードが1期に統合されているなどシーズン管理に不備があるため、
// AniList から正確な季別タイトル一覧を取得し、各タイトルを TMDb 名前検索で解決して
// TMDb 側の作品データ（poster/backdrop/score/詳細リンク）を返す。
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
import { getAnimeBySeason, searchAnime } from "@/lib/tmdb";
import { getSeasonDateRange, type SeasonSlug } from "@/lib/seasons";
import { stripSeasonSuffix } from "@/lib/title-strip";
import type { TMDbAnime } from "@/types/tmdb";

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────

/** AniList の 1 ページあたり取得件数（API 上限が 50） */
const ANILIST_PAGE_SIZE = 50;

/**
 * AniList を辿る最大ページ数。
 * 1 シーズンは 120 件前後（2026 SUMMER は 119 件）なので 3 ページで足りる。
 * 上限を設けるのは、AniList 側の想定外の応答で無限にページを辿らないため。
 */
const MAX_ANILIST_PAGES = 3;

/**
 * 「話数未定」の作品を長寿作品とみなす基準（対象年から遡る年数）。
 *
 * ONE PIECE / 名探偵コナン / サザエさん のような終わりの無い作品は、
 * 人気順の上位を占有して当季の新作を押し出してしまう。
 * 実データでこの条件が該当 9 件を正確に落とすことを確認している。
 */
const LONG_RUNNER_START_YEARS_AGO = 1;

// ──────────────────────────────────────────
// 公開 API
// ──────────────────────────────────────────

export interface SeasonalAnimeOptions {
  /** 最終的に返す作品数の上限 (default: 100) */
  limit?: number;
  /** TMDb 名前検索の並列度 (default: 4) */
  concurrency?: number;
  /** AniList 失敗時に TMDb の discover フォールバックを使うか (default: true) */
  fallbackToTmdbDiscover?: boolean;
}

export interface SeasonalAnimeResult {
  /** TMDb の作品データ（マッチした分のみ）。AniList の人気順を維持 */
  items: TMDbAnime[];
  /** 取得経路 */
  source: "anilist+tmdb" | "tmdb-fallback" | "empty";
  /** AniList から取れたタイトル総数（参考） */
  anilistTotal: number;
  /** TMDb マッチに失敗したタイトル（観測用） */
  unmatchedTitles: string[];
}

/**
 * 指定シーズンの作品を AniList ベースで取得し、TMDb の作品データで返す。
 *
 * 流れ:
 *   1. AniList を **2 系統** で引き、和集合を取る
 *      - シーズンクエリ: その季に開始した作品
 *      - 期間クエリ: 放送期間がその季と重なる作品（前クールからの継続を拾う）
 *   2. 同季の TMDb プールも並列で取得（Step A 一次マッチ用）
 *   3. 常時放送の長寿作品を落とし、人気順に並べる
 *   4. 各 AniList 作品を TMDb と突き合わせ:
 *      A. TMDb プール内で title 完全一致を探す
 *      B. ヒット無ければ /search/tv で名前検索 → 結果を検証して採用
 *      C. それでも不一致は表示しない
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
  const limit = options.limit ?? 100;
  const concurrency = options.concurrency ?? 4;
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
      return {
        items: tmdbPool.slice(0, limit),
        source: "tmdb-fallback",
        anilistTotal: 0,
        unmatchedTitles: [],
      };
    }
    return {
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

  // 4. 各 AniList 作品を TMDb と突き合わせ
  const resolved = await pMapLimit(
    candidates,
    concurrency,
    async (media): Promise<{ anime: TMDbAnime | null; title: string }> => {
      const title = pickDisplayTitle(media);
      const anime = await matchAniListToTmdb(media, tmdbPool);
      return { anime, title };
    },
  );

  // 重複排除（同じ TMDb id に複数 AniList 作品がマッチした場合は人気の高い方を優先）
  const dedupedMap = new Map<number, TMDbAnime>();
  const unmatchedTitles: string[] = [];
  for (const { anime, title } of resolved) {
    if (anime) {
      if (!dedupedMap.has(anime.id)) {
        dedupedMap.set(anime.id, anime);
      }
    } else {
      unmatchedTitles.push(title);
    }
  }

  return {
    items: Array.from(dedupedMap.values()),
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

/** タイトル比較用の正規化: 大文字/全角/記号/空白の差異を吸収する */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s　:：!！?？・,、。.「」『』()（）\-－–—~〜～]/g, "")
    .normalize("NFKC");
}

/** 比較用キー: フル正規化 + サフィックス剥がし正規化のセットを返す（AniList 候補側で使用） */
function buildCompareKeys(title: string): { full: string; stripped: string } {
  const full = normalizeTitle(title);
  const stripped = normalizeTitle(stripSeasonSuffix(title));
  return { full, stripped };
}

function pickDisplayTitle(media: AniListMedia): string {
  return (
    media.title.native ??
    media.title.romaji ??
    media.title.english ??
    `(anilist:${media.id})`
  );
}

/**
 * AniList の作品を TMDb の作品に紐付けて返す。
 *
 * TMDb は新クール作品を独立したエントリではなく本体作品の Season N として登録する
 * ため（例: 「転スラ第4期」のエピソードが「転生したらスライムだった件」(id 82684) の
 * Season 4 に入る）、AniList のシーズン番号サフィックスを剥がしてから比較する。
 *
 * 比較は非対称: AniList 側のみ「フル + サフィックス剥がし」両方をキー化し、
 * TMDb 側は **フル正規化のみ** で照合する。これは AniList「進撃の巨人」(親) ×
 * TMDb プール「進撃の巨人 Final Season」が同居した場合に、TMDb 側も strip して
 * しまうと AniList 親が TMDb 続編エントリに誤マッチするため。
 *
 * Step A: TMDb プール内で完全一致（TMDb はフルのみ・AniList はフル / 剥がし両方）
 * Step B: TMDb /search/tv をフル / サフィックス剥がしクエリ両方で検索し、結果を再検証
 * 不一致なら null
 */
async function matchAniListToTmdb(
  media: AniListMedia,
  tmdbPool: TMDbAnime[],
): Promise<TMDbAnime | null> {
  const candidates = [
    media.title.native,
    media.title.romaji,
    media.title.english,
    ...(media.synonyms ?? []),
  ].filter((s): s is string => !!s);

  // 候補タイトル全てに対してフル正規化キー + サフィックス剥がしキーを集約
  // （Set なのでフル == 剥がしの場合は自動で重複排除される）
  const candidateKeys = new Set<string>();
  for (const c of candidates) {
    const { full, stripped } = buildCompareKeys(c);
    candidateKeys.add(full);
    if (stripped) candidateKeys.add(stripped);
  }

  // TMDb 側はフル正規化のみで照合（非対称比較で逆方向誤マッチを防ぐ）
  const matchesCandidate = (tmdbName: string): boolean => {
    return candidateKeys.has(normalizeTitle(tmdbName));
  };

  // Step A: ローカルプールと突き合わせ
  const direct = tmdbPool.find((a) => {
    const tmdbNames = [a.name, a.original_name].filter((s): s is string => !!s);
    return tmdbNames.some(matchesCandidate);
  });
  if (direct) return direct;

  // Step B: TMDb 名前検索
  // primary そのまま検索 → ヒット無ければサフィックス剥がし版で再検索。
  // 例: 「転スラ第4期」では原文ゼロヒットなので「転スラ」にして本体作品(82684)を取りに行く
  const primary =
    media.title.native ?? media.title.romaji ?? media.title.english;
  if (!primary) return null;

  const stripped = stripSeasonSuffix(primary);
  const queries =
    stripped && stripped !== primary ? [primary, stripped] : [primary];

  for (const query of queries) {
    try {
      // ヘルパ経由は 24h キャッシュ
      const sr = await searchAnime(query, 86400);
      const verified = sr.results.find((r) => {
        const names = [r.name, r.original_name].filter((s): s is string => !!s);
        return names.some(matchesCandidate);
      });
      if (verified) return verified;
    } catch {
      // 個別失敗は次のクエリへ
    }
  }
  return null;
}
