import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TMDbAnime, TMDbMovie } from "@/types/tmdb";
import { findGenre, genreKeywordIds } from "@/lib/genres";
import type { AnimeGenre } from "@/lib/genres";

/**
 * ジャンルの一覧（/browse/genre/[id] と /browse/movies/genre/[id]）の取得（#99）。
 *
 * ページの組み方そのものは `list-page.test.ts` が受け持つ。ここでは
 * どの TMDb 関数をどの引数で呼ぶか（`@/lib/tmdb` は自前の lib なのでモック）と、
 * ポスターの無い作品を落とすことを見る。
 */

function anime(
  id: number,
  init: { poster?: string | null; date?: string } = {},
): TMDbAnime {
  return {
    id,
    name: `作品${id}`,
    original_name: `Work ${id}`,
    overview: "",
    poster_path: init.poster === undefined ? `/p${id}.jpg` : init.poster,
    backdrop_path: null,
    first_air_date: init.date ?? "2026-01-01",
    vote_average: 7,
    vote_count: 0,
    genre_ids: [16],
    origin_country: ["JP"],
  };
}

function movie(id: number, date: string): TMDbMovie {
  return {
    id,
    title: `映画${id}`,
    original_title: `Movie ${id}`,
    overview: "",
    poster_path: `/p${id}.jpg`,
    backdrop_path: null,
    release_date: date,
    vote_average: 7,
    vote_count: 0,
    genre_ids: [16],
  };
}

function one<T>(p: number, items: T[]) {
  return {
    page: p,
    total_pages: 1,
    total_results: items.length,
    results: p === 1 ? items : [],
  };
}

const tmdb = {
  getAnimeByGenre: vi.fn(async (_g: number, p: number, _o?: unknown) =>
    one(p, [anime(1), anime(2, { poster: null }), anime(3)]),
  ),
  getAnimeByKeyword: vi.fn(async (_ids: number[], p: number, _o?: unknown) =>
    one(p, [anime(11)]),
  ),
  getAnimeMoviesByGenre: vi.fn(
    async (g: number, p: number, _ex?: readonly number[], _o?: unknown) =>
      one(
        p,
        // 28 は奇数日、12 は偶数日に公開（どちらも新しい順）
        g === 28
          ? [movie(281, "2026-05-09"), movie(282, "2026-05-07")]
          : [movie(121, "2026-05-08"), movie(122, "2026-05-06")],
      ),
  ),
  getAnimeMovieByKeyword: vi.fn(
    async (_ids: number[], p: number, _o?: unknown) =>
      one(p, [movie(777, "2020-01-01")]),
  ),
};

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getAnimeByGenre: (g: number, p: number, o?: unknown) =>
    tmdb.getAnimeByGenre(g, p, o),
  getAnimeByKeyword: (ids: number[], p: number, o?: unknown) =>
    tmdb.getAnimeByKeyword(ids, p, o),
  getAnimeMoviesByGenre: (
    g: number,
    p: number,
    ex?: readonly number[],
    o?: unknown,
  ) => tmdb.getAnimeMoviesByGenre(g, p, ex, o),
  getAnimeMovieByKeyword: (ids: number[], p: number, o?: unknown) =>
    tmdb.getAnimeMovieByKeyword(ids, p, o),
}));

const { genreListHref, loadGenreAnimeList, loadGenreMovieList } =
  await import("@/lib/genre-list");

beforeEach(() => {
  for (const fn of Object.values(tmdb)) fn.mockClear();
});

function genre(id: number): AnimeGenre {
  const g = findGenre(id);
  if (!g) throw new Error(`unknown genre ${id}`);
  return g;
}

describe("genreListHref", () => {
  it("アニメと映画で同じジャンル ID の一覧を指す", () => {
    expect(genreListHref("anime", 35)).toBe("/browse/genre/35");
    expect(genreListHref("movie", 35)).toBe("/browse/movies/genre/35");
  });

  it("並び替えを引き継ぐ（初期値は付けない）", () => {
    expect(genreListHref("movie", 9002, "year_asc")).toBe(
      "/browse/movies/genre/9002?sort=year_asc",
    );
    expect(genreListHref("anime", 9002, "year_desc")).toBe(
      "/browse/genre/9002",
    );
  });
});

describe("loadGenreAnimeList: アニメ", () => {
  it("TMDb ジャンルは一覧モード（並び替え付き）で取り、ポスターの無い作品を落とす", async () => {
    const page = await loadGenreAnimeList(genre(35), 1, "year_asc");

    expect(tmdb.getAnimeByGenre).toHaveBeenCalledWith(35, 1, {
      sort: "year_asc",
    });
    expect(page.results.map((a) => a.id)).toEqual([1, 3]);
    expect(page.totalResults).toBe(3);
  });

  it("キーワード由来のジャンルは固定のキーワード ID で取る（名前で引かない）", async () => {
    const mecha = genre(9002);

    const page = await loadGenreAnimeList(mecha, 1, "year_desc");

    expect(tmdb.getAnimeByKeyword).toHaveBeenCalledWith(
      genreKeywordIds(mecha),
      1,
      { sort: "year_desc" },
    );
    expect(tmdb.getAnimeByGenre).not.toHaveBeenCalled();
    expect(page.results.map((a) => a.id)).toEqual([11]);
  });
});

describe("loadGenreMovieList: アニメ映画", () => {
  it("映画と共通の ID はそのジャンル 1 つで取る", async () => {
    await loadGenreMovieList(genre(35), 1, "year_desc");

    expect(tmdb.getAnimeMoviesByGenre).toHaveBeenCalledWith(35, 1, [], {
      sort: "year_desc",
    });
    expect(tmdb.getAnimeMoviesByGenre.mock.calls.every(([g]) => g === 35)).toBe(
      true,
    );
  });

  it("アクション・冒険は 28 ∪ 12（12 は 28 を除いた残り）を公開日で 1 本に並べる", async () => {
    const page = await loadGenreMovieList(genre(10759), 1, "year_desc");

    expect(tmdb.getAnimeMoviesByGenre).toHaveBeenCalledWith(28, 1, [], {
      sort: "year_desc",
    });
    expect(tmdb.getAnimeMoviesByGenre).toHaveBeenCalledWith(12, 1, [28], {
      sort: "year_desc",
    });
    expect(page.results.map((m) => m.id)).toEqual([281, 121, 282, 122]);
  });

  it("SF・ファンタジーは 878 ∪ 14（14 は 878 を除いた残り）で取る", async () => {
    await loadGenreMovieList(genre(10765), 1, "year_asc");

    expect(tmdb.getAnimeMoviesByGenre).toHaveBeenCalledWith(878, 1, [], {
      sort: "year_asc",
    });
    expect(tmdb.getAnimeMoviesByGenre).toHaveBeenCalledWith(14, 1, [878], {
      sort: "year_asc",
    });
  });

  it("キーワード由来のジャンルは固定のキーワード ID で取る", async () => {
    const isekai = genre(9001);

    const page = await loadGenreMovieList(isekai, 1, "year_desc");

    expect(tmdb.getAnimeMovieByKeyword).toHaveBeenCalledWith(
      genreKeywordIds(isekai),
      1,
      { sort: "year_desc" },
    );
    expect(tmdb.getAnimeMoviesByGenre).not.toHaveBeenCalled();
    expect(page.results.map((m) => m.id)).toEqual([777]);
  });
});
