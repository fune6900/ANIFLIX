// 映画を ContentRow のカードにする変換
//
// 映画のカードは必ず mediaType "movie" を付ける。付けないとホバープレビューが
// TV の動画エンドポイントを引き、同じ ID の別作品（TV アニメ）のトレーラーが出る。
// 映画を ContentRow に並べる画面はここを通すこと

import type { ContentRowItem } from "@/components/ContentRow";
import type { SeasonalEntry } from "@/lib/seasonal-anime";
import type { TMDbMovie } from "@/types/tmdb";

/** アニメ映画画面（/browse/movies）のカード */
export function toMovieCardItem(movie: TMDbMovie): ContentRowItem {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.release_date?.split("-")[0] || undefined,
    match:
      movie.vote_average > 0 ? Math.round(movie.vote_average * 10) : undefined,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    overview: movie.overview,
    href: `/movie/${movie.id}`,
    mediaType: "movie",
  };
}

/** 近日公開は年ではなく公開日を出す（「2026」だけでは近日の意味が無い） */
export function toUpcomingMovieCardItem(movie: TMDbMovie): ContentRowItem {
  const [, month, day] = movie.release_date?.split("-") ?? [];
  return {
    ...toMovieCardItem(movie),
    year: month && day ? `${Number(month)}/${Number(day)} 公開` : undefined,
  };
}

/** 映画詳細（/movie/[id]）の関連作品のカード。評価は ★ 表記 */
export function toRelatedMovieCardItem(movie: TMDbMovie): ContentRowItem {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.release_date?.split("-")[0],
    rating: movie.vote_average
      ? `★ ${movie.vote_average.toFixed(1)}`
      : undefined,
    posterPath: movie.poster_path ?? null,
    backdropPath: movie.backdrop_path ?? null,
    overview: movie.overview ?? undefined,
    href: `/movie/${movie.id}`,
    mediaType: "movie",
  };
}

/**
 * 一覧グリッド（SeasonAnimeCard）の 1 件。kind "movie" で映画の詳細ページへ飛び、
 * フィルターも映画の配信情報・キーワードを引く（TV の ID で引かない）
 */
export function toMovieEntry(movie: TMDbMovie): SeasonalEntry {
  return { kind: "movie", movie };
}
