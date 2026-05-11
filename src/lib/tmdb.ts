// TMDb API クライアント

import type {
  TMDbAnime,
  TMDbExternalIds,
  TMDbMovie,
  TMDbMovieDetail,
  TMDbPerson,
  TMDbPersonDetail,
  TMDbSearchResponse,
  TMDbSeasonDetail,
  TMDbTVDetail,
  TMDbVideo,
} from "@/types/tmdb";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

// アニメーションジャンルID
const ANIMATION_GENRE_ID = 16;

// 認証情報を解決する
// TMDB_ACCESS_TOKEN があれば Bearer（優先）
// TMDB_API_KEY が JWT (eyJ...) ならそれも Bearer として扱う
// それ以外は api_key クエリパラメータ
function resolveAuth(): { headers: Record<string, string>; apiKeyParam?: string } {
  const bearerToken = process.env.TMDB_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;

  if (bearerToken) {
    return { headers: { Authorization: `Bearer ${bearerToken}` } };
  }
  if (apiKey) {
    // JWT 形式（eyJ で始まる）なら Bearer トークンとして使用
    if (apiKey.startsWith("eyJ")) {
      return { headers: { Authorization: `Bearer ${apiKey}` } };
    }
    // 従来の v3 API キー
    return { headers: {}, apiKeyParam: apiKey };
  }
  throw new Error(
    "TMDb認証情報が未設定です。TMDB_ACCESS_TOKEN または TMDB_API_KEY を .env.local に設定してください。"
  );
}

