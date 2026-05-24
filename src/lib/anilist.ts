// AniList GraphQL クライアント
// TMDb のシーズン情報がズレるケース（2期エピソードが1期に統合されている等）の補完、
// および TMDb に存在しないキャラクター名検索 (/search/characters) の補完に使用する。
// API キー不要・読み取り専用クエリのみ使用する。

import type {
  AniListCharacter,
  AniListCharacterDetail,
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
        id
        idMal
        title { romaji english native }
        coverImage { large extraLarge color }
        bannerImage
        averageScore
        popularity
        startDate { year month day }
        format
        episodes
        countryOfOrigin
        isAdult
        synonyms
        siteUrl
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
): Promise<{
  results: AniListMedia[];
  totalPages: number;
  totalResults: number;
}> {
  let response: Response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: SEASON_QUERY,
        variables: { year, season, page, perPage },
      }),
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
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
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
      media(sort: POPULARITY_DESC, perPage: 25, type: ANIME) {
        edges {
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
        }
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
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
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

/** Media（作品）に属するキャラ一覧を取得 → 関連キャラ表示に使う */
export async function getAniListMediaCharacters(
  mediaId: number,
  page = 1,
  perPage = 24,
): Promise<{
  edges: AniListRelatedCharacterEdge[];
  pageInfo: AniListPageInfo;
}> {
  let response: Response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: MEDIA_CHARACTERS_QUERY,
        variables: { id: mediaId, page, perPage },
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

  if (!response.ok) {
    throw new Error(
      `AniList API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as AniListMediaCharactersResponse;
  if (data.errors && data.errors.length > 0) {
    return { edges: [], pageInfo: EMPTY_PAGE_INFO };
  }
  const connection = data.data?.Media?.characters;
  return {
    edges: connection?.edges ?? [],
    pageInfo: connection?.pageInfo ?? EMPTY_PAGE_INFO,
  };
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
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
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
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
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
