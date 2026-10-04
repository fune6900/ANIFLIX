// TMDb API クライアント

import type {
  TMDbAnime,
  TMDbCastMember,
  TMDbExternalIds,
  TMDbMovie,
  TMDbMovieDetail,
  TMDbPerson,
  TMDbPersonDetail,
  TMDbSearchResponse,
  TMDbSeasonDetail,
  TMDbTVDetail,
  TMDbVideo,
  TMDbWatchProvidersResponse,
  TMDbTVKeywordsResponse,
  TMDbMovieKeywordsResponse,
} from "@/types/tmdb";
import { movieGenreIdsFor } from "@/lib/movie-genres";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

// アニメーションジャンルID
const ANIMATION_GENRE_ID = 16;

/**
 * discover 系（ホームのジャンル列・新着・トレンド）のキャッシュ秒数。
 *
 * これらは fetchTMDb のデフォルト（0 = no-store）で動いていたため、
 * ホーム 1 リクエストにつき TMDb へ 21 回以上の往復が発生していた。
 * ランダム性は randomPage() が URL を変えること（= 別キャッシュエントリ）と、
 * レンダリング時に走る shuffle() が担保するため、キャッシュを効かせても
 * 表示の多様性は失われない。
 */
const DISCOVER_CACHE_TIME = 1800;

/**
 * 詳細系（作品・人物・エピソード・動画）のキャッシュ秒数。
 * 内容がほぼ変わらない一方、これらは動的ルートから毎リクエスト呼ばれるため、
 * キャッシュしないと関数の実行時間が TMDb の往復で支配される。
 */
const DETAIL_CACHE_TIME = 3600;

/** TMDb の discover / search が受け付けるページ番号の上限 */
export const TMDB_MAX_PAGE = 500;

/**
 * クエリ文字列のページ番号を 1〜TMDB_MAX_PAGE に正規化する。
 *
 * 上限が無いと任意のページ番号がそのまま discover の URL に乗る。
 * discover 系をキャッシュした今、それは TMDb への無駄打ちでは済まず、
 * Data Cache に無制限のエントリを作られることを意味する。
 */
export function parsePageParam(raw: string | null | undefined): number {
  const n = parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, TMDB_MAX_PAGE);
}

// ──────────────────────────────────────────
// アニメ判定フィルター（実写ドラマ・洋画の混入を除外）
// ──────────────────────────────────────────

/**
 * TV 作品を「日本のアニメ」に限定するフィルター。
 * 必須: genre_ids にアニメーション(16)を含む
 * 加重: origin_country に JP、または original_language === "ja" のいずれか
 */
export function isJapaneseAnimeTV(item: TMDbAnime): boolean {
  const hasAnimationGenre = item.genre_ids?.includes(ANIMATION_GENRE_ID);
  if (!hasAnimationGenre) return false;
  const isJp =
    item.origin_country?.includes("JP") || item.original_language === "ja";
  return Boolean(isJp);
}

/**
 * 映画作品を「日本のアニメ映画」に限定するフィルター。
 * 必須: genre_ids にアニメーション(16)を含む
 * 加重: original_language === "ja"、または origin_country に JP
 */
export function isJapaneseAnimeMovie(item: TMDbMovie): boolean {
  const hasAnimationGenre = item.genre_ids?.includes(ANIMATION_GENRE_ID);
  if (!hasAnimationGenre) return false;
  const isJp =
    item.original_language === "ja" || item.origin_country?.includes("JP");
  return Boolean(isJp);
}

/**
 * 人物を「日本の声優・俳優」に限定するフィルター。
 *
 * 重要: TMDb は language=ja-JP で `name` を翻訳するため、海外俳優 (Sydney Sweeney, Jackie Chan 等)
 * も「シドニー・スウィーニー」のようにカタカナ表記になる。したがって `name` の日本語判定では
 * 海外俳優を弾けない。原名 `original_name` は翻訳されず、本来の表記が残るのでこちらで判定する。
 *
 * 判定ロジック:
 *   1) `original_name` にひらがな or カタカナ (U+3040〜U+30FF) を含む → 採用
 *      （ひらがな・カタカナは日本語にのみ存在。中国・韓国名と確実に切り分けられる）
 *   2) かな以外（漢字のみ / ローマ字のみ）の場合は
 *      `known_for` に「少なくとも 1 本」の JP origin を要求し、かつ全 known_for が
 *      JP origin またはアニメ (genre 16) であることを要求する。
 *      - 中国漢字 (例: 成龍) と日本漢字 (例: 神谷浩史) は Unicode 上区別できないため、
 *        漢字のみ名前は kana なし扱いで「JP origin の作品が必須」とする
 *      - これにより Tom Palmer 型 (アニメ 1 本だけ持つ Hollywood ライター) と
 *        中国アニメ作品しかない中国名が同時に除外される
 */
