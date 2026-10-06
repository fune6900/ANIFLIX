import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * 制作会社別のアニメ（`/browse/studio/[id]`）の TMDb 呼び出し（#116）。
 * 検証対象は fetchTMDb が組み立てる URL なので、例外 1 に従い fetch をスタブする。
 */

let fetchMock: ReturnType<typeof vi.fn>;
let savedToken: string | undefined;

beforeEach(() => {
  savedToken = process.env.TMDB_ACCESS_TOKEN;
  process.env.TMDB_ACCESS_TOKEN = "test-token";
  fetchMock = vi.fn(async () =>
    Response.json({ results: [], page: 1, total_pages: 0, total_results: 0 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  // 他のテストファイルへトークンを漏らさない（未設定だった場合は消す）
  if (savedToken === undefined) delete process.env.TMDB_ACCESS_TOKEN;
  else process.env.TMDB_ACCESS_TOKEN = savedToken;
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function requested(
  run: (m: typeof import("@/lib/tmdb")) => Promise<unknown>,
): Promise<URLSearchParams> {
  const mod = await import("@/lib/tmdb");
  fetchMock.mockClear();
  await run(mod);
  return new URL(String(fetchMock.mock.calls[0][0])).searchParams;
}

describe("getAnimeByStudio", () => {
  it("日本のアニメ TV に絞る（海外の共同制作・吹替版を混ぜない）", async () => {
    const q = await requested((m) => m.getAnimeByStudio(21444, 2));

    expect(q.get("with_companies")).toBe("21444");
    expect(q.get("with_genres")).toBe("16");
    expect(q.get("with_origin_country")).toBe("JP");
    expect(q.get("sort_by")).toBe("popularity.desc");
    expect(q.get("page")).toBe("2");
  });
});
