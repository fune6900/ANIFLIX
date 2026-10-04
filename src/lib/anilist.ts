// AniList GraphQL クライアント
// TMDb のシーズン情報がズレるケース（2期エピソードが1期に統合されている等）の補完、
// および TMDb に存在しないキャラクター名検索 (/search/characters) の補完に使用する。
// API キー不要・読み取り専用クエリのみ使用する。

import { probeLastPage } from "@/lib/page-probe";
import type { ProbedPages } from "@/lib/page-probe";
import type {
  AniListCharacter,
  AniListCharacterDetail,
  AniListCharacterDetailMediaEdge,
  AniListCharacterMediaResponse,
  AniListCharacterDetailResponse,
  AniListMediaCharactersResponse,
  AniListMediaSearchNode,
  AniListMediaSearchResponse,
  AniListMediaType,
  AniListPageInfo,
  AniListRelatedCharacterEdge,
  AniListSearchCharactersResponse,
  AniListStaffCharacterEdge,
  AniListStaffSearchResponse,
  AniListCastMedia,
  AniListCastMediaPageResponse,
  AniListStaff,
  AniListStaffPageResponse,
  CharacterSearchResult,
} from "@/types/anilist";

const EMPTY_PAGE_INFO: AniListPageInfo = {
  total: 0,
  currentPage: 1,
  lastPage: 1,
  hasNextPage: false,
  perPage: 0,
};

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

/**
 * AniList への共通リクエストヘッダー。
 *
 * AniList は Cloudflare の背後にあり、User-Agent を名乗らないリクエストを
 * 403 Forbidden で弾くことがある。ランタイムによっては fetch がデフォルトの
 * User-Agent を送らないため（Node の undici は自動付与するが、エッジランタイムは
 * 送らないものがある）、実行環境に依存しないよう明示的に付与する。
 * 公開 API に対して呼び出し元を名乗るのは礼儀でもある。
 */
const ANILIST_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "ANIFLIX/1.0 (+https://github.com/fune6900/ANIFLIX)",
};

export type AniListSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export interface AniListMedia {
  id: number;
  idMal: number | null;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
  };
  coverImage: {
    large: string | null;
    extraLarge: string | null;
    color: string | null;
  };
  bannerImage: string | null;
  averageScore: number | null;
  popularity: number;
  startDate: { year: number | null; month: number | null; day: number | null };
  /**
   * 放送終了日。放送中・未定の作品は null。
   * シーズンをまたぐ 2 クール作品を拾うのに使う（src/lib/seasonal-anime.ts）
   */
  endDate: { year: number | null; month: number | null; day: number | null };
  /** FINISHED / RELEASING / NOT_YET_RELEASED / CANCELLED / HIATUS */
  status: string | null;
  format: string | null;
  episodes: number | null;
  countryOfOrigin: string | null;
  isAdult: boolean;
  synonyms: string[];
  siteUrl: string;
}

interface AniListPageResponse {
  data?: {
    Page?: {
      pageInfo: {
        hasNextPage: boolean;
        total: number;
        currentPage: number;
        lastPage: number;
      };
      media: AniListMedia[];
    };
  };
  errors?: Array<{ message: string }>;
}

/** Page ベースのクエリが返す 1 ページ分 */
export interface AniListMediaPage {
  results: AniListMedia[];
  totalPages: number;
  totalResults: number;
  /** 次ページがあるか。全ページ取り切る判定に使う */
  hasNextPage: boolean;
}

/** AniListMedia を満たすフィールド集合。シーズン / 期間の両クエリで共有する */
const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { large extraLarge color }
  bannerImage
  averageScore
  popularity
  startDate { year month day }
  endDate { year month day }
  status
  format
  episodes
  countryOfOrigin
  isAdult
  synonyms
  siteUrl
`;

const SEASON_QUERY = `
  query ($season: MediaSeason, $year: Int, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage total currentPage lastPage }
      media(
        season: $season
        seasonYear: $year
        type: ANIME
        sort: POPULARITY_DESC
        countryOfOrigin: "JP"
        isAdult: false
      ) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