export function isJapaneseVoiceActor(person: TMDbPerson): boolean {
  const originalName = person.original_name ?? "";

  // 1) ひらがな or カタカナを含む原名 → 確定で日本
  if (/[぀-ヿ]/.test(originalName)) return true;

  const works = person.known_for ?? [];
  if (works.length === 0) return false;

  // 2a) すべての known_for が JP origin またはアニメ (16) であることを要求
  const allJpOrAnime = works.every(
    (k) =>
      (k.origin_country as string[] | undefined)?.includes("JP") ||
      (k.genre_ids as number[] | undefined)?.includes(ANIMATION_GENRE_ID),
  );
  if (!allJpOrAnime) return false;

  // 2b) かな以外は必ず known_for に最低 1 本の JP origin を要求
  //     （CJK 漢字判定で甘くすると Chinese 漢字名 + 中国アニメで false positive 再発）
  return works.some((k) =>
    (k.origin_country as string[] | undefined)?.includes("JP"),
  );
}

// 認証情報を解決する
// TMDB_ACCESS_TOKEN があれば Bearer（優先）
// TMDB_API_KEY が JWT (eyJ...) ならそれも Bearer として扱う
// それ以外は api_key クエリパラメータ
function resolveAuth(): {
  headers: Record<string, string>;
  apiKeyParam?: string;
} {
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
    "TMDb認証情報が未設定です。TMDB_ACCESS_TOKEN または TMDB_API_KEY を .env.local に設定してください。",
  );
}

