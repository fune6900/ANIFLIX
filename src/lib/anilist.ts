// AniList GraphQL クライアント
// TMDb のシーズン情報がズレるケース（2期エピソードが1期に統合されている等）の補完用。
// API キー不要・読み取り専用クエリのみ使用する。

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
  data: {
    Page: {
      pageInfo: {
        hasNextPage: boolean;
        total: number;
        currentPage: number;
        lastPage: number;
      };
      media: AniListMedia[];
    };
  };
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
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: SEASON_QUERY,
      variables: { year, season, page, perPage },
    }),
    // シーズン一覧は頻繁に変わらないので6時間キャッシュ
    next: { revalidate: 21600 },
  });

  if (!response.ok) {
    throw new Error(
      `AniList API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as AniListPageResponse;
  const pageData = data.data.Page;

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
