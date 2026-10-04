// 声優ページ（/voice-actors）の行を組み立てる
//
// トップ画面・アニメ映画画面と同じ「Hero + 横スクロールの行」の構成（#102）。
// 行は「すべて見る」の専用ページ（/voice-actors/collections/[slug]）と同じ定義を使い、
// どちらも全件を出す（行で切り詰めない）。
//
// 取得元は 2 系統:
//   - TMDb: 今期作品・最新アニメ映画の credits（TMDb の人物 id を持つので詳細へ直接飛べる）
//   - AniList: シーズン・シリーズのキャスト、お気に入り数、誕生日、活動開始年
//     （TMDb の人物 id を持たないので `/voice-actors/resolve?name=` 経由で飛ぶ）
//
// AniList の分間制限（公称 90 回/分。2026-10-04 時点の応答ヘッダーは 30 回/分）に収めるため、
// 取得元は 1 描画につき 1 回だけ引き（`createVoiceActorSources` がメモ化する）、
// 複数の行で使い回す。冷えたキャッシュでの 1 描画あたりの AniList 問い合わせは
//   今期の作品一覧（fetchSeasonalAnime: 最大 8。トップ画面とキャッシュ共有）
//   + 今期のキャスト 1 + 前クールのキャスト 1 + シリーズ 5 + お気に入り数 1 + 誕生日 1
//   = 最大 17 回（今期の作品一覧が温まっていれば 9 回）。
// 今期の作品一覧・今期 / 前クールのキャスト・シリーズのキャストはキャラクターページ（#104）と
// 同じ問い合わせなので Data Cache を共有する（`src/lib/featured-rows.ts`）。

import { getAniListBirthdayStaff, getAniListPopularStaff } from "@/lib/anilist";
import { getAnimeCredits, getImageUrl, getLatestAnimeMovies } from "@/lib/tmdb";
import {
  aggregateMovieCast,
  aggregateSeasonalCast,
  type AggregatedCast,
} from "@/lib/seasonal-cast";
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
import type {
  AniListCastEdge,
  AniListCastMedia,
  AniListStaff,
} from "@/types/anilist";
import type { TMDbAnime, TMDbMovie } from "@/types/tmdb";
import type { VoiceActorCard, VoiceActorRow } from "@/types/voice-actor-home";

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────

/** 「今期放送中アニメの声優」で credits を集約する作品数（旧 /voice-actors と同じ） */
const AIRING_WORK_COUNT = 30;

/** 「最新アニメ映画の声優」で credits を集約する作品数 */
const LATEST_MOVIE_COUNT = 10;

/** Hero に添える主演声優の人数（TMDb の出演順の先頭から） */
const HERO_LEAD_COUNT = 3;

/** 「新世代」: 活動開始が直近この年数以内（今年を含む） */
const NEW_GENERATION_YEARS = 10;

/** 「レジェンド」: 活動開始がこの年以前 */
const LEGEND_LAST_DEBUT_YEAR = 1990;

/** 「前クールに活躍」: 前クールの人気作品のうち、この本数以上に出演 */
const ACTIVE_MIN_WORKS = 2;

const COLLECTION_BASE = "/voice-actors/collections";

const LOG_TAG = "voice-actor-home";

// ──────────────────────────────────────────
// URL
// ──────────────────────────────────────────

/** 「すべて見る」の専用ページ */
export function voiceActorCollectionHref(slug: string): string {
  return `${COLLECTION_BASE}/${slug}`;
}

/** AniList の声優は TMDb の id を持たないので、名前で TMDb の人物へ解決する */
function resolveHref(name: string): string {
  return `/voice-actors/resolve?name=${encodeURIComponent(name)}`;
}

// ──────────────────────────────────────────
// 取得元（1 描画につき 1 回だけ引く）
// ──────────────────────────────────────────

/** キャラクターページと共有する取得元（`src/lib/featured-rows.ts`）+ 声優だけの取得元 */
interface VoiceActorSources extends SharedCastSources {
  /** お気に入り数順の Staff（声優以外も混ざる） */
  popularStaff(): Promise<AniListStaff[]>;
  /** 今日が誕生日の Staff（声優以外も混ざる） */
  birthdayStaff(): Promise<AniListStaff[]>;
  latestMovies(): Promise<TMDbMovie[]>;
}

/**
 * 行が共有する取得元を作る。各取得元は呼ばれた時に初めて引き、以降は同じ結果を返す。
 * 専用ページでは、その行が使う取得元だけが引かれる
 */