export function getImageUrl(
  path: string | null,
  size: "w185" | "w342" | "w500" | "w780" | "w1280" | "original" = "w342",
): string {
  if (!path) return "";
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export async function fetchTMDb<T>(
  endpoint: string,
  params: Record<string, string> = {},
  cacheTime: number = 0,
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
    throw new Error(
      `TMDb API error: ${response.status} ${response.statusText}`,
    );
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
  /** YYYY-MM-DD（年度フィルタより優先。シーズン範囲指定用） */
  dateFrom?: string;
  dateTo?: string;
  minScore?: number;
  sortBy?: string;
  status?: string;
  page?: number;
}

/** 詳細条件でアニメを検索（キーワード非対応・フィルターのみ） */
export async function discoverAnime(
  params: DiscoverAnimeParams,
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
  // date 指定が優先、無ければ year を使用
  if (params.dateFrom) {
    query["first_air_date.gte"] = params.dateFrom;
  } else if (params.yearFrom) {
    query["first_air_date.gte"] = `${params.yearFrom}-01-01`;
  }
  if (params.dateTo) {
    query["first_air_date.lte"] = params.dateTo;
  } else if (params.yearTo) {
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

/** 映画版 discover 用パラメータ */
export interface DiscoverMovieParams {
  genreId?: number;
  /** YYYY-MM-DD */
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  page?: number;
}

/** 詳細条件で日本のアニメ映画を検索 */
export async function discoverAnimeMovie(
  params: DiscoverMovieParams,
): Promise<TMDbSearchResponse<TMDbMovie>> {
  const query: Record<string, string> = {
    with_genres: String(ANIMATION_GENRE_ID),
    with_origin_country: "JP",
    sort_by: params.sortBy ?? "popularity.desc",
    page: String(params.page ?? 1),
  };

  if (params.genreId) {
    // TV 専用のジャンル（10759 等）は映画に無く、そのままだと 0 件になる。
    // 読み替え先が複数あっても with_genres では OR にできないため先頭（主たる側）で絞る
    const [movieGenreId] = movieGenreIdsFor(params.genreId);
    query.with_genres = `${ANIMATION_GENRE_ID},${movieGenreId}`;
  }
  if (params.dateFrom) {
    query["primary_release_date.gte"] = params.dateFrom;
  }
  if (params.dateTo) {
    query["primary_release_date.lte"] = params.dateTo;
  }

  return fetchTMDb<TMDbSearchResponse<TMDbMovie>>("/discover/movie", query, 0);
}

// アニメ検索（サーバーサイド用）
export async function searchAnime(
  query: string,
  cacheTime = 0,
): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>(
    "/search/tv",
    { query, include_adult: "false" },
    cacheTime,
  );
}

/** TV番組をページ指定で検索（年代内絞り込み等に利用） */
export async function searchTVByPage(
  query: string,
  page = 1,
): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>(
    "/search/tv",
    { query, include_adult: "false", page: String(page) },
    0,
  );
}

// アニメ詳細取得
export async function getAnimeDetail(id: number): Promise<TMDbTVDetail> {
  return fetchTMDb<TMDbTVDetail>(
    `/tv/${id}`,
    { append_to_response: "credits" },
    DETAIL_CACHE_TIME,
  );
}

/** TV 作品のキャストを取得（声優一覧用） */
export async function getAnimeCredits(
  animeId: number,
): Promise<{ cast: TMDbCastMember[] }> {
  return fetchTMDb<{ cast: TMDbCastMember[] }>(
    `/tv/${animeId}/credits`,
    {},
    3600,
  );
}

/** シーズンのエピソード一覧を取得 */
export async function getAnimeSeasonEpisodes(
  animeId: number,
  seasonNumber: number,
): Promise<TMDbSeasonDetail> {
  return fetchTMDb<TMDbSeasonDetail>(
    `/tv/${animeId}/season/${seasonNumber}`,
    {},
    DETAIL_CACHE_TIME,
  );
}

// 人気アニメ（日本アニメーション）
export async function getPopularAnime(
  page = 1,
): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>(
    "/discover/tv",
    {
      with_genres: String(ANIMATION_GENRE_ID),
      with_origin_country: "JP",
      sort_by: "popularity.desc",
      "vote_count.gte": "100",
      page: String(page),
    },
    DISCOVER_CACHE_TIME,
  );
}

/** 新着 = 直近この日数（今日を含む）にエピソードが放送された作品 */
const NEW_ANIME_WINDOW_DAYS = 7;

/**
 * 新着のキャッシュ秒数。期間の日付が URL に入るため日付が変われば別エントリになり、
 * 1 日の中では同じ結果でよい（日替わり）
 */
const NEW_ANIME_CACHE_TIME = 86400;

/** 日本時間（UTC+9）で見た日付を YYYY-MM-DD で返す */
function jstDateString(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

/**
 * 今日（日本時間）を含む直近 days 日の期間。
 * アニメは日本時間で放送されるため、UTC で数えると 0〜9 時に 1 日ずれる
 */
function recentAirWindowJst(days: number): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { from: jstDateString(from), to: jstDateString(now) };
}

// 新着アニメ（直近 7 日にエピソードが放送された作品）
export async function getNewAnime(
  page = 1,
): Promise<TMDbSearchResponse<TMDbAnime>> {
  const { from, to } = recentAirWindowJst(NEW_ANIME_WINDOW_DAYS);

  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>(
    "/discover/tv",
    {
      with_genres: String(ANIMATION_GENRE_ID),
      with_origin_country: "JP",
      sort_by: "popularity.desc",
      // air_date はエピソードの放送日。放送開始日（first_air_date）で絞ると
      // 継続中の作品が新しい話を出しても新着に入らない
      "air_date.gte": from,
      "air_date.lte": to,
      // air_date をどのタイムゾーンで解釈するか。窓の日付は日本時間で作っているので揃える
      timezone: "Asia/Tokyo",
      page: String(page),
    },
    NEW_ANIME_CACHE_TIME,
  );
}

// トレンドアニメ（週間・日本アニメフィルタ）
export async function getTrendingAnime(
  page = 1,
): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>(
    "/trending/tv/week",
    { page: String(page) },
    DISCOVER_CACHE_TIME,
  );
}

// ──────────────────────────────────────────
// 声優（Person）関連
// ──────────────────────────────────────────

