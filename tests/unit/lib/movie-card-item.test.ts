import { describe, it, expect } from "vitest";
import type { TMDbMovie } from "@/types/tmdb";
import {
  toMovieCardItem,
  toRelatedMovieCardItem,
  toUpcomingMovieCardItem,
} from "@/lib/movie-card-item";

/**
 * 映画を ContentRow のカードにする変換（#90 / PR #96 レビュー）。
 * 映画のカードは mediaType "movie" を持たないと、ホバープレビューが
 * 同じ ID の TV 作品のトレーラーを引く。使う画面:
 * - `/browse/movies`（toMovieCardItem / toUpcomingMovieCardItem）
 * - `/movie/[id]` の関連作品（toRelatedMovieCardItem）
 */

const MOVIE: TMDbMovie = {
  id: 129,
  title: "千と千尋の神隠し",
  original_title: "Spirited Away",
  overview: "あらすじ",
  poster_path: "/p.jpg",
  backdrop_path: "/b.jpg",
  release_date: "2001-07-20",
  vote_average: 8.5,
  vote_count: 18983,
  genre_ids: [16],
};

describe("映画のカード", () => {
  it("アニメ映画画面のカードは映画の詳細へ飛び、映画の動画を引く", () => {
    const item = toMovieCardItem(MOVIE);

    expect(item.href).toBe("/movie/129");
    expect(item.mediaType).toBe("movie");
    expect(item.year).toBe("2001");
    expect(item.match).toBe(85);
  });

  it("近日公開のカードは公開日を出し、映画の動画を引く", () => {
    const item = toUpcomingMovieCardItem({
      ...MOVIE,
      release_date: "2026-10-09",
    });

    expect(item.year).toBe("10/9 公開");
    expect(item.mediaType).toBe("movie");
  });

  it("映画詳細の関連作品のカードも映画の動画を引く", () => {
    const item = toRelatedMovieCardItem(MOVIE);

    expect(item.href).toBe("/movie/129");
    expect(item.mediaType).toBe("movie");
    expect(item.rating).toBe("★ 8.5");
  });
});
