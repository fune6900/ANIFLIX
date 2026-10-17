// アニメ映画画面（/browse/movies）の行を組み立てる

import {
  getAnimeMovieByKeywords,
  getAnimeMoviesByGenre,
  getAnimeMoviesByStudio,
  getLatestAnimeMovies,
  getNowPlayingMovies,
  getTopRatedAnimeMovies,
  getTrendingMovies,
  getUpcomingMovies,
} from "@/lib/tmdb";
import { ANIME_GENRES } from "@/lib/genres";
import type { AnimeGenre } from "@/lib/genres";
import { ANIME_STUDIOS } from "@/lib/studios";
import type { AnimeStudio } from "@/lib/studios";
import { movieGenreIdsFor } from "@/lib/movie-genres";
import { HOME_ROW_SIZE, randomPage, shuffle } from "@/lib/home-rows";
import type { TMDbMovie, TMDbSearchResponse } from "@/types/tmdb";

/** 最新作の件数。トップ画面の「新着アニメ」行（20 件）に合わせる */
export const MOVIE_LATEST_ROW_SIZE = 20;

/** TOP10 の件数 */
export const MOVIE_TOP_SIZE = 10;

/** ジャンル・高評価・劇場版の行の件数。トップ画面のジャンル行（30 件）に合わせる */
export const MOVIE_ROW_SIZE = HOME_ROW_SIZE;

/** スタジオ行の件数。12 スタジオぶん並ぶので TMDb 1 ページ（20 件）に留める */
export const MOVIE_STUDIO_ROW_SIZE = 20;

/** カルーセルの枚数（トップ画面と同じ） */
export const MOVIE_HERO_SIZE = 6;

/**
 * 全世界の週間トレンドで見るページ数。
 * 映画全体のうちアニメは 1 ページ 20 件に 2 件ほどしか無い。
 * 20 ページ（400 件）でアニメ映画が 40 件前後残る（2026-10-04 実測 41 件、うち日本 8 件）
 */
const WORLD_TRENDING_SCAN_PAGES = 20;

/**
 * 上映中・公開予定を見るページ数の上限。
 * 日本リージョンは上映中 5 ページ・公開予定 2 ページ（2026-10-04 実測）。
 * 全ページ見ないと人気順が狂うので、余裕を持たせた上限だけ置く
 */
const REGION_LIST_MAX_PAGES = 10;

/** 連続 2 ページの開始ページの上限（トップ画面のジャンル行と同じ） */
const MAX_START_PAGE = 2;

/**
 * TV アニメから続く劇場版を拾う TMDb キーワード（固定の語彙なので 24h キャッシュの解決でよい）。
 * 2026-10-04 実測で、エヴァ・ルパン・コナン・ドラえもん・ポケモンなどが並ぶ
 */
const THEATRICAL_KEYWORDS = ["based on anime", "based on tv series"];

const ANIMATION_GENRE_ID = 16;

function isAnimation(m: TMDbMovie): boolean {
  return m.genre_ids?.includes(ANIMATION_GENRE_ID) ?? false;
}

/** 日本時間の今日（YYYY-MM-DD）。公開日は日本の日付で比べる */
function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
}