// 声優検索
export async function searchPerson(
  query: string,
  page = 1,
): Promise<TMDbSearchResponse<TMDbPerson>> {
  return fetchTMDb<TMDbSearchResponse<TMDbPerson>>(
    "/search/person",
    { query, include_adult: "false", page: String(page) },
    0,
  );
}

// 声優詳細取得（出演作付き）
export async function getPersonDetail(id: number): Promise<TMDbPersonDetail> {
  return fetchTMDb<TMDbPersonDetail>(
    `/person/${id}`,
    { append_to_response: "combined_credits" },
    DETAIL_CACHE_TIME,
  );
}

/** 日本の声優一覧（language=ja-JP で人気人物を取得） */
export async function getJapaneseVoiceActors(
  page = 1,
): Promise<TMDbSearchResponse<TMDbPerson>> {
  return fetchTMDb<TMDbSearchResponse<TMDbPerson>>(
    "/person/popular",
    { page: String(page) },
    DETAIL_CACHE_TIME,
  );
}

// ジャンル別アニメ（日本アニメ + 指定ジャンル）
export async function getAnimeByGenre(
  genreId: number,
  page = 1,
): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>(
    "/discover/tv",
    {
      // アニメーション(16) AND 指定ジャンル を組み合わせ
      with_genres: `${ANIMATION_GENRE_ID},${genreId}`,
      with_origin_country: "JP",
      sort_by: "popularity.desc",
      "vote_count.gte": "5",
      page: String(page),
    },
    DISCOVER_CACHE_TIME,
  );
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
    86400,
  );
  return data.results[0]?.id ?? null;
}

/** キーワード discover 用のオプション（シーズン範囲などを上乗せ可） */
export interface KeywordDiscoverOptions {
  /** YYYY-MM-DD（シーズン範囲などを上乗せ） */
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
}

/** キーワード ID（複数可・OR 検索）で日本アニメを取得 */
export async function getAnimeByKeyword(
  keywordIds: number | number[],
  page = 1,
  options?: KeywordDiscoverOptions,
): Promise<TMDbSearchResponse<TMDbAnime>> {
  const ids = Array.isArray(keywordIds) ? keywordIds : [keywordIds];
  const query: Record<string, string> = {
    with_keywords: ids.join("|"), // | = OR 検索
    with_genres: String(ANIMATION_GENRE_ID),
    with_origin_country: "JP",
    sort_by: options?.sortBy ?? "popularity.desc",
    "vote_count.gte": "5",
    page: String(page),
  };
  if (options?.dateFrom) query["first_air_date.gte"] = options.dateFrom;
  if (options?.dateTo) query["first_air_date.lte"] = options.dateTo;
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>(
    "/discover/tv",
    query,
    DISCOVER_CACHE_TIME,
  );
}

/** 複数キーワード名から ID を解決し OR 検索で日本アニメを取得 */
export async function getAnimeByKeywords(
  keywords: string[],
  page = 1,
  options?: KeywordDiscoverOptions,
): Promise<TMDbSearchResponse<TMDbAnime>> {
  const ids = (
    await Promise.all(keywords.map((kw) => resolveKeywordId(kw)))
  ).filter((id): id is number => id !== null);

  if (ids.length === 0) {
    return { page: 1, results: [], total_pages: 0, total_results: 0 };
  }
  return getAnimeByKeyword(ids, page, options);
}

/** キーワード ID（複数可・OR 検索）で日本アニメ映画を取得 */
export async function getAnimeMovieByKeyword(
  keywordIds: number | number[],
  page = 1,
  options?: KeywordDiscoverOptions,
): Promise<TMDbSearchResponse<TMDbMovie>> {
  const ids = Array.isArray(keywordIds) ? keywordIds : [keywordIds];
  const query: Record<string, string> = {
    with_keywords: ids.join("|"),
    with_genres: String(ANIMATION_GENRE_ID),
    with_origin_country: "JP",
    sort_by: options?.sortBy ?? "popularity.desc",
    page: String(page),
  };
  if (options?.dateFrom) query["primary_release_date.gte"] = options.dateFrom;
  if (options?.dateTo) query["primary_release_date.lte"] = options.dateTo;
  return fetchTMDb<TMDbSearchResponse<TMDbMovie>>(
    "/discover/movie",
    query,
    DISCOVER_CACHE_TIME,
  );
}

