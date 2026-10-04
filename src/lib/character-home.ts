// キャラクターページ（/characters）の行を組み立てる
//
// トップ画面・声優ページと同じ「Hero + 横スクロールの行」の構成（#104）。
// 行は「すべて見る」の専用ページ（/characters/collections/[slug]）と同じ定義を使い、
// どちらも全件を出す（行で切り詰めない）。キャラはすべて AniList の Character id を持つので
// キャラ詳細（/characters/[id]）へ直接飛べる。
//
// AniList の分間制限（公称 90 回/分。2026-10-04 時点の応答ヘッダーは 30 回/分）に収めるため、
// 取得元は 1 描画につき 1 回だけ引き（`createCharacterSources` がメモ化する）、複数の行で使い回す。
// 冷えたキャッシュでの 1 描画あたりの AniList 問い合わせは
//   今期の作品一覧（fetchSeasonalAnime: 最大 8。トップ画面・声優ページとキャッシュ共有）
//   + 今期のキャスト 1 + 前クールのキャスト 1 + シリーズ 5（ここまで声優ページとキャッシュ共有）
//   + お気に入り数 1 + 誕生日 1 + 最新アニメ映画 1 + トレンド 1 + 年代 1（3 年代を 1 回にまとめる）
//   = 最大 20 回。今期の作品一覧が温まっていれば 12 回、声優ページも温まっていれば 5 回。

import {
  getAniListBirthdayCharacters,
  getAniListDecadeCast,
  getAniListLatestMovieCast,
  getAniListPopularCharacters,
  getAniListTrendingCast,
} from "@/lib/anilist";
import { ANIME_ERAS } from "@/lib/eras";
import {
  ANIME_FRANCHISES,
  matchesFranchiseTitle,
  type AnimeFranchise,
} from "@/lib/franchises";
import {
  FEATURED_HERO_SIZE,
  FEATURED_WORK_COUNT,
  aniListImage,
  castEdgesOf,
  castWorkTitle,
  createSharedCastSources,
  franchiseRowSlug,
  isHeroReady,
  isMainRole,
  loadCollectionRow,
  once,
  safeRow as safeFeaturedRow,
  workRowSlug,
  type SharedCastSources,
} from "@/lib/featured-rows";
import { matchTitles } from "@/lib/title-match";
import type {
  AniListCastEdge,
  AniListCastMedia,
  AniListFeaturedCharacter,
  AniListFeaturedCharacterMedia,
} from "@/types/anilist";
import type { CharacterCard, CharacterRow } from "@/types/character-home";
import type { TMDbAnime } from "@/types/tmdb";

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────

/** 「年代別名作のキャラ」の年代（ISSUE #104: 90 年代 / 00 年代 / 10 年代） */
export const CLASSIC_DECADES: readonly number[] = [1990, 2000, 2010];

/** 「前クールの人気キャラ」: AniList のお気に入り数がこの数以上 */
const POPULAR_MIN_FAVOURITES = 100;

/** 「最新アニメ映画のキャラ」: キャラの付いた新しい映画を何本使うか */
const LATEST_MOVIE_COUNT = 10;

/** Hero に添える主要キャラの人数 */
const HERO_CHARACTER_COUNT = 3;

const COLLECTION_BASE = "/characters/collections";

const ERA_SLUG_PREFIX = "era-";

const LOG_TAG = "character-home";

// ──────────────────────────────────────────
// URL
// ──────────────────────────────────────────

/** 「すべて見る」の専用ページ */
export function characterCollectionHref(slug: string): string {
  return `${COLLECTION_BASE}/${slug}`;
}

function eraRowSlug(decade: number): string {
  return `${ERA_SLUG_PREFIX}${decade}`;
}

// ──────────────────────────────────────────
// 取得元（1 描画につき 1 回だけ引く）
// ──────────────────────────────────────────

/** 声優ページと共有する取得元（`src/lib/featured-rows.ts`）+ キャラだけの取得元 */
interface CharacterSources extends SharedCastSources {
  /** お気に入り数順のキャラ（漫画だけ・海外作品のキャラも混ざる） */
  popularCharacters(): Promise<AniListFeaturedCharacter[]>;
  /** 今日が誕生日のキャラ */
  birthdayCharacters(): Promise<AniListFeaturedCharacter[]>;
  /** 公開日の新しいアニメ映画（キャラ未登録の作品も混ざる） */
  latestMovies(): Promise<AniListCastMedia[]>;
  trendingWorks(): Promise<AniListCastMedia[]>;
  /** 年代 → 人気作品。3 年代を 1 回の問い合わせで引く */
  decadeWorks(): Promise<Map<number, AniListCastMedia[]>>;
}

