import { describe, it, expect, vi, afterEach } from "vitest";
import type { TMDbAnime } from "@/types/tmdb";

/**
 * `/browse/[category]` の取得（#76）。
 *
 * トレンド・新着は 1 ページ 70 件。TMDb の 1 ページは 20 件なので、
 * 「p ページ目 = 先頭から (p-1)*70 件目からの 70 件」を複数ページから切り出す。
 * 前後のページで作品が抜けたり重複したりしないことが要。
 * `@/lib/tmdb` は自前の lib なのでモックしてよい。
 */

const TMDB_PAGE = 20;

const getJapaneseTrendingAnime = vi.fn();
const getNewAnime = vi.fn();
const getPopularAnime = vi.fn();

vi.mock("@/lib/tmdb", () => ({
  TMDB_MAX_PAGE: 500,
  getJapaneseTrendingAnime: (p: number) => getJapaneseTrendingAnime(p),
  getNewAnime: (p: number) => getNewAnime(p),
  getPopularAnime: (p: number) => getPopularAnime(p),
}));

const { loadBrowseCategory, WIDE_PAGE_SIZE, isBrowseCategory } =
  await import("@/lib/browse-category");

function anime(id: number): TMDbAnime {
  return {
    id,
    name: `作品${id}`,
    original_name: `Work ${id}`,
    overview: "",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2026-01-01",
    vote_average: 7,
    vote_count: 10,
    genre_ids: [16],
    origin_country: ["JP"],
  };
}

/**
 * TMDb の 1 ページを、通し番号（0 始まり）を id に持つ作品で返す。
 * 通し番号が id なので、切り出しの抜け・重複がそのまま id の並びに出る
 */
function tmdbPage(totalResults: number) {
  return (p: number) => {
    const start = (p - 1) * TMDB_PAGE;
    const size = Math.max(0, Math.min(TMDB_PAGE, totalResults - start));
    return Promise.resolve({
      page: p,
      total_pages: Math.ceil(totalResults / TMDB_PAGE),
      total_results: totalResults,
      results: Array.from({ length: size }, (_, i) => anime(start + i)),
    });
  };
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from }, (_, i) => from + i);
}

afterEach(() => {
  getJapaneseTrendingAnime.mockReset();
  getNewAnime.mockReset();
  getPopularAnime.mockReset();
});

describe("isBrowseCategory", () => {
  it("popular / trending / new だけを受け付ける", () => {
    expect(isBrowseCategory("popular")).toBe(true);
    expect(isBrowseCategory("trending")).toBe(true);
    expect(isBrowseCategory("new")).toBe(true);
    expect(isBrowseCategory("constructor")).toBe(false);
    expect(isBrowseCategory("admin")).toBe(false);
  });
});

describe("loadBrowseCategory: トレンド・新着は 1 ページ 70 件", () => {
  it("1 ページ 70 件", () => {
    expect(WIDE_PAGE_SIZE).toBe(70);
  });

  it("1 ページ目は TMDb の 1〜4 ページから先頭 70 件", async () => {
    getJapaneseTrendingAnime.mockImplementation(tmdbPage(1000));

    const data = await loadBrowseCategory("trending", 1, 20);

    expect(getJapaneseTrendingAnime.mock.calls.map((c) => c[0]).sort()).toEqual(
      [1, 2, 3, 4],
    );
    expect(data.results.map((a) => a.id)).toEqual(range(0, 70));
  });

  it("2 ページ目は 70〜139 件目。1 ページ目との間に抜けも重複も無い", async () => {
    getJapaneseTrendingAnime.mockImplementation(tmdbPage(1000));

    const data = await loadBrowseCategory("trending", 2, 20);

    expect(getJapaneseTrendingAnime.mock.calls.map((c) => c[0]).sort()).toEqual(
      [4, 5, 6, 7],
    );
    expect(data.results.map((a) => a.id)).toEqual(range(70, 140));
  });

  it("3 ページ目は 140〜209 件目", async () => {
    getNewAnime.mockImplementation(tmdbPage(1000));

    const data = await loadBrowseCategory("new", 3, 20);

    expect(data.results.map((a) => a.id)).toEqual(range(140, 210));
  });

  it("デバイス別の件数（mobile=10 等）に切られない", async () => {
    getNewAnime.mockImplementation(tmdbPage(1000));

    const data = await loadBrowseCategory("new", 1, 10);

    expect(data.results).toHaveLength(70);
  });

  it("総ページ数は 70 件単位で数える", async () => {
    getNewAnime.mockImplementation(tmdbPage(1000));

    const data = await loadBrowseCategory("new", 1, 20);

    expect(data.totalPages).toBe(15); // ceil(1000 / 70)
    expect(data.totalResults).toBe(1000);
  });

  it("最終ページは残りの件数だけ", async () => {
    getNewAnime.mockImplementation(tmdbPage(100));

    const data = await loadBrowseCategory("new", 2, 20);

    expect(data.totalPages).toBe(2);
    expect(data.results.map((a) => a.id)).toEqual(range(70, 100));
  });

  it("TMDb の上限（500 ページ = 10000 件）を超えるページは取りに行かない", async () => {
    getNewAnime.mockImplementation(tmdbPage(100_000));

    const first = await loadBrowseCategory("new", 1, 20);
    expect(first.totalPages).toBe(Math.ceil(10_000 / 70));

    getNewAnime.mockClear();
    const beyond = await loadBrowseCategory("new", 400, 20);

    expect(getNewAnime.mock.calls.every((c) => c[0] <= 500)).toBe(true);
    // 範囲外は最終ページに丸め、空のページを出さない
    expect(beyond.page).toBe(first.totalPages);
    expect(beyond.results.length).toBeGreaterThan(0);
  });

  it("TMDb の 1 ページだけ落ちても、残りは正しい位置のまま返す", async () => {
    const ok = tmdbPage(1000);
    getNewAnime.mockImplementation((p: number) =>
      p === 2 ? Promise.reject(new Error("TMDb down")) : ok(p),
    );

    const data = await loadBrowseCategory("new", 1, 20);

    // 20〜39 件目（TMDb 2 ページ目）だけが欠け、後ろが前に詰まってずれない
    expect(data.results.map((a) => a.id)).toEqual([
      ...range(0, 20),
      ...range(40, 70),
    ]);
  });

  it("全ページ落ちたら throw する（呼び出し側でエラー表示）", async () => {
    getNewAnime.mockRejectedValue(new Error("TMDb down"));

    await expect(loadBrowseCategory("new", 1, 20)).rejects.toThrow();
  });

  it("同じ作品が隣のページにも返ってきたら 1 回だけ出す", async () => {
    // 人気順のページングは境界で順位が入れ替わり、同じ作品が 2 ページに出ることがある
    const ok = tmdbPage(1000);
    getJapaneseTrendingAnime.mockImplementation(async (p: number) => {
      const res = await ok(p);
      if (p === 2) res.results[0] = anime(19);
      return res;
    });

    const data = await loadBrowseCategory("trending", 1, 20);
    const ids = data.results.map((a) => a.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("loadBrowseCategory: 人気はデバイス別件数のまま", () => {
  it("TMDb 1 ページを取り、デバイス別の件数で切る", async () => {
    getPopularAnime.mockImplementation(tmdbPage(1000));

    const data = await loadBrowseCategory("popular", 3, 16);

    expect(getPopularAnime).toHaveBeenCalledTimes(1);
    expect(getPopularAnime).toHaveBeenCalledWith(3);
    expect(data.results).toHaveLength(16);
    expect(data.totalPages).toBe(50);
  });
});
