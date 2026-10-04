// ジャンルの一覧（/browse/genre/[id] と /browse/movies/genre/[id]）の取得（#99）

import {
  getAnimeByGenre,
  getAnimeByKeyword,
  getAnimeMovieByKeyword,
  getAnimeMoviesByGenre,
} from "@/lib/tmdb";
import { byDate, hasPoster, loadListPage } from "@/lib/list-page";
import type { ListPage, ListSource } from "@/lib/list-page";
import { genreKeywordIds } from "@/lib/genres";
import type { AnimeGenre } from "@/lib/genres";
import { movieGenreIdsFor } from "@/lib/movie-genres";
import { withSort } from "@/lib/list-sort";
import type { ListMediaType, ListSort } from "@/lib/list-sort";
import type { TMDbAnime, TMDbMovie } from "@/types/tmdb";

/** ジャンルの一覧のパス。アニメと映画で同じジャンル ID を使う */
export function genreListHref(
  media: ListMediaType,
  genreId: number,
  sort?: ListSort,
): string {
  const path =
    media === "movie"
      ? `/browse/movies/genre/${genreId}`
      : `/browse/genre/${genreId}`;
  return sort ? withSort(path, sort) : path;
}

/**
 * アニメのジャンルの一覧。
 * - TMDb ジャンル: そのジャンルを 1 本
 * - キーワード由来: 固定のキーワード ID（同義語込み）の OR を 1 本
 * `genre` は `findGenre()` で照合済みのもの、`sort` は `parseListSort()` を通したものだけを渡す
 */
export function loadGenreAnimeList(
  genre: AnimeGenre,
  page: number,
  sort: ListSort,
): Promise<ListPage<TMDbAnime>> {
  const source: ListSource<TMDbAnime> =
    genre.filterType === "keyword"
      ? (p) => getAnimeByKeyword(genreKeywordIds(genre), p, { sort })
      : (p) => getAnimeByGenre(genre.id, p, { sort });
  return loadListPage([source], page, { keep: hasPoster });
}

/**
 * アニメ映画のジャンルの一覧。
 * - キーワード由来: 固定のキーワード ID の OR を 1 本
 * - TMDb ジャンル: 映画のジャンルに読み替え、読み替え先が複数なら合併
 *   （28 ∪ 12 を「28」と「12 から 28 を除いた残り」に割る。`with_genres` は AND と OR を混ぜられない）。
 *   合併は公開日で 1 本に並べる（`loadListPage` がページの境目を二分探索で決める）
 */
export function loadGenreMovieList(
  genre: AnimeGenre,
  page: number,
  sort: ListSort,
): Promise<ListPage<TMDbMovie>> {
  const options = { sort };
  const sources: ListSource<TMDbMovie>[] =
    genre.filterType === "keyword"
      ? [(p) => getAnimeMovieByKeyword(genreKeywordIds(genre), p, options)]
      : movieGenreIdsFor(genre.id).map(
          (id, i, ids) => (p: number) =>
            getAnimeMoviesByGenre(id, p, ids.slice(0, i), options),
        );
  return loadListPage(sources, page, {
    keep: hasPoster,
    compare: byDate(
      (m) => m.release_date,
      sort === "year_asc" ? "asc" : "desc",
    ),
  });
}
