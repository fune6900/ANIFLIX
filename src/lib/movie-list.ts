// アニメ映画の最新作の専用ページ（/browse/movies/latest）の取得。
// ページの組み方は `list-page.ts`、ジャンル別は `genre-list.ts`（#99）

import { getLatestAnimeMovies } from "@/lib/tmdb";
import { LIST_PAGE_SIZE, loadListPage } from "@/lib/list-page";
import type { ListPage } from "@/lib/list-page";
import type { TMDbMovie } from "@/types/tmdb";

/** 1 ページの件数。TV の新着・トレンド一覧（`/browse/new` など）の 70 件に揃える */
export const MOVIE_LIST_PAGE_SIZE = LIST_PAGE_SIZE;

/** 最新作の専用ページ */
export const MOVIE_LATEST_LIST_HREF = "/browse/movies/latest";

/** ジャンルの専用ページ（アニメ映画） */
export function movieGenreListHref(genreId: number): string {
  return `/browse/movies/genre/${genreId}`;
}

export type MovieListPage = ListPage<TMDbMovie>;

/**
 * 最新作: ホームの「最新作」行と同じ取得（日本時間の今日以前に公開・公開日の新しい順）。
 * 行と同じくポスターの無い作品を落とすので、行の 20 件はこの一覧の先頭と一致する
 */
export function loadLatestMovieList(page: number): Promise<MovieListPage> {
  return loadListPage([(p) => getLatestAnimeMovies(p)], page, {
    keep: (m) => Boolean(m.poster_path),
  });
}