/** 複数キーワード名から ID を解決し OR 検索で日本アニメ映画を取得 */
export async function getAnimeMovieByKeywords(
  keywords: string[],
  page = 1,
  options?: KeywordDiscoverOptions,
): Promise<TMDbSearchResponse<TMDbMovie>> {
  const ids = (
    await Promise.all(keywords.map((kw) => resolveKeywordId(kw)))
  ).filter((id): id is number => id !== null);

  if (ids.length === 0) {
    return { page: 1, results: [], total_pages: 0, total_results: 0 };
  }
  return getAnimeMovieByKeyword(ids, page, options);
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
  sortBy: "popularity.desc" | "first_air_date.asc" = "popularity.desc",
): Promise<TMDbSearchResponse<TMDbAnime>> {
  const startDate = `${decade}-01-01`;
  const endDate = `${decade + 9}-12-31`;
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>(
    "/discover/tv",
    {
      with_genres: String(ANIMATION_GENRE_ID),
      with_origin_country: "JP",
      "first_air_date.gte": startDate,
      "first_air_date.lte": endDate,
      sort_by: sortBy,
      page: String(page),
    },
    DISCOVER_CACHE_TIME,
  );
}

// ──────────────────────────────────────────
// アニメ映画
// ──────────────────────────────────────────

/** 日本のアニメ映画を取得 */
export async function getAnimeMovies(
  page = 1,
): Promise<TMDbSearchResponse<TMDbMovie>> {
  return fetchTMDb<TMDbSearchResponse<TMDbMovie>>(
    "/discover/movie",
    {
      with_genres: String(ANIMATION_GENRE_ID),
      with_origin_country: "JP",
      sort_by: "popularity.desc",
      "vote_count.gte": "10",
      page: String(page),
    },
    DISCOVER_CACHE_TIME,
  );
}

/** 最新作（公開日が新しい順）。公開予定日の作品で先頭が埋まらないよう今日（日本時間）までに絞る */
export async function getLatestAnimeMovies(
  page = 1,
): Promise<TMDbSearchResponse<TMDbMovie>> {
  return fetchTMDb<TMDbSearchResponse<TMDbMovie>>(
    "/discover/movie",
    {
      with_genres: String(ANIMATION_GENRE_ID),
      with_origin_country: "JP",
      sort_by: "primary_release_date.desc",
      "primary_release_date.lte": jstDateString(new Date()),
      page: String(page),
    },
    // 今日の日付が URL に入るため日付が変われば別エントリになる（新着アニメと同じ）
    NEW_ANIME_CACHE_TIME,
  );
}

/** 「高評価の名作」に入れる最低票数。少数票の満点作品が先頭を占めないようにする */
const TOP_RATED_MIN_VOTES = 200;

/** 評価点が高く票数も十分な日本のアニメ映画 */
export async function getTopRatedAnimeMovies(
  page = 1,
): Promise<TMDbSearchResponse<TMDbMovie>> {
  return fetchTMDb<TMDbSearchResponse<TMDbMovie>>(
    "/discover/movie",
    {
      with_genres: String(ANIMATION_GENRE_ID),
      with_origin_country: "JP",
      sort_by: "vote_average.desc",
      "vote_count.gte": String(TOP_RATED_MIN_VOTES),
      page: String(page),
    },
    DISCOVER_CACHE_TIME,
  );
}

/**
 * 映画ジャンル別の日本のアニメ映画。
 * `movieGenreId` は映画のジャンル ID（TV 専用 ID は `movieGenreIdsFor()` で読み替えてから渡す）
 */
export async function getAnimeMoviesByGenre(
  movieGenreId: number,
  page = 1,
): Promise<TMDbSearchResponse<TMDbMovie>> {
  return fetchTMDb<TMDbSearchResponse<TMDbMovie>>(
    "/discover/movie",
    {
      with_genres: `${ANIMATION_GENRE_ID},${movieGenreId}`,
      with_origin_country: "JP",
      sort_by: "popularity.desc",
      page: String(page),
    },
    DISCOVER_CACHE_TIME,
  );
}

