import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * 年代の一覧（#100）で使う TMDb 呼び出しの組み立て。
 * 検証対象は fetchTMDb が組み立てる URL なので、例外 1 に従い fetch をスタブする。
 *
 * 一覧モード（`{ sort }` を渡す）:
 * - 放送開始日 / 公開日で並べる
 * - 期間は年代の 1 月 1 日〜12 月 31 日。ただし今日（日本時間）より後は含めない（未放送・公開予定を除く）
 * - vote_count の下限を付けない
 * 渡さない場合（ホームの年代行）は従来どおり人気順・年代の末日まで。
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

async function request(
  run: (m: typeof import("@/lib/tmdb")) => Promise<unknown>,
): Promise<URL> {
  const mod = await import("@/lib/tmdb");
  fetchMock.mockClear();
  await run(mod);
  return new URL(String(fetchMock.mock.calls[0][0]));
}

async function query(
  run: (m: typeof import("@/lib/tmdb")) => Promise<unknown>,
): Promise<URLSearchParams> {
  return (await request(run)).searchParams;
}

describe("TV の年代（getAnimeByEra）", () => {
  it("一覧モード: 年代の範囲・放送開始日の新しい順・票数の下限なし", async () => {
    const url = await request((m) =>
      m.getAnimeByEra(1990, 3, { sort: "year_desc" }),
    );
    const q = url.searchParams;

    expect(url.pathname).toBe("/3/discover/tv");
    expect(q.get("with_genres")).toBe("16");
    expect(q.get("with_origin_country")).toBe("JP");
    expect(q.get("first_air_date.gte")).toBe("1990-01-01");
    expect(q.get("first_air_date.lte")).toBe("1999-12-31");
    expect(q.get("sort_by")).toBe("first_air_date.desc");
    expect(q.has("vote_count.gte")).toBe(false);
    expect(q.get("page")).toBe("3");
  });

  it("一覧モード: 古い順", async () => {
    const q = await query((m) =>
      m.getAnimeByEra(1990, 1, { sort: "year_asc" }),
    );

    expect(q.get("sort_by")).toBe("first_air_date.asc");
  });

  it("一覧モード: 今の年代は今日（日本時間）までに放送開始した作品だけ（未放送を含めない）", async () => {
    const q = await query((m) =>
      m.getAnimeByEra(2020, 1, { sort: "year_desc" }),
    );

    expect(q.get("first_air_date.gte")).toBe("2020-01-01");
    expect(q.get("first_air_date.lte")).toBe("2026-10-05");
  });

  it("一覧モードでなければ従来どおり（ホームの行: 人気順・年代の末日まで・下限なし）", async () => {
    const q = await query((m) => m.getAnimeByEra(2020, 2));

    expect(q.get("sort_by")).toBe("popularity.desc");
    expect(q.get("first_air_date.lte")).toBe("2029-12-31");
    expect(q.has("vote_count.gte")).toBe(false);
  });
});

describe("映画の年代（getAnimeMoviesByEra）", () => {
  it("日本のアニメ映画を年代の範囲・公開日の新しい順で取る", async () => {
    const url = await request((m) =>
      m.getAnimeMoviesByEra(1980, 2, { sort: "year_desc" }),
    );
    const q = url.searchParams;

    expect(url.pathname).toBe("/3/discover/movie");
    expect(q.get("with_genres")).toBe("16");
    expect(q.get("with_origin_country")).toBe("JP");
    expect(q.get("primary_release_date.gte")).toBe("1980-01-01");
    expect(q.get("primary_release_date.lte")).toBe("1989-12-31");
    expect(q.get("sort_by")).toBe("primary_release_date.desc");
    expect(q.has("vote_count.gte")).toBe(false);
    expect(q.get("page")).toBe("2");
  });

  it("古い順", async () => {
    const q = await query((m) =>
      m.getAnimeMoviesByEra(1980, 1, { sort: "year_asc" }),
    );

    expect(q.get("sort_by")).toBe("primary_release_date.asc");
  });

  it("今の年代は今日（日本時間）までに公開した作品だけ（公開予定を含めない）", async () => {
    const q = await query((m) =>
      m.getAnimeMoviesByEra(2020, 1, { sort: "year_asc" }),
    );

    expect(q.get("primary_release_date.gte")).toBe("2020-01-01");
    expect(q.get("primary_release_date.lte")).toBe("2026-10-05");
  });
});
