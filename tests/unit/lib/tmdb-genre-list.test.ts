import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * ジャンル一覧（#99）で使う TMDb 呼び出しの組み立て。
 * 検証対象は fetchTMDb が組み立てる URL なので、例外 1 に従い fetch をスタブする。
 *
 * 一覧モード（`{ sort }` を渡す）:
 * - 放送開始日 / 公開日で並べる
 * - 今日（日本時間）より後に始まる作品（未放送・公開予定）を含めない
 * - vote_count の下限を付けない（票の少ない作品を取りこぼさない）
 * 渡さない場合（ホームの行・詳細の関連作品）は従来どおり人気順 + 下限あり。
 */

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.TMDB_ACCESS_TOKEN = "test-token";
  fetchMock = vi.fn(async () =>
    Response.json({ results: [], page: 1, total_pages: 0, total_results: 0 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ toFake: ["Date"] });
  // 2026-10-05 08:00 JST（UTC ではまだ 10-04）
  vi.setSystemTime(new Date("2026-10-04T23:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function query(
  run: (m: typeof import("@/lib/tmdb")) => Promise<unknown>,
): Promise<URLSearchParams> {
  const mod = await import("@/lib/tmdb");
  fetchMock.mockClear();
  await run(mod);
  return new URL(String(fetchMock.mock.calls[0][0])).searchParams;
}

describe("TV のジャンル（getAnimeByGenre）", () => {
  it("一覧モード: 放送開始日の新しい順・今日（日本時間）までに放送開始・票数の下限なし", async () => {
    const q = await query((m) =>
      m.getAnimeByGenre(35, 4, { sort: "year_desc" }),
    );

    expect(q.get("with_genres")).toBe("16,35");
    expect(q.get("with_origin_country")).toBe("JP");
    expect(q.get("sort_by")).toBe("first_air_date.desc");
    expect(q.get("first_air_date.lte")).toBe("2026-10-05");
    expect(q.has("vote_count.gte")).toBe(false);
    expect(q.get("page")).toBe("4");
  });

  it("一覧モード: 古い順", async () => {
    const q = await query((m) =>
      m.getAnimeByGenre(35, 1, { sort: "year_asc" }),
    );

    expect(q.get("sort_by")).toBe("first_air_date.asc");
    expect(q.get("first_air_date.lte")).toBe("2026-10-05");
  });

  it("一覧モードでなければ従来どおり（人気順・下限あり・日付で絞らない）", async () => {
    const q = await query((m) => m.getAnimeByGenre(35, 2));

    expect(q.get("sort_by")).toBe("popularity.desc");
    expect(q.get("vote_count.gte")).toBe("5");
    expect(q.has("first_air_date.lte")).toBe(false);
  });
});

describe("TV のキーワード（getAnimeByKeyword）", () => {
  it("一覧モード: ID の OR・放送開始日順・今日までに放送開始・下限なし", async () => {
    const q = await query((m) =>
      m.getAnimeByKeyword([10046, 10891], 2, { sort: "year_asc" }),
    );

    expect(q.get("with_keywords")).toBe("10046|10891");
    expect(q.get("with_genres")).toBe("16");
    expect(q.get("sort_by")).toBe("first_air_date.asc");
    expect(q.get("first_air_date.lte")).toBe("2026-10-05");
    expect(q.has("vote_count.gte")).toBe(false);
  });

  it("一覧モードでなければ従来どおり", async () => {
    const q = await query((m) => m.getAnimeByKeyword([10046], 1));

    expect(q.get("sort_by")).toBe("popularity.desc");
    expect(q.get("vote_count.gte")).toBe("5");
  });
});

describe("映画のジャンル（getAnimeMoviesByGenre）", () => {
  it("一覧モード: 公開日の新しい順・今日までに公開・除外ジャンルも渡せる", async () => {
    const q = await query((m) =>
      m.getAnimeMoviesByGenre(12, 3, [28], { sort: "year_desc" }),
    );

    expect(q.get("with_genres")).toBe("16,12");
    expect(q.get("without_genres")).toBe("28");
    expect(q.get("sort_by")).toBe("primary_release_date.desc");
    expect(q.get("primary_release_date.lte")).toBe("2026-10-05");
    expect(q.has("vote_count.gte")).toBe(false);
  });

  it("一覧モードでなければ従来どおり人気順", async () => {
    const q = await query((m) => m.getAnimeMoviesByGenre(28, 1));

    expect(q.get("sort_by")).toBe("popularity.desc");
    expect(q.has("primary_release_date.lte")).toBe(false);
  });
});

describe("映画のキーワード（getAnimeMovieByKeyword）", () => {
  it("一覧モード: 公開日の古い順・今日までに公開", async () => {
    const q = await query((m) =>
      m.getAnimeMovieByKeyword([292887], 1, { sort: "year_asc" }),
    );

    expect(q.get("with_keywords")).toBe("292887");
    expect(q.get("sort_by")).toBe("primary_release_date.asc");
    expect(q.get("primary_release_date.lte")).toBe("2026-10-05");
  });
});