function createVoiceActorSources(): VoiceActorSources {
  const shared = createSharedCastSources();
  return {
    ...shared,
    // 1 ページ（50 人、うち声優は 30 人前後）だけ。AniList の分間制限のため 2 ページ目は引かない
    popularStaff: once(() => getAniListPopularStaff(1)),
    birthdayStaff: once(() => getAniListBirthdayStaff(shared.today.key)),
    latestMovies: once(async () => {
      const page = await getLatestAnimeMovies(1);
      // 公開直後の作品はポスター（＝ credits）が未登録のことが多い
      return page.results.filter((m) => m.poster_path);
    }),
  };
}

// ──────────────────────────────────────────
// カード
// ──────────────────────────────────────────

/** 日本語の声優か（AniList の Staff は漫画家・監督・海外の声優も混ざる） */
function isJapaneseVoiceActorStaff(staff: AniListStaff): boolean {
  return (
    staff.languageV2 === "Japanese" &&
    staff.primaryOccupations.some((o) => /voice act/i.test(o))
  );
}

function staffName(staff: AniListStaff): string {
  return staff.name.native ?? staff.name.full ?? `(id:${staff.id})`;
}

function staffImage(staff: AniListStaff): string | null {
  return aniListImage(staff.image.large);
}

function staffCard(staff: AniListStaff, note?: string): VoiceActorCard {
  const name = staffName(staff);
  return {
    id: staff.id,
    name,
    imageUrl: staffImage(staff),
    href: resolveHref(name),
    note,
  };
}

/** TMDb の役名の末尾に付く「 (voice)」（声の出演の印）を落とす */
function tmdbRoleName(character: string): string {
  return character.replace(/\s*\(voice\)\s*$/i, "").trim();
}

function tmdbCastCard(cast: AggregatedCast): VoiceActorCard {
  const character = tmdbRoleName(cast.topCharacter);
  const role = character ? `役: ${character}` : undefined;
  const note =
    cast.appearances > 1
      ? [`${cast.appearances}作品`, role].filter(Boolean).join(" · ")
      : role;
  return {
    id: cast.id,
    name: cast.name,
    imageUrl: cast.profilePath ? getImageUrl(cast.profilePath, "w342") : null,
    href: `/voice-actors/${cast.id}`,
    note,
  };
}

function characterName(edge: AniListCastEdge): string {
  return edge.node.name.native ?? edge.node.name.full ?? "";
}

function roleNote(edge: AniListCastEdge): string | undefined {
  const name = characterName(edge);
  return name ? `役: ${name}` : undefined;
}

const edgesOf = castEdgesOf;

/** 作品群のキャストを出てきた順に、声優の重複なくカードにする */
function castCards(
  works: AniListCastMedia[],
  keep: (edge: AniListCastEdge) => boolean = () => true,
): VoiceActorCard[] {
  const seen = new Set<number>();
  const cards: VoiceActorCard[] = [];
  for (const media of works) {
    for (const edge of edgesOf(media)) {
      if (!keep(edge)) continue;
      for (const va of edge.voiceActors) {
        if (seen.has(va.id)) continue;
        seen.add(va.id);
        cards.push(staffCard(va, roleNote(edge)));
      }
    }
  }
  return cards;
}

interface WorkTally {
  staff: AniListStaff;
  works: Set<number>;
  /** 最初に出てきた役（作品は人気順・キャラは MAIN が先なので主役寄り） */
  firstEdge: AniListCastEdge;
  firstSeen: number;
}

