import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TMDbMovie } from "@/types/tmdb";

/**
 * アニメ映画の最新作の専用ページの取得（#91）。
 *
 * ページの組み方は `list-page.test.ts`、ジャンル別は `genre-list.test.ts`（#99）が受け持つ。
 * どの TMDb 関数を呼ぶかは `@/lib/tmdb` をモックして確かめる（自前の lib）。
 */

interface MovieInit {
  popularity?: number;
  poster?: string | null;
  release?: string;
}

function movie(id: number, init: MovieInit = {}): TMDbMovie {
  return {
    id,
    title: `映画${id}`,
    original_title: `Movie ${id}`,
    overview: "",
    poster_path: init.poster === undefined ? `/p${id}.jpg` : init.poster,
    backdrop_path: null,
    release_date: init.release ?? "2026-01-01",
    vote_average: 7,
    vote_count: 10,
    genre_ids: [16],
    popularity: init.popularity ?? 1,
  };
}

const tmdb = {
  getLatestAnimeMovies: vi.fn(async (p: number) => ({
    page: p,
    total_pages: 1,
    total_results: 3,
    results:
      p === 1
        ? [
            movie(1, { release: "2026-10-03" }),
            movie(2, { release: "2026-10-02", poster: null }),
            movie(3, { release: "2026-10-01" }),
          ]
        : [],
  })),
};

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getLatestAnimeMovies: (p: number) => tmdb.getLatestAnimeMovies(p),
}));

const {
  MOVIE_LIST_PAGE_SIZE,
  loadLatestMovieList,
} = await import("@/lib/movie-list");

beforeEach(() => {
  for (const fn of Object.values(tmdb)) fn.mockClear();
});

describe("1 ページの件数", () => {
  it("TV の新着一覧（/browse/new）と同じ 70 件", () => {
    expect(MOVIE_LIST_PAGE_SIZE).toBe(70);
  });
});

describe("loadLatestMovieList: 最新作", () => {
  it("行と同じ取得（今日以前に公開・公開日の新しい順）を使い、ポスターの無い作品を落とす", async () => {
    const page = await loadLatestMovieList(1);

    expect(tmdb.getLatestAnimeMovies).toHaveBeenCalledWith(1);
    expect(page.results.map((m) => m.id)).toEqual([1, 3]);
  });
});