/**
 * 放送期間が指定範囲と重なる作品を引くクエリ。
 *
 * `season` で引くと「その季に開始した作品」しか取れず、前クールから継続している
 * 2 クール作品（例: 2026 SPRING 開始の「転生したらスライムだった件 第4期」）が
 * 夏のリストから丸ごと落ちる。開始日 <= 期間終了 かつ 終了日 >= 期間開始 で引く。
 *
 * 副作用として、終了日が未定（null）の作品は AniList 側の絞り込みから外れる。
 * これは ONE PIECE / 名探偵コナン のような常時放送の長寿作品を自動的に除外する
 * 効果があるが、同時に「これから始まる季の新作」も落ちる。そのため呼び出し側では
 * シーズンクエリとの**和集合**を取ること（src/lib/seasonal-anime.ts）。
 */
const AIRING_RANGE_QUERY = `
  query ($start: FuzzyDateInt, $end: FuzzyDateInt, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage total currentPage lastPage }
      media(
        type: ANIME
        startDate_lesser: $end
        endDate_greater: $start
        sort: POPULARITY_DESC
        countryOfOrigin: "JP"
        isAdult: false
      ) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

/** 指定シーズン（year × season）のアニメ一覧を AniList から取得 */
export async function getAniListSeasonAnime(
  year: number,
  season: AniListSeason,
  page = 1,
  perPage = 30,
): Promise<AniListMediaPage> {
  return fetchAniListMediaPage(SEASON_QUERY, { year, season, page, perPage });
}

/**
 * 放送期間が指定範囲と重なるアニメ一覧を AniList から取得する。
 *
 * 日付は AniList の FuzzyDateInt（`YYYYMMDD` の整数）で渡すこと。
 * 終了日が未定の作品は含まれない（`AIRING_RANGE_QUERY` の注記を参照）。
 */
export async function getAniListAnimeAiringInRange(
  start: number,
  end: number,
  page = 1,
  perPage = 50,
): Promise<AniListMediaPage> {
  return fetchAniListMediaPage(AIRING_RANGE_QUERY, {
    start,
    end,
    page,
    perPage,
  });
}

/** Page ベースのクエリ共通の取得処理 */
async function fetchAniListMediaPage(
  query: string,
  variables: Record<string, unknown>,
): Promise<AniListMediaPage> {
  let response: Response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: ANILIST_HEADERS,
      body: JSON.stringify({ query, variables }),
      // 上流が遅延した場合に SSR が無限待機しないよう 8秒で打ち切る
      signal: AbortSignal.timeout(8000),
      // シーズン一覧は頻繁に変わらないので6時間キャッシュ
      next: { revalidate: 21600 },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("AniList API timeout (>8s)");
    }
    throw err;
  }

  if (!response.ok) {
    throw new Error(
      `AniList API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as AniListPageResponse;

  // GraphQL は HTTP 200 でも errors を返すケースがあるため明示チェック
  if (data.errors && data.errors.length > 0) {
    const message = data.errors.map((e) => e.message).join("; ");
    throw new Error(`AniList GraphQL error: ${message}`);
  }
  const pageData = data.data?.Page;
  if (!pageData) {
    throw new Error("AniList GraphQL error: missing Page payload");
  }

  return {
    results: pageData.media,
    totalPages: pageData.pageInfo.lastPage,
    totalResults: pageData.pageInfo.total,
    hasNextPage: pageData.pageInfo.hasNextPage,
  };
}

/** ANIFLIX 内部のシーズンスラッグ → AniList の Season enum */
export function toAniListSeason(
  slug: "winter" | "spring" | "summer" | "fall",
): AniListSeason {
  return slug.toUpperCase() as AniListSeason;
}

/** AniList の作品から表示用タイトル（日本語優先）を取り出す */
export function pickAniListTitle(media: AniListMedia): string {
  return (
    media.title.native ??
    media.title.romaji ??
    media.title.english ??
    `(id:${media.id})`
  );
}

// --- キャラクター検索 ---

const SEARCH_CHARACTERS_QUERY = `
  query ($search: String!, $perPage: Int!) {
    Page(perPage: $perPage) {
      characters(search: $search) {
        id
        name { full native alternative }
        image { large medium }
        media(perPage: 1, sort: POPULARITY_DESC, type: ANIME) {
          edges {
            node {
              id
              idMal
              title { native romaji english }
              coverImage { large extraLarge }
              seasonYear
              countryOfOrigin
            }
            voiceActors(language: JAPANESE) {
              id
              name { full native }
              image { large medium }
            }
          }
        }
      }
    }
  }
`;