/** 成功したページだけを並び順のまま繋ぎ、重複を落とす */
function mergePages(
  settled: PromiseSettledResult<TMDbSearchResponse<TMDbMovie>>[],
): TMDbMovie[] {
  const seen = new Set<number>();
  const out: TMDbMovie[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const m of r.value.results) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

/** 指定ページを並列に取って繋ぐ（落ちたページは飛ばす） */
async function fetchPages(
  fetchPage: (page: number) => Promise<TMDbSearchResponse<TMDbMovie>>,
  pages: number[],
): Promise<TMDbMovie[]> {
  return mergePages(await Promise.allSettled(pages.map(fetchPage)));
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}

/** 1 ページ目で総ページ数を知り、残りを並列で取る（上限 maxPages） */
async function fetchAllPages(
  fetchPage: (page: number) => Promise<TMDbSearchResponse<TMDbMovie>>,
  maxPages: number,
): Promise<TMDbMovie[]> {
  const first = await fetchPage(1);
  const last = Math.min(first.total_pages, maxPages);
  const rest = await Promise.allSettled(range(2, last).map(fetchPage));
  return mergePages([{ status: "fulfilled", value: first }, ...rest]);
}

/** 連続 2 ページ（開始はランダム）を取ってシャッフルし、1 行分に揃える */
async function fetchShuffledRow(
  fetchPage: (page: number) => Promise<TMDbSearchResponse<TMDbMovie>>,
): Promise<TMDbMovie[]> {
  const start = randomPage(MAX_START_PAGE);
  const pool = await fetchPages(fetchPage, [start, start + 1]);
  return shuffle(pool).slice(0, MOVIE_ROW_SIZE);
}

/** 最新作: 公開日の新しい順のまま（並びに意味があるので shuffle しない） */
export async function fetchLatestMovies(): Promise<TMDbMovie[]> {
  return (await fetchLatestPool()).slice(0, MOVIE_LATEST_ROW_SIZE);
}

/**
 * 最新作の候補（2 ページ）。公開直後の作品はポスター未登録が多いため、
 * ポスターの無い作品を落としてから 20 件に切る
 */
async function fetchLatestPool(): Promise<TMDbMovie[]> {
  const pool = await fetchPages(getLatestAnimeMovies, [1, 2]);
  return pool.filter((m) => m.poster_path);
}

/**
 * アニメ映画TOP10（日本）: 日本の劇場で上映中のアニメ映画を人気順に。
 * TMDb に日本の週間ランキングが無いための代用（上映作の入れ替わりで毎週変わる）
 */
export async function fetchJapanTop10(): Promise<TMDbMovie[]> {
  const playing = await fetchAllPages(
    getNowPlayingMovies,
    REGION_LIST_MAX_PAGES,
  );
  return playing
    .filter(isAnimation)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, MOVIE_TOP_SIZE);
}

/** アニメ映画TOP10（全世界）: 週間トレンドのアニメ映画（海外作品を含む）をトレンド順に */
export async function fetchWorldTop10(): Promise<TMDbMovie[]> {
  const trending = await fetchPages(
    getTrendingMovies,
    range(1, WORLD_TRENDING_SCAN_PAGES),
  );
  return trending.filter(isAnimation).slice(0, MOVIE_TOP_SIZE);
}

/** 近日公開: 日本で今日以降に公開されるアニメ映画を公開日が近い順に */
export async function fetchUpcomingMovies(): Promise<TMDbMovie[]> {
  const today = todayJst();
  const upcoming = await fetchAllPages(
    getUpcomingMovies,
    REGION_LIST_MAX_PAGES,
  );
  return (
    upcoming
      // TMDb の upcoming は公開済みの作品を数日残すことがある
      .filter((m) => isAnimation(m) && m.release_date >= today)
      .sort((a, b) => a.release_date.localeCompare(b.release_date))
      .slice(0, MOVIE_ROW_SIZE)
  );
}

/** 高評価の名作: 評価順のまま（ランキングとして読ませるので shuffle しない） */
export async function fetchTopRatedMovies(): Promise<TMDbMovie[]> {
  return (await fetchPages(getTopRatedAnimeMovies, [1, 2])).slice(
    0,
    MOVIE_ROW_SIZE,
  );
}

/** スタジオ 1 件分の行（人気順） */
export async function fetchStudioMovieRow(
  studio: AnimeStudio,
): Promise<TMDbMovie[]> {
  return (
    await fetchPages((p) => getAnimeMoviesByStudio(studio.id, p), [1])
  ).slice(0, MOVIE_STUDIO_ROW_SIZE);
}

/** TVシリーズの劇場版 */
export function fetchTheatricalRow(): Promise<TMDbMovie[]> {
  return fetchShuffledRow((p) =>
    getAnimeMovieByKeywords(THEATRICAL_KEYWORDS, p),
  );
}

/**
 * ジャンル 1 件分の行（30 件）。
 * - キーワード由来: キーワードで探す
 * - TMDb ジャンル: 映画のジャンルに読み替え、読み替え先が複数なら全部取って合わせる
 *   （with_genres では AND と OR を混ぜられない。`src/lib/movie-genres.ts`）
 */
