import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * 作品のキーワード ID（一覧フィルターのキーワード由来ジャンル用、#77）。
 *
 * TV と映画でレスポンスの形が違う（TV は `results`、映画は `keywords`）。
 * 検証対象は fetchTMDb が叩くパスとその読み分けなので、例外 1 に従い fetch をスタブする。
 */

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.TMDB_ACCESS_TOKEN = "test-token";
  vi.stubGlobal("fetch", (fetchMock = vi.fn()));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function requestedPath(): string {
  return new URL(String(fetchMock.mock.calls[0][0])).pathname;
}

describe("getAnimeKeywordIds", () => {
  it("/tv/{id}/keywords の results から ID を返す", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        id: 42,
        results: [
          { id: 1001, name: "isekai" },
          { id: 5, name: "magic" },
        ],
      }),
    );
    const { getAnimeKeywordIds } = await import("@/lib/tmdb");

    await expect(getAnimeKeywordIds(42)).resolves.toEqual([1001, 5]);
    expect(requestedPath()).toBe("/3/tv/42/keywords");
  });

  it("キーワードが無い作品は空配列", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 42 }));
    const { getAnimeKeywordIds } = await import("@/lib/tmdb");

    await expect(getAnimeKeywordIds(42)).resolves.toEqual([]);
  });
});

describe("getMovieKeywordIds", () => {
  it("/movie/{id}/keywords の keywords から ID を返す", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ id: 7, keywords: [{ id: 1001, name: "isekai" }] }),
    );
    const { getMovieKeywordIds } = await import("@/lib/tmdb");

    await expect(getMovieKeywordIds(7)).resolves.toEqual([1001]);
    expect(requestedPath()).toBe("/3/movie/7/keywords");
  });
});
