import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TMDbAnime, TMDbMovie } from "@/types/tmdb";
import type { DatedListOptions } from "@/lib/tmdb";
import { findEra } from "@/lib/eras";
import type { AnimeEra } from "@/lib/eras";

/**
 * 年代の一覧（/browse/era/[decade] と /browse/movies/era/[decade]）の取得（#100）。
 *
 * ページの組み方そのものは `list-page.test.ts` が受け持つ。ここでは
 * どの TMDb 関数をどの引数で呼ぶか（`@/lib/tmdb` は自前の lib なのでモック）と、
 * ポスターの無い作品を落とすことを見る。
 */

function anime(id: number, poster: string | null = `/p${id}.jpg`): TMDbAnime {
  return {
    id,
    name: `作品${id}`,
    original_name: `Work ${id}`,
    overview: "",
    poster_path: poster,
    backdrop_path: null,
    first_air_date: "1995-01-01",
    vote_average: 7,
    vote_count: 0,
    genre_ids: [16],
    origin_country: ["JP"],
  };
}

function movie(id: number, poster: string | null = `/p${id}.jpg`): TMDbMovie {
  return {
    id,
    title: `映画${id}`,
    original_title: `Movie ${id}`,
    overview: "",
    poster_path: poster,
    backdrop_path: null,
    release_date: "1995-01-01",
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
  getAnimeByEra: vi.fn(async (_d: number, p: number, _o?: DatedListOptions) =>
    one(p, [anime(1), anime(2, null), anime(3)]),
  ),
  getAnimeMoviesByEra: vi.fn(
    async (_d: number, p: number, _o?: DatedListOptions) =>
      one(p, [movie(11, null), movie(12)]),
  ),
};

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getAnimeByEra: (d: number, p: number, o?: DatedListOptions) =>
    tmdb.getAnimeByEra(d, p, o),
  getAnimeMoviesByEra: (d: number, p: number, o?: DatedListOptions) =>
    tmdb.getAnimeMoviesByEra(d, p, o),
}));

const { eraListHref, loadEraAnimeList, loadEraMovieList } =
  await import("@/lib/era-list");

beforeEach(() => {
  for (const fn of Object.values(tmdb)) fn.mockClear();
});

function era(decade: number): AnimeEra {
  const e = findEra(decade);
  if (!e) throw new Error(`unknown era ${decade}`);
  return e;
}

describe("eraListHref", () => {
  it("アニメと映画で同じ年代の一覧を指す", () => {
    expect(eraListHref("anime", 1990)).toBe("/browse/era/1990");
    expect(eraListHref("movie", 1990)).toBe("/browse/movies/era/1990");
  });

  it("並び替えを引き継ぐ（初期値は付けない）", () => {
    expect(eraListHref("movie", 2020, "year_asc")).toBe(
      "/browse/movies/era/2020?sort=year_asc",
    );
    expect(eraListHref("anime", 2020, "year_desc")).toBe("/browse/era/2020");
  });
});

describe("loadEraAnimeList: アニメ", () => {
  it("一覧モード（並び替え付き）で年代の TV を取り、ポスターの無い作品を落とす", async () => {
    const page = await loadEraAnimeList(era(1990), 1, "year_asc");

    expect(tmdb.getAnimeByEra).toHaveBeenCalledWith(1990, 1, {
      sort: "year_asc",
    });
    expect(page.results.map((a) => a.id)).toEqual([1, 3]);
    expect(page.totalResults).toBe(3);
  });
});

describe("loadEraMovieList: アニメ映画", () => {
  it("一覧モード（並び替え付き）で年代の映画を取り、ポスターの無い作品を落とす", async () => {
    const page = await loadEraMovieList(era(2020), 1, "year_desc");

    expect(tmdb.getAnimeMoviesByEra).toHaveBeenCalledWith(2020, 1, {
      sort: "year_desc",
    });
    expect(tmdb.getAnimeByEra).not.toHaveBeenCalled();
    expect(page.results.map((m) => m.id)).toEqual([12]);
  });
});