export async function fetchMovieGenreRow(
  genre: AnimeGenre,
): Promise<TMDbMovie[]> {
  if (genre.filterType === "keyword" && genre.keyword) {
    const keywords = [genre.keyword, ...(genre.extraKeywords ?? [])];
    return fetchShuffledRow((p) => getAnimeMovieByKeywords(keywords, p));
  }
  const movieGenreIds = movieGenreIdsFor(genre.id);
  if (movieGenreIds.length === 1) {
    return fetchShuffledRow((p) => getAnimeMoviesByGenre(movieGenreIds[0], p));
  }
  // 読み替え先ごとに 1 ページずつ（2 ジャンル × 20 件で 1 行分に届く）
  const start = randomPage(MAX_START_PAGE);
  const pool = mergePages(
    await Promise.allSettled(
      movieGenreIds.map((id) => getAnimeMoviesByGenre(id, start)),
    ),
  );
  return shuffle(pool).slice(0, MOVIE_ROW_SIZE);
}

export interface StudioMovieRow {
  studio: AnimeStudio;
  movies: TMDbMovie[];
}

export interface GenreMovieRow {
  genre: AnimeGenre;
  movies: TMDbMovie[];
}

export interface AnimeMovieHome {
  /** カルーセル（最新作のうち背景画像・あらすじのある作品） */
  hero: TMDbMovie[];
  latest: TMDbMovie[];
  japanTop10: TMDbMovie[];
  worldTop10: TMDbMovie[];
  upcoming: TMDbMovie[];
  topRated: TMDbMovie[];
  /** `ANIME_STUDIOS` と同順 */
  studios: StudioMovieRow[];
  theatrical: TMDbMovie[];
  /** `ANIME_GENRES` と同順 */
  genres: GenreMovieRow[];
}

function valueOr<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === "fulfilled" ? r.value : fallback;
}

/** 失敗した行は [] に丸める（1 行の失敗でページ全体を落とさない） */
function orEmpty(p: Promise<TMDbMovie[]>): Promise<TMDbMovie[]> {
  return p.catch(() => []);
}

/** カルーセルに使える作品（名前・あらすじ・背景画像が揃っている） */
function isHeroReady(m: TMDbMovie): boolean {
  return Boolean(m.backdrop_path && m.title && m.overview);
}

/**
 * 画面の全行を並列に取る。各行は失敗しても空配列になり、ページは落ちない。
 *
 * カルーセルは最新作から選ぶ。公開直後の作品は背景画像・あらすじが未登録のことが多く、
 * 6 枚に満たない場合は上映中の TOP10（＝最近公開された作品）で補う
 */
export async function loadAnimeMovieHome(): Promise<AnimeMovieHome> {
  const [
    latestPool,
    japanTop10,
    worldTop10,
    upcoming,
    topRated,
    studios,
    theatrical,
    genres,
  ] = await Promise.allSettled([
    fetchLatestPool(),
    fetchJapanTop10(),
    fetchWorldTop10(),
    fetchUpcomingMovies(),
    fetchTopRatedMovies(),
    Promise.all(ANIME_STUDIOS.map((s) => orEmpty(fetchStudioMovieRow(s)))),
    fetchTheatricalRow(),
    Promise.all(ANIME_GENRES.map((g) => orEmpty(fetchMovieGenreRow(g)))),
  ]);

  const latestAll = valueOr(latestPool, []);
  const japan = valueOr(japanTop10, []);

  const heroSeen = new Set<number>();
  const hero = [...latestAll, ...japan]
    .filter((m) => {
      if (!isHeroReady(m) || heroSeen.has(m.id)) return false;
      heroSeen.add(m.id);
      return true;
    })
    .slice(0, MOVIE_HERO_SIZE);

  const studioRows = valueOr(studios, []);
  const genreRows = valueOr(genres, []);

  return {
    hero,
    latest: latestAll.slice(0, MOVIE_LATEST_ROW_SIZE),
    japanTop10: japan,
    worldTop10: valueOr(worldTop10, []),
    upcoming: valueOr(upcoming, []),
    topRated: valueOr(topRated, []),
    studios: ANIME_STUDIOS.map((studio, i) => ({
      studio,
      movies: studioRows[i] ?? [],
    })),
    theatrical: valueOr(theatrical, []),
    genres: ANIME_GENRES.map((genre, i) => ({
      genre,
      movies: genreRows[i] ?? [],
    })),
  };
}