function createCharacterSources(): CharacterSources {
  const shared = createSharedCastSources();
  return {
    ...shared,
    popularCharacters: once(() => getAniListPopularCharacters(1)),
    birthdayCharacters: once(() =>
      getAniListBirthdayCharacters(shared.today.key),
    ),
    latestMovies: once(() => getAniListLatestMovieCast(shared.today.key)),
    trendingWorks: once(() => getAniListTrendingCast()),
    decadeWorks: once(() => getAniListDecadeCast(CLASSIC_DECADES)),
  };
}

// ──────────────────────────────────────────
// カード
// ──────────────────────────────────────────

function characterName(node: {
  id: number;
  name: { full: string | null; native: string | null };
}): string {
  return node.name.native ?? node.name.full ?? `(id:${node.id})`;
}

function edgeCard(edge: AniListCastEdge, note?: string): CharacterCard {
  return {
    id: edge.node.id,
    name: characterName(edge.node),
    imageUrl: aniListImage(edge.node.image.large),
    href: `/characters/${edge.node.id}`,
    note,
  };
}

function cvNote(edge: AniListCastEdge): string | undefined {
  const va = edge.voiceActors[0];
  if (!va) return undefined;
  return `CV: ${va.name.native ?? va.name.full ?? `(id:${va.id})`}`;
}

interface CastEntry {
  edge: AniListCastEdge;
  media: AniListCastMedia;
}

/** 作品群のキャラを出てきた順に、キャラの重複なく */
function castEntries(
  works: AniListCastMedia[],
  keep: (edge: AniListCastEdge) => boolean = () => true,
): CastEntry[] {
  const seen = new Set<number>();
  const entries: CastEntry[] = [];
  for (const media of works) {
    for (const edge of castEdgesOf(media)) {
      if (!keep(edge) || seen.has(edge.node.id)) continue;
      seen.add(edge.node.id);
      entries.push({ edge, media });
    }
  }
  return entries;
}

/** お気に入り数の多い順（同数は出てきた順） */
function byFavourites(entries: CastEntry[]): CastEntry[] {
  return [...entries].sort(
    (a, b) => (b.edge.node.favourites ?? 0) - (a.edge.node.favourites ?? 0),
  );
}

/** カードの一言は作品名 */
function workCards(entries: CastEntry[]): CharacterCard[] {
  return entries.map(({ edge, media }) => edgeCard(edge, castWorkTitle(media)));
}

function hasCharacters(media: AniListCastMedia): boolean {
  return castEdgesOf(media).length > 0;
}

/** 日本のアニメに出ているキャラの代表作（漫画だけ・海外作品のキャラは null） */
function japaneseAnimeOf(
  character: AniListFeaturedCharacter,
): AniListFeaturedCharacterMedia | null {
  const work = character.media?.nodes[0] ?? null;
  return work && work.countryOfOrigin === "JP" ? work : null;
}

function featuredCharacterCard(
  character: AniListFeaturedCharacter,
  note: string,
): CharacterCard {
  return {
    id: character.id,
    name: characterName(character),
    imageUrl: aniListImage(character.image.large),
    href: `/characters/${character.id}`,
    note,
  };
}

// ──────────────────────────────────────────
// 行
// ──────────────────────────────────────────

/** 取得に失敗した行は空にする（1 行の失敗でページ全体を落とさない） */
function safeRow(
  slug: string,
  title: string,
  load: () => Promise<CharacterRow>,
): Promise<CharacterRow> {
  return safeFeaturedRow(LOG_TAG, slug, title, load);
}

const AIRING_TITLE = "🎬 今期放送中アニメのキャラ";
const LEADS_TITLE = "⭐ 今期の主人公";
const RANKING_TITLE = "🏆 人気キャラランキング";
const BIRTHDAY_TITLE = "🎂 今日が誕生日のキャラ";
const LATEST_MOVIES_TITLE = "🎞️ 最新アニメ映画のキャラ";
const TRENDING_TITLE = "📈 今週トレンド作品のキャラ";

function previousSeasonTitle(src: CharacterSources): string {
  return `🔁 ${src.previousSeason.label}の人気キャラ`;
}

