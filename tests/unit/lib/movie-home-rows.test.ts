import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TMDbMovie, TMDbSearchResponse } from "@/types/tmdb";
import { ANIME_GENRES } from "@/lib/genres";
import { ANIME_STUDIOS } from "@/lib/studios";

/**
 * アニメ映画画面（#90）の行の組み立て。
 * `@/lib/tmdb` は自前の lib なのでモックする。
 */

interface MovieInit {
  genres?: number[];
  release?: string;
  popularity?: number;
  poster?: string | null;
}

function movie(id: number, init: MovieInit = {}): TMDbMovie {
  return {
    id,
    title: `映画${id}`,
    original_title: `Movie ${id}`,
    overview: "あらすじ",
    poster_path: init.poster === undefined ? `/p${id}.jpg` : init.poster,
    backdrop_path: `/b${id}.jpg`,
    release_date: init.release ?? "2026-01-01",
    vote_average: 7,
    vote_count: 100,
    genre_ids: init.genres ?? [16],
    popularity: init.popularity ?? 1,
    original_language: "ja",
  };
}

function response(
  results: TMDbMovie[],
  totalPages = 1,
): TMDbSearchResponse<TMDbMovie> {
  return {
    page: 1,
    total_pages: totalPages,
    total_results: results.length * totalPages,
    results,
  };
}

/** id = base + 0..19 の 20 件 */
function pageOf(base: number, init: MovieInit = {}) {
  return Array.from({ length: 20 }, (_, i) => movie(base + i, init));
}

const tmdb = {
  getLatestAnimeMovies: vi.fn(async (p: number) => response(pageOf(p * 100))),
  getNowPlayingMovies: vi.fn(async (_p: number) => response([])),
  getTrendingMovies: vi.fn(async (_p: number) => response([])),
  getUpcomingMovies: vi.fn(async (_p: number) => response([])),
  getTopRatedAnimeMovies: vi.fn(async (p: number) =>
    response(pageOf(p * 1000)),
  ),
  getAnimeMoviesByStudio: vi.fn(async (_c: number, p: number) =>
    response(pageOf(p * 2000)),
  ),
  getAnimeMoviesByGenre: vi.fn(async (g: number, p: number) =>
    response(pageOf(g * 10000 + p * 100)),
  ),
  getAnimeMovieByKeywords: vi.fn(async (_k: string[], p: number) =>
    response(pageOf(p * 3000)),
  ),
};

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb")>();
  return { ...actual, ...tmdb };
});

const rows = await import("@/lib/movie-home-rows");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T12:00:00+09:00"));
});

afterEach(() => {
  vi.useRealTimers();
  // mockReset は vi.fn(impl) の impl に戻す（テストごとの差し替えを残さない）
  vi.resetAllMocks();
});

describe("最新作", () => {
  it("トップ画面の新着行と同じ 20 件を公開日の新しい順のまま並べる", async () => {
    const latest = await rows.fetchLatestMovies();

    expect(rows.MOVIE_LATEST_ROW_SIZE).toBe(20);
    expect(latest).toHaveLength(20);
    // 1 ページ目（100〜119）が先頭から順に並ぶ
    expect(latest.map((m) => m.id).slice(0, 3)).toEqual([100, 101, 102]);
  });

  it("ポスターの無い作品は行に出さない（2 ページ目で補う）", async () => {
    tmdb.getLatestAnimeMovies.mockImplementation(async (p: number) =>
      response(
        pageOf(p * 100).map((m, i) =>
          p === 1 && i % 2 === 0 ? { ...m, poster_path: null } : m,
        ),
      ),
    );

    const latest = await rows.fetchLatestMovies();

    expect(latest).toHaveLength(20);
    expect(latest.every((m) => m.poster_path)).toBe(true);
  });
});

describe("アニメ映画TOP10（日本）", () => {
  it("上映中の全ページからアニメだけを人気順に 10 件", async () => {
    tmdb.getNowPlayingMovies.mockImplementation(async (p: number) =>
      response(
        Array.from({ length: 20 }, (_, i) =>
          movie(p * 100 + i, {
            // 奇数番目は実写
            genres: i % 2 === 0 ? [16] : [28],
            popularity: p * 100 + i,
          }),
        ),
        3,
      ),
    );

    const top = await rows.fetchJapanTop10();

    expect(tmdb.getNowPlayingMovies).toHaveBeenCalledTimes(3);
    expect(top).toHaveLength(10);
    expect(top.every((m) => m.genre_ids.includes(16))).toBe(true);
    // 人気順（3 ページ目の 318 が最も人気）
    expect(top[0].id).toBe(318);
    const pops = top.map((m) => m.popularity ?? 0);
    expect([...pops].sort((a, b) => b - a)).toEqual(pops);
  });
});

