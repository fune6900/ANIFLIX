import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * アニメ映画画面（#90）で使う TMDb 呼び出しの組み立て。
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
  vi.setSystemTime(new Date("2026-10-04T03:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** 対象の関数を呼び、最初の fetch の URL を返す */
async function requested(
  run: (m: typeof import("@/lib/tmdb")) => Promise<unknown>,
): Promise<URL> {
  const mod = await import("@/lib/tmdb");
  fetchMock.mockClear();
  await run(mod);
  return new URL(String(fetchMock.mock.calls[0][0]));
}

describe("アニメ映画の取得", () => {
  it("最新作: 公開済みの日本のアニメ映画を公開日の新しい順", async () => {
    const url = await requested((m) => m.getLatestAnimeMovies(2));
    const q = url.searchParams;

    expect(url.pathname).toBe("/3/discover/movie");
    expect(q.get("with_genres")).toBe("16");
    expect(q.get("with_origin_country")).toBe("JP");
    expect(q.get("sort_by")).toBe("primary_release_date.desc");
    // 公開予定日の作品で先頭が埋まらないよう、今日（日本時間）までに絞る
    expect(q.get("primary_release_date.lte")).toBe("2026-10-04");
    expect(q.get("page")).toBe("2");
  });

  it("最新作の「今日」は日本時間で数える", async () => {
    // 2026-10-05 08:00 JST = 2026-10-04 23:00 UTC
    vi.setSystemTime(new Date("2026-10-04T23:00:00Z"));
    const url = await requested((m) => m.getLatestAnimeMovies(1));

    expect(url.searchParams.get("primary_release_date.lte")).toBe("2026-10-05");
  });

  it("高評価: 評価順で、票数の少ない作品は除く", async () => {
    const q = (await requested((m) => m.getTopRatedAnimeMovies(1)))
      .searchParams;

    expect(q.get("sort_by")).toBe("vote_average.desc");
    expect(Number(q.get("vote_count.gte"))).toBeGreaterThanOrEqual(100);
    expect(q.get("with_genres")).toBe("16");
    expect(q.get("with_origin_country")).toBe("JP");
  });

  it("ジャンル: アニメーション AND 映画ジャンル", async () => {
    const q = (await requested((m) => m.getAnimeMoviesByGenre(28, 3)))
      .searchParams;

    expect(q.get("with_genres")).toBe("16,28");
    expect(q.get("with_origin_country")).toBe("JP");
    expect(q.get("page")).toBe("3");
  });

  it("スタジオ: 制作会社で絞ったアニメ映画", async () => {
    const url = await requested((m) => m.getAnimeMoviesByStudio(10342, 1));

    expect(url.pathname).toBe("/3/discover/movie");
    expect(url.searchParams.get("with_companies")).toBe("10342");
    expect(url.searchParams.get("with_genres")).toBe("16");
  });

  it("日本で上映中・公開予定は日本リージョンで取る", async () => {
    const playing = await requested((m) => m.getNowPlayingMovies(2));
    expect(playing.pathname).toBe("/3/movie/now_playing");
    expect(playing.searchParams.get("region")).toBe("JP");
    expect(playing.searchParams.get("page")).toBe("2");

    const upcoming = await requested((m) => m.getUpcomingMovies(1));
    expect(upcoming.pathname).toBe("/3/movie/upcoming");
    expect(upcoming.searchParams.get("region")).toBe("JP");
  });

  it("全世界の週間トレンドは映画のトレンドから取る", async () => {
    const url = await requested((m) => m.getTrendingMovies(5));

    expect(url.pathname).toBe("/3/trending/movie/week");
    expect(url.searchParams.get("page")).toBe("5");
  });

  it("映画の動画は映画のエンドポイントから取る（TV の ID と衝突させない）", async () => {
    const url = await requested((m) => m.getMovieVideos(129));

    expect(url.pathname).toBe("/3/movie/129/videos");
  });
});

describe("discoverAnimeMovie のジャンル", () => {
  it("TV 専用ジャンルは映画のジャンルに読み替える（そのままだと 0 件）", async () => {
    const q = (await requested((m) => m.discoverAnimeMovie({ genreId: 10759 })))
      .searchParams;

    expect(q.get("with_genres")).toBe("16,28");
  });

  it("映画と共通のジャンルはそのまま", async () => {
    const q = (await requested((m) => m.discoverAnimeMovie({ genreId: 35 })))
      .searchParams;

    expect(q.get("with_genres")).toBe("16,35");
  });
});