/** AniList でキャラ名検索 → 主要作品 + 日本語声優を 1 クエリで返す */
export async function searchAniListCharacters(
  search: string,
  perPage = 20,
): Promise<CharacterSearchResult[]> {
  let response: Response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: ANILIST_HEADERS,
      body: JSON.stringify({
        query: SEARCH_CHARACTERS_QUERY,
        variables: { search, perPage },
      }),
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 0 },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("AniList API timeout (>8s)");
    }
    throw err;
  }

  if (!response.ok) {
    throw new Error(
      `AniList API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as AniListSearchCharactersResponse;

  if (data.errors && data.errors.length > 0) {
    const message = data.errors.map((e) => e.message).join("; ");
    throw new Error(`AniList GraphQL error: ${message}`);
  }

  const characters = data.data?.Page?.characters ?? [];
  return characters.map(toCharacterSearchResult);
}

function toCharacterSearchResult(
  character: AniListCharacter,
): CharacterSearchResult {
  const edge = character.media.edges[0];
  const node = edge?.node ?? null;
  const va = edge?.voiceActors?.[0] ?? null;

  const characterImage =
    character.image.large || character.image.medium || null;
  // AniList のデフォルト画像（情報無しキャラ）を除外する
  const safeCharacterImage =
    characterImage && !characterImage.includes("/default.")
      ? characterImage
      : null;

  return {
    id: character.id,
    name:
      character.name.native || character.name.full || `(id:${character.id})`,
    characterImageUrl: safeCharacterImage,
    work: node
      ? {
          aniListId: node.id,
          title:
            node.title.native ||
            node.title.romaji ||
            node.title.english ||
            `(id:${node.id})`,
          posterUrl:
            node.coverImage.extraLarge || node.coverImage.large || null,
          seasonYear: node.seasonYear,
        }
      : null,
    voiceActor: va
      ? {
          id: va.id,
          name: va.name.native || va.name.full || `(id:${va.id})`,
        }
      : null,
  };
}

/** Character.media の 1 件ぶんのフィールド（詳細と出演作品のページ送りで共有する） */
const CHARACTER_MEDIA_EDGE_FIELDS = `
  characterRole
  node {
    id
    idMal
    title { native romaji english }
    coverImage { large extraLarge }
    seasonYear
    countryOfOrigin
  }
  voiceActors(language: JAPANESE) {
    id
    name { full native }
    image { large medium }
  }
`;

/**
 * キャラ詳細。出演作品は代表作（人気順の先頭: 声優表示と関連キャラの起点）の 1 件だけ取る。
 * 出演作品の一覧は `getAniListCharacterMedia` でページ単位に引く
 */
const CHARACTER_DETAIL_QUERY = `
  query ($id: Int!) {
    Character(id: $id) {
      id
      name { full native alternative }
      image { large medium }
      description(asHtml: false)
      age
      gender
      bloodType
      dateOfBirth { year month day }
      siteUrl
      favourites
      media(sort: POPULARITY_DESC, perPage: 1, type: ANIME) {
        edges { ${CHARACTER_MEDIA_EDGE_FIELDS} }
      }
    }
  }
`;

/** AniList Character 詳細を取得 (id は AniList Character ID) */
export async function getAniListCharacter(
  id: number,
): Promise<AniListCharacterDetail | null> {
  let response: Response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: ANILIST_HEADERS,
      body: JSON.stringify({
        query: CHARACTER_DETAIL_QUERY,
        variables: { id },
      }),
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("AniList API timeout (>8s)");
    }
    throw err;
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `AniList API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as AniListCharacterDetailResponse;

  if (data.errors && data.errors.length > 0) {
    // Character が見つからない場合 AniList は errors を返すケースがある → 呼び出し側で notFound() できるよう null
    const notFoundError = data.errors.some((e) =>
      /not found|does not exist/i.test(e.message),
    );
    if (notFoundError) return null;
    const message = data.errors.map((e) => e.message).join("; ");
    throw new Error(`AniList GraphQL error: ${message}`);
  }

  return data.data?.Character ?? null;
}

const MEDIA_CHARACTERS_QUERY = `
  query ($id: Int!, $page: Int!, $perPage: Int!) {
    Media(id: $id) {
      characters(sort: FAVOURITES_DESC, page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        edges {
          role
          node {
            id
            name { full native }
            image { large medium }
          }
        }
      }
    }
  }
`;

/**
 * AniList へ GraphQL を 1 回投げて JSON を返す（タイムアウト・HTTP エラーの扱いを 1 箇所に集約）。
 * GraphQL の `errors` をどう扱うかは呼び出し側が決める。
 */
async function postAniListQuery<T>(
  query: string,
  variables: Record<string, string | number | boolean>,
  revalidate: number,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: ANILIST_HEADERS,
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
      next: { revalidate },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("AniList API timeout (>8s)");
    }
    throw err;
  }

  if (!response.ok) {
    throw new Error(
      `AniList API error: ${response.status} ${response.statusText}`,
    );
  }

  // 形は呼び出し側が渡す T の宣言に委ねる（AniList のレスポンスは実行時検証していない）
  return (await response.json()) as T;
}