function franchiseTitle(franchise: AnimeFranchise): string {
  return `${franchise.emoji} ${franchise.name}シリーズのキャラ`;
}

function eraTitle(decade: number): string {
  const era = ANIME_ERAS.find((e) => e.decade === decade);
  return `${era?.emoji ?? "📼"} ${era?.shortLabel ?? `${decade}年代`}の名作キャラ`;
}

/** 今期放送中アニメのキャラ: 今期の人気作品の全キャラをお気に入り数順に */
function loadAiringRow(src: CharacterSources): Promise<CharacterRow> {
  return safeRow("airing", AIRING_TITLE, async () => ({
    slug: "airing",
    title: AIRING_TITLE,
    cards: workCards(byFavourites(castEntries(await src.currentSeasonCast()))),
  }));
}

/** 今期の主人公: 今期の人気作品の MAIN キャラを作品の人気順に */
function loadLeadsRow(src: CharacterSources): Promise<CharacterRow> {
  return safeRow("leads", LEADS_TITLE, async () => ({
    slug: "leads",
    title: LEADS_TITLE,
    cards: workCards(castEntries(await src.currentSeasonCast(), isMainRole)),
  }));
}

/**
 * 今期人気作品の特集: キャラの付いた人気上位の作品 1 本ずつ。各行は作品の全キャラと声優。
 * 今期のキャストが取れなければ特集の行そのものを出さない
 */
async function loadFeaturedWorkRows(
  src: CharacterSources,
): Promise<CharacterRow[]> {
  try {
    const works = (await src.currentSeasonCast())
      .filter(hasCharacters)
      .slice(0, FEATURED_WORK_COUNT);
    return works.map((media) => ({
      slug: workRowSlug(media.id),
      title: `📺 『${castWorkTitle(media)}』のキャラクター`,
      cards: castEntries([media]).map(({ edge }) =>
        edgeCard(edge, cvNote(edge)),
      ),
    }));
  } catch (error) {
    console.error(`[${LOG_TAG}] featured work rows failed:`, error);
    return [];
  }
}

/** 定番シリーズ特集: シリーズの全作品を通したキャラ。出演作品数の多い順 */
function loadFranchiseRow(
  src: CharacterSources,
  franchise: AnimeFranchise,
): Promise<CharacterRow> {
  const slug = franchiseRowSlug(franchise);
  const title = franchiseTitle(franchise);
  return safeRow(slug, title, async () => {
    const works = (await src.franchiseCast(franchise)).filter((m) =>
      matchesFranchiseTitle(franchise, m.title),
    );
    const keep = franchise.mainOnly ? isMainRole : () => true;
    const tallies = new Map<number, { entry: CastEntry; works: Set<number> }>();
    for (const media of works) {
      for (const edge of castEdgesOf(media)) {
        if (!keep(edge)) continue;
        const prev = tallies.get(edge.node.id);
        if (prev) prev.works.add(media.id);
        else
          tallies.set(edge.node.id, {
            entry: { edge, media },
            works: new Set([media.id]),
          });
      }
    }
    // Map は挿入順を保つので、同数の中は出てきた順（作品の人気順・役どころ順）
    const cards = [...tallies.values()]
      .sort((a, b) => b.works.size - a.works.size)
      .map(({ entry, works: n }) =>
        edgeCard(
          entry.edge,
          n.size > 1 ? `${n.size}作品` : castWorkTitle(entry.media),
        ),
      );
    return { slug, title, cards };
  });
}

/** 人気キャラランキング: AniList のお気に入り数順（日本のアニメのキャラだけ） */
function loadRankingRow(src: CharacterSources): Promise<CharacterRow> {
  return safeRow("ranking", RANKING_TITLE, async () => {
    const ranked = (await src.popularCharacters()).flatMap((c) => {
      const work = japaneseAnimeOf(c);
      return work ? [{ c, work }] : [];
    });
    return {
      slug: "ranking",
      title: RANKING_TITLE,
      cards: ranked.map(({ c, work }, i) =>
        featuredCharacterCard(c, `${i + 1}位 · ${castWorkTitle(work)}`),
      ),
    };
  });
}

/**
 * 今日が誕生日のキャラ。
 *
 * 「今日」は AniList のサーバー側の日付で決まり、日本の日付とずれる時間帯がありうる。
 * 返ってきた誕生日が日本の今日と違えば、見出しに実際の日付を出す（嘘の「今日」を書かない）
 */