/** 指定スタジオ（制作会社ID）のアニメ映画 */
export async function getAnimeMoviesByStudio(
  companyId: number,
  page = 1,
): Promise<TMDbSearchResponse<TMDbMovie>> {
  return fetchTMDb<TMDbSearchResponse<TMDbMovie>>(
    "/discover/movie",
    {
      with_companies: String(companyId),
      with_genres: String(ANIMATION_GENRE_ID),
      sort_by: "popularity.desc",
      page: String(page),
    },
    DISCOVER_CACHE_TIME,
  );
}

/** 日本の劇場で上映中の映画（全ジャンル。アニメかどうかは呼び出し側で絞る） */
export async function getNowPlayingMovies(
  page = 1,
): Promise<TMDbSearchResponse<TMDbMovie>> {
  return fetchTMDb<TMDbSearchResponse<TMDbMovie>>(
    "/movie/now_playing",
    { region: "JP", page: String(page) },
    DISCOVER_CACHE_TIME,
  );
}

/** 日本で公開予定の映画（全ジャンル。アニメかどうかは呼び出し側で絞る） */
export async function getUpcomingMovies(
  page = 1,
): Promise<TMDbSearchResponse<TMDbMovie>> {
  return fetchTMDb<TMDbSearchResponse<TMDbMovie>>(
    "/movie/upcoming",
    { region: "JP", page: String(page) },
    DISCOVER_CACHE_TIME,
  );
}

/** 全世界の週間トレンド映画（全ジャンル・全地域） */
export async function getTrendingMovies(
  page = 1,
): Promise<TMDbSearchResponse<TMDbMovie>> {
  return fetchTMDb<TMDbSearchResponse<TMDbMovie>>(
    "/trending/movie/week",
    { page: String(page) },
    DISCOVER_CACHE_TIME,
  );
}

// ──────────────────────────────────────────
// シーズン別アニメ
// ──────────────────────────────────────────

/** 指定した期間（クールの開始日〜終了日）の日本アニメを取得 */
export async function getAnimeBySeason(
  dateFrom: string,
  dateTo: string,
  page = 1,
  cacheTime = DISCOVER_CACHE_TIME,
): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>(
    "/discover/tv",
    {
      with_genres: String(ANIMATION_GENRE_ID),
      with_origin_country: "JP",
      "first_air_date.gte": dateFrom,
      "first_air_date.lte": dateTo,
      sort_by: "popularity.desc",
      page: String(page),
    },
    cacheTime,
  );
}

// ──────────────────────────────────────────
// 放送中アニメ
// ──────────────────────────────────────────

/** 現在放送中の日本アニメを取得 */
export async function getAiringAnime(
  page = 1,
): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>(
    "/discover/tv",
    {
      with_genres: String(ANIMATION_GENRE_ID),
      with_origin_country: "JP",
      sort_by: "popularity.desc",
      with_status: "0", // Returning Series (連続放送中)
      "air_date.lte": new Date().toISOString().split("T")[0],
      page: String(page),
    },
    DISCOVER_CACHE_TIME,
  );
}

// ──────────────────────────────────────────
// スタジオ別アニメ
// ──────────────────────────────────────────

/** 指定スタジオ（制作会社ID）の日本アニメを取得 */
export async function getAnimeByStudio(
  companyId: number,
  page = 1,
): Promise<TMDbSearchResponse<TMDbAnime>> {
  return fetchTMDb<TMDbSearchResponse<TMDbAnime>>(
    "/discover/tv",
    {
      with_companies: String(companyId),
      with_genres: String(ANIMATION_GENRE_ID),
      sort_by: "popularity.desc",
      page: String(page),
    },
    DISCOVER_CACHE_TIME,
  );
}

// ──────────────────────────────────────────
// 映画詳細
// ──────────────────────────────────────────

/** 映画詳細取得（クレジット・動画・外部ID付き） */
export async function getMovieDetail(id: number): Promise<TMDbMovieDetail> {
  return fetchTMDb<TMDbMovieDetail>(
    `/movie/${id}`,
    { append_to_response: "credits,videos,external_ids,recommendations" },
    DETAIL_CACHE_TIME,
  );
}

// ──────────────────────────────────────────
// 映画検索
// ──────────────────────────────────────────