/** 声優ごとに出演作品数を数える。並びは 作品数 desc → 最初に出てきた順 */
function tallyWorks(
  works: AniListCastMedia[],
  keep: (edge: AniListCastEdge) => boolean = () => true,
): WorkTally[] {
  const map = new Map<number, WorkTally>();
  for (const media of works) {
    for (const edge of edgesOf(media)) {
      if (!keep(edge)) continue;
      for (const va of edge.voiceActors) {
        const prev = map.get(va.id);
        if (prev) {
          prev.works.add(media.id);
        } else {
          map.set(va.id, {
            staff: va,
            works: new Set([media.id]),
            firstEdge: edge,
            firstSeen: map.size,
          });
        }
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => b.works.size - a.works.size || a.firstSeen - b.firstSeen,
  );
}

const isMain = isMainRole;

/** キャストの付いた作品（放送前でキャスト未発表の作品を飛ばす） */
function hasCast(media: AniListCastMedia): boolean {
  return edgesOf(media).some((e) => e.voiceActors.length > 0);
}

// ──────────────────────────────────────────
// 行
// ──────────────────────────────────────────

/** 取得に失敗した行は空にする（1 行の失敗でページ全体を落とさない） */
function safeRow(
  slug: string,
  title: string,
  load: () => Promise<VoiceActorRow>,
): Promise<VoiceActorRow> {
  return safeFeaturedRow(LOG_TAG, slug, title, load);
}

const AIRING_TITLE = "🎙️ 今期放送中アニメの声優";
const LEADS_TITLE = "⭐ 今期の主演声優";
const RANKING_TITLE = "🏆 人気声優ランキング";
const BIRTHDAY_TITLE = "🎂 今日が誕生日の声優";
const LATEST_MOVIES_TITLE = "🎬 最新アニメ映画の声優";
const NEW_GENERATION_TITLE = "🌱 新世代の声優";
const LEGENDS_TITLE = "👑 レジェンド声優";

function previousSeasonTitle(src: VoiceActorSources): string {
  return `🔁 ${src.previousSeason.label}に活躍した声優`;
}

function franchiseTitle(franchise: AnimeFranchise): string {
  return `${franchise.emoji} ${franchise.name}シリーズの声優`;
}

/** 今期放送中アニメの声優: 今期の人気作品の credits を出演本数順に（TMDb） */
function loadAiringRow(src: VoiceActorSources): Promise<VoiceActorRow> {
  return safeRow("airing", AIRING_TITLE, async () => {
    const anime = await src.seasonalAnime();
    const casts = await aggregateSeasonalCast(
      anime.slice(0, AIRING_WORK_COUNT).map((a) => a.id),
    );
    return {
      slug: "airing",
      title: AIRING_TITLE,
      cards: casts.map(tmdbCastCard),
    };
  });
}

/** 今期の主演声優: 今期の人気作品の MAIN キャラの声優を作品の人気順に */
function loadLeadsRow(src: VoiceActorSources): Promise<VoiceActorRow> {
  return safeRow("leads", LEADS_TITLE, async () => ({
    slug: "leads",
    title: LEADS_TITLE,
    cards: castCards(await src.currentSeasonCast(), isMain),
  }));
}

/**
 * 今期人気作品の特集: キャストの付いた人気上位の作品 1 本ずつ。
 * 今期のキャストが取れなければ特集の行そのものを出さない
 */
async function loadFeaturedWorkRows(
  src: VoiceActorSources,
): Promise<VoiceActorRow[]> {
  try {
    const works = (await src.currentSeasonCast())
      .filter(hasCast)
      .slice(0, FEATURED_WORK_COUNT);
    return works.map((media) => ({
      slug: workRowSlug(media.id),
      title: `📺 『${castWorkTitle(media)}』の声優`,
      cards: castCards([media]),
    }));
  } catch (error) {
    console.error(`[${LOG_TAG}] featured work rows failed:`, error);
    return [];
  }
}

/** 定番シリーズ特集: シリーズの全作品を通した声優。出演作品数の多い順 */
function loadFranchiseRow(
  src: VoiceActorSources,
  franchise: AnimeFranchise,
): Promise<VoiceActorRow> {
  const slug = franchiseRowSlug(franchise);
  const title = franchiseTitle(franchise);
  return safeRow(slug, title, async () => {
    const works = (await src.franchiseCast(franchise)).filter((m) =>
      matchesFranchiseTitle(franchise, m.title),
    );
    const tallies = tallyWorks(works, franchise.mainOnly ? isMain : undefined);
    const cards = tallies.map((t) => {
      const role = roleNote(t.firstEdge);
      const note =
        t.works.size > 1
          ? [`${t.works.size}作品`, role].filter(Boolean).join(" · ")
          : role;
      return staffCard(t.staff, note);
    });
    return { slug, title, cards };
  });
}

/** 人気声優ランキング: AniList のお気に入り数順（日本語の声優だけ） */
function loadRankingRow(src: VoiceActorSources): Promise<VoiceActorRow> {
  return safeRow("ranking", RANKING_TITLE, async () => {
    const voiceActors = dedupeStaff(
      (await src.popularStaff()).filter(isJapaneseVoiceActorStaff),
    );
    return {
      slug: "ranking",
      title: RANKING_TITLE,
      cards: voiceActors.map((s, i) => staffCard(s, `${i + 1}位`)),
    };
  });
}

/**
 * 今日が誕生日の声優。
 *
 * 「今日」は AniList のサーバー側の日付で決まり、日本の日付とずれる時間帯がありうる。
 * 返ってきた誕生日が日本の今日と違えば、見出しに実際の日付を出す（嘘の「今日」を書かない）
 */
function loadBirthdayRow(src: VoiceActorSources): Promise<VoiceActorRow> {
  return safeRow("birthdays", BIRTHDAY_TITLE, async () => {
    const voiceActors = (await src.birthdayStaff()).filter(
      isJapaneseVoiceActorStaff,
    );
    const first = voiceActors.find(
      (s) => s.dateOfBirth.month !== null && s.dateOfBirth.day !== null,
    );
    if (!first) return { slug: "birthdays", title: BIRTHDAY_TITLE, cards: [] };

    const { month, day } = first.dateOfBirth;
    const isToday = month === src.today.month && day === src.today.day;
    const title = isToday
      ? BIRTHDAY_TITLE
      : `🎂 ${month}月${day}日が誕生日の声優`;
    const cards = dedupeStaff(
      voiceActors.filter(
        (s) => s.dateOfBirth.month === month && s.dateOfBirth.day === day,
      ),
    ).map((s) => {
      const born = s.dateOfBirth.year;
      return staffCard(
        s,
        born !== null ? `${src.today.year - born}歳` : undefined,
      );
    });
    return { slug: "birthdays", title, cards };
  });
}

/** 前クールに活躍した声優: 前クールの人気作品のうち複数本に出た声優 */
function loadPreviousSeasonRow(src: VoiceActorSources): Promise<VoiceActorRow> {
  const title = previousSeasonTitle(src);
  return safeRow("previous-season", title, async () => {
    const tallies = tallyWorks(await src.previousSeasonCast()).filter(
      (t) => t.works.size >= ACTIVE_MIN_WORKS,
    );
    return {
      slug: "previous-season",
      title,
      cards: tallies.map((t) => staffCard(t.staff, `${t.works.size}作品`)),
    };
  });
}

/** 最新アニメ映画の声優: 公開日の新しい映画の credits を集約（TMDb） */
function loadLatestMoviesRow(src: VoiceActorSources): Promise<VoiceActorRow> {
  return safeRow("latest-movies", LATEST_MOVIES_TITLE, async () => {
    const movies = (await src.latestMovies()).slice(0, LATEST_MOVIE_COUNT);
    const casts = await aggregateMovieCast(movies.map((m) => m.id));
    return {
      slug: "latest-movies",
      title: LATEST_MOVIES_TITLE,
      cards: casts.map(tmdbCastCard),
    };
  });
}

function dedupeStaff(staff: AniListStaff[]): AniListStaff[] {
  const seen = new Set<number>();
  return staff.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

function debutYear(staff: AniListStaff): number | null {
  return staff.yearsActive[0] ?? null;
}

/**
 * 活動開始年で絞る行の母集団。
 *
 * AniList の Staff は活動開始年で絞れず、お気に入り数の上位だけだと新世代・レジェンドが
 * 数人しか残らない（上位 200 人で新世代 5 人・レジェンド 8 人。2026-10-04 実測）。
 * 母集団の主体は今期・前クールのキャスト（各 300〜500 人）で、お気に入り数の上位
 * （1 ページ・ランキングと共用）は人気の声優を取りこぼさないための補い
 */
async function loadDebutPool(src: VoiceActorSources): Promise<AniListStaff[]> {
  const [popular, current, previous] = await Promise.allSettled([
    src.popularStaff(),
    src.currentSeasonCast(),
    src.previousSeasonCast(),
  ]);
  if (
    popular.status === "rejected" &&
    current.status === "rejected" &&
    previous.status === "rejected"
  ) {
    throw new Error("no source for debut rows");
  }
  const castOf = (r: PromiseSettledResult<AniListCastMedia[]>) =>
    r.status === "fulfilled"
      ? r.value.flatMap((m) => edgesOf(m).flatMap((e) => e.voiceActors))
      : [];
  const pool = dedupeStaff([
    // キャストの声優は日本語の声優として引いているので職業では絞らない
    ...(popular.status === "fulfilled"
      ? popular.value.filter(isJapaneseVoiceActorStaff)
      : []),
    ...castOf(current),
    ...castOf(previous),
  ]);
  return pool.sort(
    (a, b) => (b.favourites ?? 0) - (a.favourites ?? 0) || a.id - b.id,
  );
}

function loadDebutRow(
  src: VoiceActorSources,
  slug: string,
  title: string,
  keep: (debut: number) => boolean,
): Promise<VoiceActorRow> {
  return safeRow(slug, title, async () => {
    const cards = (await loadDebutPool(src)).flatMap((s) => {
      const debut = debutYear(s);
      return debut !== null && keep(debut)
        ? [staffCard(s, `${debut}年〜`)]
        : [];
    });
    return { slug, title, cards };
  });
}

/** 新世代の声優: 活動開始が直近 10 年 */
function loadNewGenerationRow(src: VoiceActorSources): Promise<VoiceActorRow> {
  return loadDebutRow(
    src,
    "new-generation",
    NEW_GENERATION_TITLE,
    (debut) => debut > src.today.year - NEW_GENERATION_YEARS,
  );
}

/** レジェンド声優: 活動開始が 1990 年以前 */
function loadLegendsRow(src: VoiceActorSources): Promise<VoiceActorRow> {
  return loadDebutRow(
    src,
    "legends",
    LEGENDS_TITLE,
    (debut) => debut <= LEGEND_LAST_DEBUT_YEAR,
  );
}

/** 作品・シリーズ以外の行（slug → 組み立て）。専用ページの slug のホワイトリストを兼ねる */
const STATIC_ROWS = new Map<
  string,
  (src: VoiceActorSources) => Promise<VoiceActorRow>
>([
  ["airing", loadAiringRow],
  ["leads", loadLeadsRow],
  ["ranking", loadRankingRow],
  ["birthdays", loadBirthdayRow],
  ["previous-season", loadPreviousSeasonRow],
  ["latest-movies", loadLatestMoviesRow],
  ["new-generation", loadNewGenerationRow],
  ["legends", loadLegendsRow],
]);

// ──────────────────────────────────────────
// Hero
// ──────────────────────────────────────────

export interface VoiceActorHeroItem {
  anime: TMDbAnime;
  /** 主演声優の名前（TMDb の出演順の先頭から） */
  leadVoiceActors: string[];
}

async function leadVoiceActorsOf(animeId: number): Promise<string[]> {
  try {
    const { cast } = await getAnimeCredits(animeId);
    return [...cast]
      .sort((a, b) => a.order - b.order)
      .slice(0, HERO_LEAD_COUNT)
      .map((c) => c.name);
  } catch {
    return [];
  }
}

/** Hero: 今期の人気作品のキービジュアルと主演声優 */
async function loadHero(src: VoiceActorSources): Promise<VoiceActorHeroItem[]> {
  try {
    const anime = (await src.seasonalAnime())
      .filter(isHeroReady)
      .slice(0, FEATURED_HERO_SIZE);
    const leads = await Promise.all(anime.map((a) => leadVoiceActorsOf(a.id)));
    return anime.map((a, i) => ({ anime: a, leadVoiceActors: leads[i] }));
  } catch (error) {
    console.error(`[${LOG_TAG}] hero failed:`, error);
    return [];
  }
}

// ──────────────────────────────────────────
// 公開 API
// ──────────────────────────────────────────

export interface VoiceActorHome {
  hero: VoiceActorHeroItem[];
  /** 表示順。空の行も含む（描画側で隠す） */
  rows: VoiceActorRow[];
}

/**
 * 声優ページの全行を並列に取る。各行は失敗しても空になり、ページは落ちない。
 * 順序は ISSUE #102 の受け入れ条件の並び
 */
export async function loadVoiceActorHome(): Promise<VoiceActorHome> {
  const src = createVoiceActorSources();

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
    newGeneration,
    legends,
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
    loadNewGenerationRow(src),
    loadLegendsRow(src),
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
      newGeneration,
      legends,
    ],
  };
}

/**
 * 「すべて見る」の専用ページの 1 行。定義に無い slug は null（ページ側で 404）。
 * 照合の規則は `loadCollectionRow`（`src/lib/featured-rows.ts`）を参照
 */
export function loadVoiceActorCollection(
  slug: string,
): Promise<VoiceActorRow | null> {
  return loadCollectionRow(slug, {
    createSources: createVoiceActorSources,
    staticRows: STATIC_ROWS,
    loadFranchiseRow,
    loadFeaturedWorkRows,
  });
}