function loadBirthdayRow(src: CharacterSources): Promise<CharacterRow> {
  return safeRow("birthdays", BIRTHDAY_TITLE, async () => {
    const characters = (await src.birthdayCharacters()).flatMap((c) => {
      const work = japaneseAnimeOf(c);
      return work ? [{ c, work }] : [];
    });
    const first = characters.find(
      ({ c }) => c.dateOfBirth.month !== null && c.dateOfBirth.day !== null,
    );
    if (!first) return { slug: "birthdays", title: BIRTHDAY_TITLE, cards: [] };

    const { month, day } = first.c.dateOfBirth;
    const isToday = month === src.today.month && day === src.today.day;
    const title = isToday
      ? BIRTHDAY_TITLE
      : `🎂 ${month}月${day}日が誕生日のキャラ`;
    const cards = characters
      .filter(
        ({ c }) => c.dateOfBirth.month === month && c.dateOfBirth.day === day,
      )
      .map(({ c, work }) => featuredCharacterCard(c, castWorkTitle(work)));
    return { slug: "birthdays", title, cards };
  });
}

/** 前クールの人気キャラ: 前クールの人気作品のキャラのうち、お気に入り数 100 以上 */
function loadPreviousSeasonRow(src: CharacterSources): Promise<CharacterRow> {
  const title = previousSeasonTitle(src);
  return safeRow("previous-season", title, async () => {
    const entries = byFavourites(
      castEntries(await src.previousSeasonCast()),
    ).filter(
      ({ edge }) => (edge.node.favourites ?? 0) >= POPULAR_MIN_FAVOURITES,
    );
    return { slug: "previous-season", title, cards: workCards(entries) };
  });
}

/** 最新アニメ映画のキャラ: キャラの付いた新しい映画 10 本のキャラを、公開日の新しい順に */
function loadLatestMoviesRow(src: CharacterSources): Promise<CharacterRow> {
  return safeRow("latest-movies", LATEST_MOVIES_TITLE, async () => {
    const movies = (await src.latestMovies())
      .filter(hasCharacters)
      .slice(0, LATEST_MOVIE_COUNT);
    return {
      slug: "latest-movies",
      title: LATEST_MOVIES_TITLE,
      cards: workCards(castEntries(movies)),
    };
  });
}

/** 今週トレンド作品のキャラ: AniList のトレンド順の作品のキャラ */
function loadTrendingRow(src: CharacterSources): Promise<CharacterRow> {
  return safeRow("trending", TRENDING_TITLE, async () => ({
    slug: "trending",
    title: TRENDING_TITLE,
    cards: workCards(castEntries(await src.trendingWorks())),
  }));
}

/** その年代に始まった作品か（AniList 側でも絞っているが、境界をここでも守る） */
function startedInDecade(media: AniListCastMedia, decade: number): boolean {
  const year = media.startDate.year;
  return year !== null && year >= decade && year < decade + 10;
}

/** 作品名に開始年を添える。タイトルに年が入っていれば重ねない（「HUNTER×HUNTER (2011)」） */
function workWithYear(media: AniListCastMedia): string {
  const title = castWorkTitle(media);
  const year = media.startDate.year;
  return year === null || title.includes(String(year))
    ? title
    : `${title} (${year})`;
}

/** 年代別名作のキャラ: 年代の人気作品の MAIN キャラをお気に入り数順に */
function loadEraRow(
  src: CharacterSources,
  decade: number,
): Promise<CharacterRow> {
  const slug = eraRowSlug(decade);
  const title = eraTitle(decade);
  return safeRow(slug, title, async () => {
    const works = ((await src.decadeWorks()).get(decade) ?? []).filter((m) =>
      startedInDecade(m, decade),
    );
    const cards = byFavourites(castEntries(works, isMainRole)).map(
      ({ edge, media }) => edgeCard(edge, workWithYear(media)),
    );
    return { slug, title, cards };
  });
}

/** 作品・シリーズ以外の行（slug → 組み立て）。専用ページの slug のホワイトリストを兼ねる */
const STATIC_ROWS = new Map<
  string,
  (src: CharacterSources) => Promise<CharacterRow>