/**
 * 映画タイトル検索。
 *
 * `cacheTime` の既定は 0。**利用者が入力したキーワードでは必ず 0 のまま使う**
 * （キーワードがそのままキャッシュキーになるため）。呼び出し側が固定の語彙しか
 * 渡さない場合に限り上書きを許す（例: `src/lib/seasonal-anime.ts` は AniList
 * 由来の作品名で 86400 を渡す）。`searchAnime` と同じ方針。
 */
export async function searchMovie(
  query: string,
  cacheTime = 0,
): Promise<TMDbSearchResponse<TMDbMovie>> {
  return fetchTMDb<TMDbSearchResponse<TMDbMovie>>(
    "/search/movie",
    { query, include_adult: "false" },
    cacheTime,
  );
}

// ──────────────────────────────────────────
// 動画（トレーラー）
// ──────────────────────────────────────────

/** アニメの外部ID（SNS連携）を取得 */
export async function getAnimeExternalIds(
  animeId: number,
): Promise<TMDbExternalIds> {
  return fetchTMDb<TMDbExternalIds>(`/tv/${animeId}/external_ids`, {}, 86400);
}

interface TMDbVideosResponse {
  id: number;
  results: TMDbVideo[];
}

// ──────────────────────────────────────────
// 配信プラットフォーム（Watch Providers）
// ──────────────────────────────────────────

/** アニメの配信プラットフォーム情報を取得（24時間キャッシュ） */
export async function getAnimeWatchProviders(
  animeId: number,
): Promise<TMDbWatchProvidersResponse> {
  return fetchTMDb<TMDbWatchProvidersResponse>(
    `/tv/${animeId}/watch/providers`,
    {},
    86400,
  );
}

/** 作品のキーワード ID（一覧フィルターのキーワード由来ジャンル用。ほぼ不変なので 24 時間キャッシュ） */
export async function getAnimeKeywordIds(animeId: number): Promise<number[]> {
  const data = await fetchTMDb<TMDbTVKeywordsResponse>(
    `/tv/${animeId}/keywords`,
    {},
    86400,
  );
  return (data.results ?? []).map((k) => k.id);
}

/** 映画のキーワード ID。映画はレスポンスのキーが `keywords`（TV は `results`） */
export async function getMovieKeywordIds(movieId: number): Promise<number[]> {
  const data = await fetchTMDb<TMDbMovieKeywordsResponse>(
    `/movie/${movieId}/keywords`,
    {},
    86400,
  );
  return (data.keywords ?? []).map((k) => k.id);
}

/** 映画の配信プラットフォーム情報を取得（24時間キャッシュ） */
export async function getMovieWatchProviders(
  movieId: number,
): Promise<TMDbWatchProvidersResponse> {
  return fetchTMDb<TMDbWatchProvidersResponse>(
    `/movie/${movieId}/watch/providers`,
    {},
    86400,
  );
}

/** アニメの YouTube 動画一覧を取得し優先度順にソートして返す */
export async function getAnimeVideos(animeId: number): Promise<TMDbVideo[]> {
  const data = await fetchTMDb<TMDbVideosResponse>(
    `/tv/${animeId}/videos`,
    {},
    DETAIL_CACHE_TIME,
  );
  return sortYouTubeVideos(data.results);
}

/** 映画の YouTube 動画一覧（優先度順）。TV と ID 空間が別なので映画のエンドポイントから取る */
export async function getMovieVideos(movieId: number): Promise<TMDbVideo[]> {
  const data = await fetchTMDb<TMDbVideosResponse>(
    `/movie/${movieId}/videos`,
    {},
    DETAIL_CACHE_TIME,
  );
  return sortYouTubeVideos(data.results);
}

function sortYouTubeVideos(videos: TMDbVideo[]): TMDbVideo[] {
  const yt = videos.filter((v) => v.site === "YouTube");
  // 優先度: 公式Trailer > 公式Teaser > Trailer > Opening Credits > その他
  const order = ["Trailer", "Teaser", "Opening Credits", "Clip", "Featurette"];
  return yt.sort((a, b) => {
    const aScore = (a.official ? 10 : 0) + (10 - order.indexOf(a.type));
    const bScore = (b.official ? 10 : 0) + (10 - order.indexOf(b.type));
    return bScore - aScore;
  });
}
