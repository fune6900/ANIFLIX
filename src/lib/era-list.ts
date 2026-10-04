// 年代の一覧（/browse/era/[decade] と /browse/movies/era/[decade]）の取得（#100）

import { getAnimeByEra, getAnimeMoviesByEra } from "@/lib/tmdb";
import { hasPoster, loadListPage } from "@/lib/list-page";
import type { ListPage } from "@/lib/list-page";
import type { AnimeEra } from "@/lib/eras";
import { withSort } from "@/lib/list-sort";
import type { ListMediaType, ListSort } from "@/lib/list-sort";
import type { TMDbAnime, TMDbMovie } from "@/types/tmdb";

/** 年代の一覧のパス。アニメと映画で同じ年代（ANIME_ERAS）を使う */
export function eraListHref(
  media: ListMediaType,
  decade: number,
  sort?: ListSort,
): string {
  const path =
    media === "movie"
      ? `/browse/movies/era/${decade}`
      : `/browse/era/${decade}`;
  return sort ? withSort(path, sort) : path;
}

/**
 * アニメ（TV）の年代の一覧。放送開始日順・未放送を除く・ポスターの無い作品を落とす。
 * `era` は `findEra()` で照合済みのもの、`sort` は `parseListSort()` を通したものだけを渡す
 */
export function loadEraAnimeList(
  era: AnimeEra,
  page: number,
  sort: ListSort,
): Promise<ListPage<TMDbAnime>> {
  return loadListPage<TMDbAnime>(
    [(p) => getAnimeByEra(era.decade, p, { sort })],
    page,
    { keep: hasPoster },
  );
}

/** アニメ映画の年代の一覧。公開日順・公開予定を除く・ポスターの無い作品を落とす */
export function loadEraMovieList(
  era: AnimeEra,
  page: number,
  sort: ListSort,
): Promise<ListPage<TMDbMovie>> {
  return loadListPage<TMDbMovie>(
    [(p) => getAnimeMoviesByEra(era.decade, p, { sort })],
    page,
    { keep: hasPoster },
  );
}
