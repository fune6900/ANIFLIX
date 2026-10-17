import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * 新着の取得基準（#76）: 「直近 7 日間に新エピソードが放送された作品」を人気順。
 *
 * 旧基準は「放送開始日が直近 3 ヶ月」で、継続中の作品が新しい話を出しても
 * 新着に入らなかった。TMDb の discover/tv は air_date（エピソードの放送日）で
 * 絞れるので、そこに 7 日の窓を当てる。
 * 検証対象は fetchTMDb が組み立てる URL なので、例外 1 に従い fetch をスタブする。
 */

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.TMDB_ACCESS_TOKEN = "test-token";
  fetchMock = vi.fn(async () =>
    Response.json({ results: [], page: 1, total_pages: 0, total_results: 0 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-30T03:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function requestedParams(page = 1): Promise<URLSearchParams> {
  const { getNewAnime } = await import("@/lib/tmdb");
  await getNewAnime(page);
  const url = new URL(String(fetchMock.mock.calls[0][0]));
  return url.searchParams;
}

describe("getNewAnime", () => {
  it("直近 7 日（今日を含む）にエピソードが放送された作品を取る", async () => {
    const q = await requestedParams();

    expect(q.get("air_date.gte")).toBe("2026-09-24");
    expect(q.get("air_date.lte")).toBe("2026-09-30");
  });

  it("日付は日本時間で数える（UTC だと 0〜9 時に 1 日ずれる）", async () => {
    // 2026-09-30 08:00 JST = 2026-09-29 23:00 UTC
    vi.setSystemTime(new Date("2026-09-29T23:00:00Z"));

    const q = await requestedParams();

    expect(q.get("air_date.lte")).toBe("2026-09-30");
    expect(q.get("air_date.gte")).toBe("2026-09-24");
  });

  it("放送開始日では絞らない（継続中の作品も新しい話が出れば新着）", async () => {
    const q = await requestedParams();

    expect(q.has("first_air_date.gte")).toBe(false);
    expect(q.has("first_air_date.lte")).toBe(false);
  });

  it("TMDb にも日本時間で解釈させる（air_date の境界を揃える）", async () => {
    const q = await requestedParams();

    expect(q.get("timezone")).toBe("Asia/Tokyo");
  });

  it("日本のアニメを人気順で取る", async () => {
    const q = await requestedParams();

    expect(q.get("with_genres")).toBe("16");
    expect(q.get("with_origin_country")).toBe("JP");
    expect(q.get("sort_by")).toBe("popularity.desc");
  });

  it("ページ番号をそのまま渡す", async () => {
    const q = await requestedParams(3);

    expect(q.get("page")).toBe("3");
  });
});