export function getImageUrl(
  path: string | null,
  size: "w185" | "w342" | "w500" | "w780" | "original" = "w342"
): string {
  if (!path) return "";
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export async function fetchTMDb<T>(
  endpoint: string,
  params: Record<string, string> = {},
  cacheTime: number = 0
): Promise<T> {
  const { headers: authHeaders, apiKeyParam } = resolveAuth();
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);

  // v3 API キーの場合はクエリパラメータに付加
  if (apiKeyParam) {
    url.searchParams.set("api_key", apiKeyParam);
  }

  url.searchParams.set("language", "ja-JP");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const fetchOptions: RequestInit = {
    headers: authHeaders,
    ...(cacheTime === 0
      ? { cache: "no-store" }
      : { next: { revalidate: cacheTime } }),
  };

  const response = await fetch(url.toString(), fetchOptions);

  if (!response.ok) {
    throw new Error(`TMDb API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ──────────────────────────────────────────
// 詳細条件アニメ検索（discover）
// ──────────────────────────────────────────

export interface DiscoverAnimeParams {
  genreId?: number;
  yearFrom?: number;
  yearTo?: number;
  minScore?: number;
  sortBy?: string;
  status?: string;
  page?: number;
}

/** 詳細条件でアニメを検索（キーワード非対応・フィルターのみ） */
export async function discoverAnime(
  params: DiscoverAnimeParams
): Promise<TMDbSearchResponse<TMDbAnime>> {
  const query: Record<string, string> = {
    with_genres: String(ANIMATION_GENRE_ID),
    with_origin_country: "JP",
    sort_by: params.sortBy ?? "popularity.desc",
    page: String(params.page ?? 1),
  };

  if (params.genreId) {
    query.with_genres = `${ANIMATION_GENRE_ID},${params.genreId}`;
  }
  if (params.yearFrom) {
    query["first_air_date.gte"] = `${params.yearFrom}-01-01`;
  }
  if (params.yearTo) {
    query["first_air_date.lte"] = `${params.yearTo}-12-31`;
  }
  if (params.minScore) {
    query["vote_average.gte"] = String(params.minScore);
    query["vote_count.gte"] = "20";
  }
  if (params.status) {
    query.with_status = params.status;
  }

  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>("/discover/tv", query, 0);
}

// アニメ検索（サーバーサイド用）
export async function searchAnime(
  query: string
): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>(
    "/search/tv",
    { query, include_adult: "false" },
    0
  );
}

/** TV番組をページ指定で検索（年代内絞り込み等に利用） */
export async function searchTVByPage(
  query: string,
  page = 1
): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>(
    "/search/tv",
    { query, include_adult: "false", page: String(page) },
    0
  );
}

// アニメ詳細取得
export async function getAnimeDetail(id: number): Promise<TMDbTVDetail> {
  return fetchTMDb<TMDbTVDetail>(`/tv/${id}`, {
    append_to_response: "credits",
  });
}

/** シーズンのエピソード一覧を取得 */
export async function getAnimeSeasonEpisodes(
  animeId: number,
  seasonNumber: number
): Promise<TMDbSeasonDetail> {
  return fetchTMDb<TMDbSeasonDetail>(`/tv/${animeId}/season/${seasonNumber}`, {});
}

// 人気アニメ（日本アニメーション）
export async function getPopularAnime(page = 1): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>("/discover/tv", {
    with_genres: String(ANIMATION_GENRE_ID),
    with_origin_country: "JP",
    sort_by: "popularity.desc",
    "vote_count.gte": "100",
    page: String(page),
  });
}

// 新着アニメ（直近3ヶ月）
export async function getNewAnime(page = 1): Promise<TMDbSearchResponse<TMDbAnime>> {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>("/discover/tv", {
    with_genres: String(ANIMATION_GENRE_ID),
    with_origin_country: "JP",
    sort_by: "first_air_date.desc",
    "first_air_date.lte": now.toISOString().split("T")[0],
    "first_air_date.gte": threeMonthsAgo.toISOString().split("T")[0],
    "vote_count.gte": "5",
    page: String(page),
  });
}

// トレンドアニメ（週間・日本アニメフィルタ）
export async function getTrendingAnime(page = 1): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>("/trending/tv/week", { page: String(page) });
}

// ──────────────────────────────────────────
// 声優（Person）関連
// ──────────────────────────────────────────

// 声優検索
export async function searchPerson(
  query: string,
  page = 1
): Promise<TMDbSearchResponse<TMDbPerson>> {
  return fetchTMDb<TMDbSearchResponse<TMDbPerson>>(
    "/search/person",
    { query, include_adult: "false", page: String(page) },
    0
  );
}

// 声優詳細取得（出演作付き）
export async function getPersonDetail(id: number): Promise<TMDbPersonDetail> {
  return fetchTMDb<TMDbPersonDetail>(`/person/${id}`, {
    append_to_response: "combined_credits",
  });
}

/// トップページ用: 人気声優（週間トレンド人物からActing部門を抽出）
export async function getPopularVoiceActors(): Promise<TMDbSearchResponse<TMDbPerson>> {
  return fetchTMDb<TMDbSearchResponse<TMDbPerson>>("/trending/person/week", {});
}

/** 日本の声優一覧（language=ja-JP で人気人物を取得） */
export async function getJapaneseVoiceActors(page = 1): Promise<TMDbSearchResponse<TMDbPerson>> {
  return fetchTMDb<TMDbSearchResponse<TMDbPerson>>("/person/popular", { page: String(page) });
}

// ジャンル別アニメ（日本アニメ + 指定ジャンル）
export async function getAnimeByGenre(
  genreId: number,
  page = 1
): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>("/discover/tv", {
    // アニメーション(16) AND 指定ジャンル を組み合わせ
    with_genres: `${ANIMATION_GENRE_ID},${genreId}`,
    with_origin_country: "JP",
    sort_by: "popularity.desc",
    "vote_count.gte": "5",
    page: String(page),
  });
}

// ──────────────────────────────────────────
// キーワードベースのジャンル検索
// ──────────────────────────────────────────

interface TMDbKeyword {
  id: number;
  name: string;
}

interface TMDbKeywordSearchResponse {
  results: TMDbKeyword[];
}

/** TMDb キーワード名 → キーワード ID を解決（24時間キャッシュ） */
export async function resolveKeywordId(query: string): Promise<number | null> {
  const data = await fetchTMDb<TMDbKeywordSearchResponse>(
    "/search/keyword",
    { query },
    86400
  );
  return data.results[0]?.id ?? null;
}

/** キーワード ID（複数可・OR 検索）で日本アニメを取得 */
export async function getAnimeByKeyword(
  keywordIds: number | number[],
  page = 1
): Promise<TMDbSearchResponse<TMDbAnime>> {
  const ids = Array.isArray(keywordIds) ? keywordIds : [keywordIds];
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>("/discover/tv", {
    with_keywords: ids.join("|"), // | = OR 検索
    with_genres: String(ANIMATION_GENRE_ID),
    with_origin_country: "JP",
    sort_by: "popularity.desc",
    "vote_count.gte": "5",
    page: String(page),
  });
}

/** 複数キーワード名から ID を解決し OR 検索で日本アニメを取得 */
export async function getAnimeByKeywords(
  keywords: string[],
  page = 1
): Promise<TMDbSearchResponse<TMDbAnime>> {
  const ids = (
    await Promise.all(keywords.map((kw) => resolveKeywordId(kw)))
  ).filter((id): id is number => id !== null);

  if (ids.length === 0) {
    return { page: 1, results: [], total_pages: 0, total_results: 0 };
  }
  return getAnimeByKeyword(ids, page);
}

// ──────────────────────────────────────────
// 年代別アニメ
// ──────────────────────────────────────────

/** 指定した年代（decade = 1990 → 1990〜1999年）の日本アニメを取得
 *  sortBy: "popularity.desc"（人気順）または "first_air_date.asc"（放送日順）
 */
export async function getAnimeByEra(
  decade: number,
  page = 1,
  sortBy: "popularity.desc" | "first_air_date.asc" = "popularity.desc"
): Promise<TMDbSearchResponse<TMDbAnime>> {
  const startDate = `${decade}-01-01`;
  const endDate   = `${decade + 9}-12-31`;
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>("/discover/tv", {
    with_genres: String(ANIMATION_GENRE_ID),
    with_origin_country: "JP",
    "first_air_date.gte": startDate,
    "first_air_date.lte": endDate,
    sort_by: sortBy,
    page: String(page),
  });
}

// ──────────────────────────────────────────
// アニメ映画
// ──────────────────────────────────────────

/** 日本のアニメ映画を取得 */
export async function getAnimeMovies(page = 1): Promise<TMDbSearchResponse<TMDbMovie>> {
  return fetchTMDb<TMDbSearchResponse<TMDbMovie>>("/discover/movie", {
    with_genres: String(ANIMATION_GENRE_ID),
    with_origin_country: "JP",
    sort_by: "popularity.desc",
    "vote_count.gte": "10",
    page: String(page),
  });
}

// ──────────────────────────────────────────
// シーズン別アニメ
// ──────────────────────────────────────────

/** 指定した期間（クールの開始日〜終了日）の日本アニメを取得 */
export async function getAnimeBySeason(
  dateFrom: string,
  dateTo: string,
  page = 1
): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>("/discover/tv", {
    with_genres: String(ANIMATION_GENRE_ID),
    with_origin_country: "JP",
    "first_air_date.gte": dateFrom,
    "first_air_date.lte": dateTo,
    sort_by: "popularity.desc",
    page: String(page),
  });
}

// ──────────────────────────────────────────
// 放送中アニメ
// ──────────────────────────────────────────

/** 現在放送中の日本アニメを取得 */
export async function getAiringAnime(page = 1): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>("/discover/tv", {
    with_genres: String(ANIMATION_GENRE_ID),
    with_origin_country: "JP",
    sort_by: "popularity.desc",
    with_status: "0", // Returning Series (連続放送中)
    "air_date.lte": new Date().toISOString().split("T")[0],
    page: String(page),
  });
}

// ──────────────────────────────────────────
// スタジオ別アニメ
// ──────────────────────────────────────────

/** 指定スタジオ（制作会社ID）の日本アニメを取得 */
export async function getAnimeByStudio(
  companyId: number,
  page = 1
): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>("/discover/tv", {
    with_companies: String(companyId),
    with_genres: String(ANIMATION_GENRE_ID),
    sort_by: "popularity.desc",
    page: String(page),
  });
}

// ──────────────────────────────────────────
// 映画詳細
// ──────────────────────────────────────────

/** 映画詳細取得（クレジット・動画・外部ID付き） */
export async function getMovieDetail(id: number): Promise<TMDbMovieDetail> {
  return fetchTMDb<TMDbMovieDetail>(`/movie/${id}`, {
    append_to_response: "credits,videos,external_ids,recommendations",
  });
}

// ──────────────────────────────────────────
// 映画検索
// ──────────────────────────────────────────

/** 映画タイトル検索 */
export async function searchMovie(
  query: string
): Promise<TMDbSearchResponse<TMDbMovie>> {
  return fetchTMDb<TMDbSearchResponse<TMDbMovie>>(
    "/search/movie",
    { query, include_adult: "false" },
    0
  );
}

// ──────────────────────────────────────────
// 動画（トレーラー）
// ──────────────────────────────────────────

/** アニメの外部ID（SNS連携）を取得 */
export async function getAnimeExternalIds(animeId: number): Promise<TMDbExternalIds> {
  return fetchTMDb<TMDbExternalIds>(`/tv/${animeId}/external_ids`, {}, 86400);
}

interface TMDbVideosResponse {
  id: number;
  results: TMDbVideo[];
}

/** アニメの YouTube 動画一覧を取得し優先度順にソートして返す */
export async function getAnimeVideos(animeId: number): Promise<TMDbVideo[]> {
  const data = await fetchTMDb<TMDbVideosResponse>(
    `/tv/${animeId}/videos`,
    {}
  );
  const yt = data.results.filter((v) => v.site === "YouTube");
  // 優先度: 公式Trailer > 公式Teaser > Trailer > Opening Credits > その他
  const order = ["Trailer", "Teaser", "Opening Credits", "Clip", "Featurette"];
  return yt.sort((a, b) => {
    const aScore = (a.official ? 10 : 0) + (10 - order.indexOf(a.type));
    const bScore = (b.official ? 10 : 0) + (10 - order.indexOf(b.type));
    return bScore - aScore;
  });
}
