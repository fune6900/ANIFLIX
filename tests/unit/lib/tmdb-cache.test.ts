import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * `@.claude/rules/api-design.md` のキャッシュ表を実行可能な契約として固定する。
 *
 * cacheTime が 0 の関数は `cache: "no-store"` になり、そのルート全体が動的
 * レンダリングへ落ちる。逆にユーザー入力を含むクエリをキャッシュすると、任意の
 * 入力がそのままキャッシュキーになり Data Cache が無制限に膨らむ。
 * どちらの事故も静かに起きるため、ここで方向を両方とも固定する。
 */

/** 直近の fetch 呼び出しから Next のキャッシュ指定を取り出す */
function cachePolicyOf(call: [string, RequestInit]): string {
  const init = call[1] as RequestInit & { next?: { revalidate?: number } };
  if (init.cache === "no-store") return "no-store";
  return `revalidate:${init.next?.revalidate}`;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.TMDB_ACCESS_TOKEN = "test-token";
  fetchMock = vi.fn(async () =>
    Response.json({ results: [], page: 1, total_pages: 0, total_results: 0 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** 対象の関数を呼び、その fetch に載ったキャッシュ指定を返す */
async function policyFor(
  run: (m: typeof import("@/lib/tmdb")) => Promise<unknown>,
): Promise<string> {
  const mod = await import("@/lib/tmdb");
  fetchMock.mockClear();
  await run(mod);
  const call = fetchMock.mock.calls[0] as [string, RequestInit];
  return cachePolicyOf(call);
}

describe("TMDb のキャッシュ方針", () => {
  it("詳細系はキャッシュする（動的ルートから毎回呼ばれるため）", async () => {
    expect(await policyFor((m) => m.getAnimeDetail(1429))).toBe(
      "revalidate:3600",
    );
    expect(await policyFor((m) => m.getMovieDetail(129))).toBe(
      "revalidate:3600",
    );
    expect(await policyFor((m) => m.getPersonDetail(1))).toBe(
      "revalidate:3600",
    );
    expect(await policyFor((m) => m.getAnimeSeasonEpisodes(1429, 1))).toBe(
      "revalidate:3600",
    );
    expect(await policyFor((m) => m.getAnimeVideos(1429))).toBe(
      "revalidate:3600",
    );
  });

  it("一覧 discover はキャッシュする", async () => {
    expect(await policyFor((m) => m.getPopularAnime(1))).toBe(
      "revalidate:1800",
    );
    expect(await policyFor((m) => m.getAnimeByEra(1990))).toBe(
      "revalidate:1800",
    );
    expect(await policyFor((m) => m.getAnimeMovies(1))).toBe("revalidate:1800");
    expect(await policyFor((m) => m.getAnimeByStudio(1, 1))).toBe(
      "revalidate:1800",
    );
    expect(await policyFor((m) => m.getAiringAnime(1))).toBe(
      "revalidate:1800",
    );
  });

  it("ユーザー入力を含むクエリは絶対にキャッシュしない", async () => {
    // 任意の入力がキャッシュキーになるため、Data Cache が無制限に膨張する
    expect(await policyFor((m) => m.searchAnime("進撃"))).toBe("no-store");
    expect(await policyFor((m) => m.searchPerson("花江"))).toBe("no-store");
    expect(await policyFor((m) => m.searchMovie("君の名は"))).toBe("no-store");
    expect(await policyFor((m) => m.discoverAnime({ genreId: 16 }))).toBe(
      "no-store",
    );
  });

  it("呼び出し側が明示した cacheTime を優先する", async () => {
    // seasonal-anime.ts は searchAnime に 86400 を渡してキャッシュさせている
    expect(await policyFor((m) => m.searchAnime("進撃", 86400))).toBe(
      "revalidate:86400",
    );
  });
});