>([
  ["airing", loadAiringRow],
  ["leads", loadLeadsRow],
  ["ranking", loadRankingRow],
  ["birthdays", loadBirthdayRow],
  ["previous-season", loadPreviousSeasonRow],
  ["latest-movies", loadLatestMoviesRow],
  ["trending", loadTrendingRow],
  ...CLASSIC_DECADES.map(
    (decade): [string, (src: CharacterSources) => Promise<CharacterRow>] => [
      eraRowSlug(decade),
      (src) => loadEraRow(src, decade),
    ],
  ),
]);

// ──────────────────────────────────────────
// Hero
// ──────────────────────────────────────────

export interface CharacterHeroItem {
  anime: TMDbAnime;
  /** 主要キャラ（AniList の同じ作品の MAIN キャラ）。見つからなければ空 */
  mainCharacters: string[];
}

/**
 * TMDb の作品に対応する AniList の作品の主要キャラ。
 * TMDb の役名は英語表記（"Maomao (voice)"）なので使わず、AniList の日本語名を使う
 */
function mainCharactersOf(
  anime: TMDbAnime,
  works: AniListCastMedia[],
): string[] {
  const media = works.find((m) => {
    const titles = [m.title.native, m.title.romaji, m.title.english].filter(
      (t): t is string => t !== null,
    );
    return (
      matchTitles(titles, anime.name) !== null ||
      matchTitles(titles, anime.original_name) !== null
    );
  });
  if (!media) return [];
  return castEdgesOf(media)
    .filter(isMainRole)
    .slice(0, HERO_CHARACTER_COUNT)
    .map((e) => characterName(e.node));
}

/** Hero: 今期の人気作品のキービジュアルと主要キャラ */
async function loadHero(src: CharacterSources): Promise<CharacterHeroItem[]> {
  try {
    const [anime, current, previous] = await Promise.all([
      src.seasonalAnime(),
      // キャストが取れなくても Hero は出す（主要キャラを添えないだけ）
      src.currentSeasonCast().catch(() => []),
      // 今期の作品一覧は前クールから続く 2 クール作品も含む（BLEACH など）。
      // 今期のキャストは今期に始まった作品だけなので、前クールのキャストからも探す
      src.previousSeasonCast().catch(() => []),
    ]);
    const works = [...current, ...previous];
    return anime
      .filter(isHeroReady)
      .slice(0, FEATURED_HERO_SIZE)
      .map((a) => ({ anime: a, mainCharacters: mainCharactersOf(a, works) }));
  } catch (error) {
    console.error(`[${LOG_TAG}] hero failed:`, error);
    return [];
  }
}

// ──────────────────────────────────────────
// 公開 API
// ──────────────────────────────────────────

export interface CharacterHome {
  hero: CharacterHeroItem[];
  /** 表示順。空の行も含む（描画側で隠す） */
  rows: CharacterRow[];
}

/**
 * キャラクターページの全行を並列に取る。各行は失敗しても空になり、ページは落ちない。
 * 順序は ISSUE #104 の受け入れ条件の並び
 */
export async function loadCharacterHome(): Promise<CharacterHome> {
  const src = createCharacterSources();

  const [
    hero,
    airing,
    leads,
    works,
    franchises,
    ranking,
    birthdays,
    previous,
    latestMovies,
    trending,
    eras,
  ] = await Promise.all([
    loadHero(src),
    loadAiringRow(src),
    loadLeadsRow(src),
    loadFeaturedWorkRows(src),
    Promise.all(ANIME_FRANCHISES.map((f) => loadFranchiseRow(src, f))),
    loadRankingRow(src),
    loadBirthdayRow(src),
    loadPreviousSeasonRow(src),
    loadLatestMoviesRow(src),
    loadTrendingRow(src),
    Promise.all(CLASSIC_DECADES.map((d) => loadEraRow(src, d))),
  ]);

  return {
    hero,
    rows: [
      airing,
      leads,
      ...works,
      ...franchises,
      ranking,
      birthdays,
      previous,
      latestMovies,
      trending,
      ...eras,
    ],
  };
}

/**
 * 「すべて見る」の専用ページの 1 行。定義に無い slug は null（ページ側で 404）。
 * 照合の規則は `loadCollectionRow`（`src/lib/featured-rows.ts`）を参照
 */
export function loadCharacterCollection(
  slug: string,
): Promise<CharacterRow | null> {
  return loadCollectionRow(slug, {
    createSources: createCharacterSources,
    staticRows: STATIC_ROWS,
    loadFranchiseRow,
    loadFeaturedWorkRows,
  });
}