/** Media（作品）に属するキャラ一覧を取得 → 関連キャラ表示に使う */
export async function getAniListMediaCharacters(
  mediaId: number,
  page = 1,
  perPage = 24,
): Promise<{
  edges: AniListRelatedCharacterEdge[];
  pageInfo: AniListPageInfo;
}> {
  const data = await postAniListQuery<AniListMediaCharactersResponse>(
    MEDIA_CHARACTERS_QUERY,
    { id: mediaId, page, perPage },
    3600,
  );
  if (data.errors && data.errors.length > 0) {
    return { edges: [], pageInfo: EMPTY_PAGE_INFO };
  }
  const connection = data.data?.Media?.characters;
  return {
    edges: connection?.edges ?? [],
    pageInfo: connection?.pageInfo ?? EMPTY_PAGE_INFO,
  };
}

/** 件数を数えるだけの軽い問い合わせ（キャラの id と申告の最終ページだけ取る） */
const MEDIA_CHARACTER_IDS_QUERY = `
  query ($id: Int!, $page: Int!, $perPage: Int!) {
    Media(id: $id) {
      characters(sort: FAVOURITES_DESC, page: $page, perPage: $perPage) {
        pageInfo { lastPage }
        edges { node { id } }
      }
    }
  }
`;

interface AniListCharacterIdsResponse {
  data?: {
    Media?: {
      characters?: {
        pageInfo: { lastPage: number };
        edges: Array<{ node: { id: number } }>;
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
}

/** 件数はほとんど変わらないので長く持つ（1 日） */
const CHARACTER_COUNT_CACHE_TIME = 86400;

async function fetchCharacterIdsPage(
  mediaId: number,
  page: number,
  perPage: number,
): Promise<{ count: number; reportedLastPage: number }> {
  const data = await postAniListQuery<AniListCharacterIdsResponse>(
    MEDIA_CHARACTER_IDS_QUERY,
    { id: mediaId, page, perPage },
    CHARACTER_COUNT_CACHE_TIME,
  );
  if (data.errors && data.errors.length > 0) {
    throw new Error("AniList API returned errors");
  }
  const connection = data.data?.Media?.characters;
  return {
    count: connection?.edges.length ?? 0,
    reportedLastPage: connection?.pageInfo.lastPage ?? 0,
  };
}

/** 呼び出し側が既に持っている 1 ページ目の情報（取得し直しを省く） */
export interface CharacterCountHint {
  /** 1 ページ目の問い合わせで AniList が申告した最終ページ */
  reportedLastPage: number;
  /** 1 ページ目の実際の件数 */
  firstPageCount: number;
}

/**
 * 作品のキャラの、実在するページ数と件数。
 *
 * `Media.characters` の pageInfo（total / lastPage）は実態と食い違う
 * （葬送のフリーレン: 申告 500 件・20 ページ / 実際 100 件・4 ページ）。
 * 申告の最終ページを上限に二分探索で数える（`src/lib/page-probe.ts`）。失敗したら throw する。
 * `hint` を渡すと 1 ページ目の問い合わせを省く
 */
export async function getAniListMediaCharacterCount(
  mediaId: number,
  perPage: number,
  hint?: CharacterCountHint,
): Promise<ProbedPages> {
  const first = hint
    ? { count: hint.firstPageCount, reportedLastPage: hint.reportedLastPage }
    : await fetchCharacterIdsPage(mediaId, 1, perPage);
  return probeLastPage(first.reportedLastPage, perPage, async (page) =>
    page === 1
      ? first.count
      : (await fetchCharacterIdsPage(mediaId, page, perPage)).count,
  );
}

// --- 出演作品（Character.media をページ単位で引く） ---

const CHARACTER_MEDIA_QUERY = `
  query ($id: Int!, $page: Int!, $perPage: Int!) {
    Character(id: $id) {
      media(sort: POPULARITY_DESC, type: ANIME, page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        edges { ${CHARACTER_MEDIA_EDGE_FIELDS} }
      }
    }
  }
`;

/**
 * キャラの出演作品（アニメ）を 1 ページぶん取得する。人気順。
 * pageInfo は申告値のまま返す（件数・最終ページには `getAniListCharacterMediaCount` を使う）
 */
export async function getAniListCharacterMedia(
  characterId: number,
  page = 1,
  perPage = 30,
): Promise<{
  edges: AniListCharacterDetailMediaEdge[];
  pageInfo: AniListPageInfo;
}> {
  const data = await postAniListQuery<AniListCharacterMediaResponse>(
    CHARACTER_MEDIA_QUERY,
    { id: characterId, page, perPage },
    3600,
  );
  if (data.errors && data.errors.length > 0) {
    return { edges: [], pageInfo: EMPTY_PAGE_INFO };
  }
  const connection = data.data?.Character?.media;
  return {
    edges: connection?.edges ?? [],
    pageInfo: connection?.pageInfo ?? EMPTY_PAGE_INFO,
  };
}

/** 件数を数えるだけの軽い問い合わせ（作品の id と申告の最終ページだけ取る） */
const CHARACTER_MEDIA_IDS_QUERY = `
  query ($id: Int!, $page: Int!, $perPage: Int!) {
    Character(id: $id) {
      media(sort: POPULARITY_DESC, type: ANIME, page: $page, perPage: $perPage) {
        pageInfo { lastPage }
        edges { node { id } }
      }
    }
  }
`;

interface AniListCharacterMediaIdsResponse {
  data?: {
    Character?: {
      media?: {
        pageInfo: { lastPage: number };
        edges: Array<{ node: { id: number } }>;
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
}

async function fetchCharacterMediaIdsPage(
  characterId: number,
  page: number,
  perPage: number,
): Promise<{ count: number; reportedLastPage: number }> {
  const data = await postAniListQuery<AniListCharacterMediaIdsResponse>(
    CHARACTER_MEDIA_IDS_QUERY,
    { id: characterId, page, perPage },
    CHARACTER_COUNT_CACHE_TIME,
  );
  if (data.errors && data.errors.length > 0) {
    throw new Error("AniList API returned errors");
  }
  const connection = data.data?.Character?.media;
  return {
    count: connection?.edges.length ?? 0,
    reportedLastPage: connection?.pageInfo.lastPage ?? 0,
  };
}

/**
 * キャラの出演作品の、実在するページ数と件数。
 *
 * ネストした connection の pageInfo は実態と食い違うことがある（`Media.characters` で実測済み。
 * `Character.media` も同じ作りなので信用しない）。申告の最終ページを上限に二分探索で数える
 * （`src/lib/page-probe.ts`）。失敗したら throw する。`hint` を渡すと 1 ページ目の問い合わせを省く
 */
export async function getAniListCharacterMediaCount(
  characterId: number,
  perPage: number,
  hint?: CharacterCountHint,
): Promise<ProbedPages> {
  const first = hint
    ? { count: hint.firstPageCount, reportedLastPage: hint.reportedLastPage }
    : await fetchCharacterMediaIdsPage(characterId, 1, perPage);
  return probeLastPage(first.reportedLastPage, perPage, async (page) =>
    page === 1
      ? first.count
      : (await fetchCharacterMediaIdsPage(characterId, page, perPage)).count,
  );
}

// --- Media タイトル検索（TMDb 名 → AniList ID 解決、TMDb 検索のフォールバック） ---

const MEDIA_SEARCH_QUERY = `
  query ($search: String!, $perPage: Int!, $format_in: [MediaFormat]) {
    Page(perPage: $perPage) {
      media(
        search: $search
        type: ANIME
        format_in: $format_in
        sort: SEARCH_MATCH
        isAdult: false
      ) {
        id
        idMal
        format
        popularity
        countryOfOrigin
        isAdult
        synonyms
        title { native romaji english }
      }
    }
  }
`;

const FORMATS_BY_TYPE: Record<AniListMediaType, string[]> = {
  ANIME: ["TV", "TV_SHORT", "OVA", "ONA", "SPECIAL"],
  MOVIE: ["MOVIE"],
};

/**
 * AniList で作品をタイトル検索する。
 * 用途:
 *   - TMDb で 0 件のときのフォールバック検索（AniList の synonyms に略称が登録されているケース）
 *   - 詳細ページから AniList ID を解決してキャラ一覧を取得
 *
 * 日本アニメだけに絞るため countryOfOrigin === "JP" を後段でフィルタする。
 */
export async function searchAniListMedia(
  search: string,
  type: AniListMediaType = "ANIME",
  perPage = 10,
): Promise<AniListMediaSearchNode[]> {
  let response: Response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: ANILIST_HEADERS,
      body: JSON.stringify({
        query: MEDIA_SEARCH_QUERY,
        variables: {
          search,
          perPage,
          format_in: FORMATS_BY_TYPE[type],
        },
      }),
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return [];
    }
    throw err;
  }

  if (!response.ok) return [];

  const data = (await response.json()) as AniListMediaSearchResponse;
  if (data.errors && data.errors.length > 0) return [];
  const media = data.data?.Page?.media ?? [];
  return media.filter((m) => m.countryOfOrigin === "JP" && !m.isAdult);
}

/**
 * AniList のメディア候補からタイトル候補一覧を返す（native → romaji → english + synonyms）。
 * 重複と空文字を排除する。
 */
export function pickAniListTitleCandidates(
  media: AniListMediaSearchNode,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (s: string | null | undefined) => {
    if (!s) return;
    const trimmed = s.trim();
    if (!trimmed) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };
  push(media.title.native);
  push(media.title.romaji);
  push(media.title.english);
  for (const syn of media.synonyms ?? []) push(syn);
  return out;
}

// --- Staff（声優）→ 演じたキャラ ---

const STAFF_CHARACTERS_QUERY = `
  query ($search: String!, $page: Int!, $perPage: Int!) {
    Page(perPage: 5) {
      staff(search: $search) {
        id
        name { full native }
        characters(sort: FAVOURITES_DESC, page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          edges {
            role
            node {
              id
              name { full native }
              image { large medium }
            }
            media {
              id
              title { native romaji english }
              coverImage { large extraLarge }
              seasonYear
              popularity
            }
          }
        }
      }
    }
  }
`;

/**
 * 声優名 → AniList の staff 解決 → 演じたキャラエッジ一覧を返す。
 *
 * AniList の staff 検索は完全一致を期待せず複数の同名人物が返るケースがあるため、
 * 取得した staff 候補のうち characters の総数（pageInfo.total）が最も多いものを採用する
 * （同名 staff のうち実体のあるレコードを優先するため）。page 番号が変わっても
 * total はメディア由来で安定するため、ページ間で同じ staff が選ばれる。
 */
export async function getAniListStaffCharactersByName(
  search: string,
  page = 1,
  perPage = 24,
): Promise<{
  staffId: number;
  staffName: string;
  edges: AniListStaffCharacterEdge[];
  pageInfo: AniListPageInfo;
} | null> {
  let response: Response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: ANILIST_HEADERS,
      body: JSON.stringify({
        query: STAFF_CHARACTERS_QUERY,
        variables: { search, page, perPage },
      }),
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return null;
    }
    throw err;
  }

  if (!response.ok) return null;

  const data = (await response.json()) as AniListStaffSearchResponse;
  if (data.errors && data.errors.length > 0) return null;
  const staffList = data.data?.Page?.staff ?? [];
  if (staffList.length === 0) return null;

  // pageInfo.total（total characters）が最大の staff を採用。
  // edges 件数ベースだと page=2 以降で空になり同一性が崩れるため total を用いる。
  let best = staffList[0];
  let bestTotal = best.characters?.pageInfo.total ?? 0;
  for (const s of staffList.slice(1)) {
    const total = s.characters?.pageInfo.total ?? 0;
    if (total > bestTotal) {
      best = s;
      bestTotal = total;
    }
  }
  if (bestTotal === 0) return null;

  return {
    staffId: best.id,
    staffName: best.name.native || best.name.full || `(id:${best.id})`,
    edges: best.characters?.edges ?? [],
    pageInfo: best.characters?.pageInfo ?? EMPTY_PAGE_INFO,
  };
}

// --- 声優ページ（#102）: Staff とキャスト付きの作品 ---
// キャラクターページ（#104）でも使う想定。キャラの画像も取っておく

/** AniListStaff を満たすフィールド集合 */
const STAFF_FIELDS = `
  id
  name { full native }
  image { large }
  languageV2
  primaryOccupations
  yearsActive
  favourites
  dateOfBirth { year month day }
`;

/**
 * AniListCastMedia を満たすフィールド集合。`$castPerPage` を宣言したクエリで使うこと。
 * キャラは MAIN → SUPPORTING の順（同じ役どころの中は作品内の重要度順）
 */
const CAST_MEDIA_FIELDS = `
  id
  title { native romaji english }
  coverImage { extraLarge large }
  bannerImage
  popularity
  startDate { year month day }
  characters(sort: [ROLE, RELEVANCE, ID], perPage: $castPerPage) {
    edges {
      role
      node { id name { full native } image { large } }
      voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { ${STAFF_FIELDS} }
    }
  }
`;

const SEASON_CAST_QUERY = `
  query ($season: MediaSeason, $year: Int, $perPage: Int, $castPerPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(
        season: $season
        seasonYear: $year
        type: ANIME
        sort: POPULARITY_DESC
        countryOfOrigin: "JP"
        isAdult: false
      ) {
        ${CAST_MEDIA_FIELDS}
      }
    }
  }
`;

const FRANCHISE_CAST_QUERY = `
  query ($search: String, $perPage: Int, $castPerPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(
        search: $search
        type: ANIME
        format_in: [TV]
        sort: POPULARITY_DESC
        countryOfOrigin: "JP"
        isAdult: false
      ) {
        ${CAST_MEDIA_FIELDS}
      }
    }
  }
`;

/**
 * Staff の一覧。お気に入り数順。
 * `isBirthday` を省くと null になり、AniList は絞り込みを掛けない
 */
const STAFF_PAGE_QUERY = `
  query ($page: Int, $perPage: Int, $isBirthday: Boolean) {
    Page(page: $page, perPage: $perPage) {
      staff(sort: FAVOURITES_DESC, isBirthday: $isBirthday) {
        ${STAFF_FIELDS}
      }
    }
  }
`;

/**
 * シーズンのキャストのキャッシュ秒数（1 日）。
 * キャストの発表・追加は日単位でしか動かず、AniList の分間制限を節約する方を取る
 */
const SEASON_CAST_CACHE_TIME = 86400;

/** シリーズのキャスト・お気に入り数順はほとんど変わらないので 1 日持つ */
const STABLE_CAST_CACHE_TIME = 86400;

/**
 * 誕生日は 1 時間。日付そのものはキャッシュキー（クエリ末尾の日付コメント）で切り替わるので、
 * ここは「AniList 側の日付の切り替わりにどれだけ遅れて追従するか」の上限になる
 */
const BIRTHDAY_CACHE_TIME = 3600;

/** 1 ページの上限（AniList の Page は 50 件まで） */
const ANILIST_MAX_PER_PAGE = 50;

/** GraphQL の errors を例外にする（行単位の失敗として呼び出し側で隔離させる） */
function throwOnGraphQLErrors(
  errors: Array<{ message: string }> | undefined,
): void {
  if (errors && errors.length > 0) {
    throw new Error(
      `AniList GraphQL error: ${errors.map((e) => e.message).join("; ")}`,
    );
  }
}

/**
 * 指定シーズンの作品を人気順に、キャスト（キャラ + 日本語の声優）付きで取得する。
 * 1 回の問い合わせで `perPage` 作品 × `castPerPage` キャラを取る（2026 SUMMER の
 * 50 × 50 で 430KB。Data Cache の上限 2MB に収まる。2026-10-04 実測）
 */
export async function getAniListSeasonCast(
  year: number,
  season: AniListSeason,
  perPage = 30,
  castPerPage = ANILIST_MAX_PER_PAGE,
): Promise<AniListCastMedia[]> {
  const data = await postAniListQuery<AniListCastMediaPageResponse>(
    SEASON_CAST_QUERY,
    { year, season, perPage, castPerPage },
    SEASON_CAST_CACHE_TIME,
  );
  throwOnGraphQLErrors(data.errors);
  return data.data?.Page?.media ?? [];
}

/**
 * シリーズ（タイトル検索語）の TV 作品を人気順に、キャスト付きで取得する。
 * 検索は曖昧一致なので、呼び出し側で `matchesFranchiseTitle` を通すこと。
 * `search` には `src/lib/franchises.ts` の固定の語彙だけを渡す（利用者の入力を渡さない。
 * 1 日キャッシュするため、任意の値がそのままキャッシュキーになる）
 */
export async function getAniListFranchiseCast(
  search: string,
  castPerPage = 25,
): Promise<AniListCastMedia[]> {
  const data = await postAniListQuery<AniListCastMediaPageResponse>(
    FRANCHISE_CAST_QUERY,
    { search, perPage: ANILIST_MAX_PER_PAGE, castPerPage },
    STABLE_CAST_CACHE_TIME,
  );
  throwOnGraphQLErrors(data.errors);
  return data.data?.Page?.media ?? [];
}

/**
 * お気に入り数の多い Staff を 1 ページ分。
 * AniList の Staff は言語・職業で絞れないため、声優以外（漫画家・監督など）や
 * 海外の声優も混ざる。絞り込みは呼び出し側で行う
 */
export async function getAniListPopularStaff(
  page = 1,
  perPage = ANILIST_MAX_PER_PAGE,
): Promise<AniListStaff[]> {
  const data = await postAniListQuery<AniListStaffPageResponse>(
    STAFF_PAGE_QUERY,
    { page, perPage },
    STABLE_CAST_CACHE_TIME,
  );
  throwOnGraphQLErrors(data.errors);
  return data.data?.Page?.staff ?? [];
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 誕生日のクエリ。末尾に日付（`YYYY-MM-DD`）のコメントを付ける。
 *
 * `isBirthday` は日付を引数に取らないが、Next の Data Cache のキーは POST の body なので、
 * コメントで日ごとに別エントリにする（AniList が末尾コメントを受け付けることは
 * 2026-10-04 に実測確認）。日付以外の文字列はクエリに入れない
 */
export function birthdayStaffQuery(dateKey: string): string {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error(`invalid date key: ${JSON.stringify(dateKey)}`);
  }
  return `${STAFF_PAGE_QUERY}\n# ${dateKey}\n`;
}

/**
 * 今日が誕生日の Staff（お気に入り数順に 1 ページ）。
 *
 * 「今日」は AniList のサーバー側の日付で決まり、引数では指定できない。
 * `dateKey`（`YYYY-MM-DD`）はキャッシュキーを日ごとに変えるためだけに使う
 * （`birthdayStaffQuery`）。日付が変わった後に前日の結果を返し続けないようにするため
 */
export async function getAniListBirthdayStaff(
  dateKey: string,
): Promise<AniListStaff[]> {
  const data = await postAniListQuery<AniListStaffPageResponse>(
    birthdayStaffQuery(dateKey),
    { page: 1, perPage: ANILIST_MAX_PER_PAGE, isBirthday: true },
    BIRTHDAY_CACHE_TIME,
  );
  throwOnGraphQLErrors(data.errors);
  return data.data?.Page?.staff ?? [];
}