describe("アニメ映画TOP10（全世界）", () => {
  it("週間トレンドの 20 ページからアニメ（海外作品を含む）をトレンド順に 10 件", async () => {
    tmdb.getTrendingMovies.mockImplementation(async (p: number) =>
      response([
        movie(p * 10, { genres: [28] }),
        {
          ...movie(p * 10 + 1, { genres: [16, 10751] }),
          original_language: "en",
        },
      ]),
    );

    const top = await rows.fetchWorldTop10();

    expect(tmdb.getTrendingMovies).toHaveBeenCalledTimes(20);
    expect(top.map((m) => m.id)).toEqual([
      11, 21, 31, 41, 51, 61, 71, 81, 91, 101,
    ]);
  });
});

describe("近日公開", () => {
  it("今日以降に公開されるアニメを公開日が近い順に並べる", async () => {
    tmdb.getUpcomingMovies.mockImplementation(async (p: number) =>
      p === 1
        ? response(
            [
              movie(1, { release: "2026-10-23" }),
              movie(2, { release: "2026-10-09" }),
              movie(3, { release: "2026-10-16", genres: [18] }),
              // 公開済み（upcoming に残っていても出さない）
              movie(4, { release: "2026-10-01" }),
            ],
            2,
          )
        : response([movie(5, { release: "2026-10-04" })], 2),
    );

    const upcoming = await rows.fetchUpcomingMovies();

    expect(upcoming.map((m) => m.id)).toEqual([5, 2, 1]);
  });
});

describe("ジャンル別", () => {
  it("トップ画面のジャンル行と同じ 30 件", async () => {
    const comedy = ANIME_GENRES.find((g) => g.id === 35);
    if (!comedy) throw new Error("コメディが定義に無い");

    const row = await rows.fetchMovieGenreRow(comedy);

    expect(rows.MOVIE_ROW_SIZE).toBe(30);
    expect(row).toHaveLength(30);
  });

  it("TV 専用ジャンルは読み替えた映画ジャンルを全部見る", async () => {
    const action = ANIME_GENRES.find((g) => g.id === 10759);
    if (!action) throw new Error("アクション・冒険が定義に無い");

    await rows.fetchMovieGenreRow(action);

    const asked = new Set(
      tmdb.getAnimeMoviesByGenre.mock.calls.map((c) => c[0]),
    );
    expect(asked).toEqual(new Set([28, 12]));
  });

  it("キーワード由来のジャンルはキーワードで探す", async () => {
    const isekai = ANIME_GENRES.find((g) => g.id === 9001);
    if (!isekai) throw new Error("異世界転生が定義に無い");

    const row = await rows.fetchMovieGenreRow(isekai);

    expect(tmdb.getAnimeMovieByKeywords).toHaveBeenCalled();
    expect(tmdb.getAnimeMovieByKeywords.mock.calls[0][0]).toContain("isekai");
    expect(row.length).toBeGreaterThan(0);
  });
});

describe("loadAnimeMovieHome", () => {
  it("スタジオ・ジャンルは定義の全件ぶん、定義の順に行を作る", async () => {
    const home = await rows.loadAnimeMovieHome();

    expect(home.studios.map((s) => s.studio.id)).toEqual(
      ANIME_STUDIOS.map((s) => s.id),
    );
    expect(home.genres.map((g) => g.genre.id)).toEqual(
      ANIME_GENRES.map((g) => g.id),
    );
    expect(home.topRated.length).toBeGreaterThan(0);
    expect(home.theatrical.length).toBeGreaterThan(0);
  });

  it("1 つの取得が落ちても他の行は出す", async () => {
    tmdb.getTopRatedAnimeMovies.mockRejectedValue(new Error("boom"));
    tmdb.getTrendingMovies.mockRejectedValue(new Error("boom"));

    const home = await rows.loadAnimeMovieHome();

    expect(home.topRated).toEqual([]);
    expect(home.worldTop10).toEqual([]);
    expect(home.latest).toHaveLength(20);
  });

  it("カルーセルは最新作のうち背景画像とあらすじのある 6 件", async () => {
    const home = await rows.loadAnimeMovieHome();

    expect(home.hero).toHaveLength(6);
    expect(home.hero.every((m) => m.backdrop_path && m.overview)).toBe(true);
    expect(home.hero[0].id).toBe(home.latest[0].id);
  });
});
