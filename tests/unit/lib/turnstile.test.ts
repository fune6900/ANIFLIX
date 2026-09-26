import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

/**
 * Turnstile の検証ロジック。
 *
 * ここはグローバル `fetch` を直接スタブする。siteverify へ実際に送る body
 * （secret / response / remoteip）と、到達できなかった時に素通りさせない契約は
 * `fetch` に渡る `RequestInit` にしか現れず、`@/lib/turnstile` をモックすると
 * 検証対象ごと消えるため（`@.claude/rules/testing.md` モック方針の例外 3）。
 */

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const SECRET = "test-secret-key";

type FetchFn = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

let fetchMock: Mock<FetchFn>;

/** siteverify の応答を差し替える */
function stubFetch(body: unknown, init?: ResponseInit): void {
  fetchMock = vi.fn<FetchFn>(async () => Response.json(body, init));
  vi.stubGlobal("fetch", fetchMock);
}

/** 直近の fetch 呼び出しに渡された body を URLSearchParams として取り出す */
function lastBody(): URLSearchParams {
  const init = fetchMock.mock.calls.at(-1)?.[1];
  const body = init?.body;
  if (typeof body !== "string") {
    throw new Error("siteverify へ文字列 body が渡されていない");
  }
  return new URLSearchParams(body);
}

/** テスト対象は環境変数を実行時に読むため、毎回読み直させる */
async function loadTurnstile() {
  return import("@/lib/turnstile");
}

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", SECRET);
  vi.stubEnv("NODE_ENV", "test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  stubFetch({ success: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("verifyTurnstileToken", () => {
  describe("シークレット未設定時の挙動", () => {
    it("本番でシークレットが無ければ検証に失敗する（fail-closed）", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
      vi.stubEnv("NODE_ENV", "production");
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("any-token")).toEqual({
        ok: false,
        reason: "misconfigured",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("本番以外でシークレットが無ければ検証をスキップして通す", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
      vi.stubEnv("NODE_ENV", "development");
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("any-token")).toEqual({
        ok: true,
        skipped: true,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("シークレットが空白のみでも未設定として扱う", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "   ");
      vi.stubEnv("NODE_ENV", "development");
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("any-token")).toEqual({
        ok: true,
        skipped: true,
      });
    });

    it("シークレットが無ければトークンの有無を問わずスキップする", async () => {
      // 開発環境ではサイトキーも未設定でウィジェットが描画されず、
      // トークンは必ず空になる。トークン判定を先に置くと開発で詰む
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
      vi.stubEnv("NODE_ENV", "development");
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken(null)).toEqual({
        ok: true,
        skipped: true,
      });
    });
  });

  describe("トークンの受け取り", () => {
    it("トークンが null なら siteverify を呼ばずに失敗する", async () => {
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken(null)).toEqual({
        ok: false,
        reason: "missing-token",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("トークンが空文字でも missing-token として扱う", async () => {
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("")).toEqual({
        ok: false,
        reason: "missing-token",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("siteverify への送信内容", () => {
    it("公式エンドポイントへ urlencoded で POST する", async () => {
      const { verifyTurnstileToken } = await loadTurnstile();
      await verifyTurnstileToken("token-abc");

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(SITEVERIFY_URL);
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "Content-Type": "application/x-www-form-urlencoded",
      });
    });

    it("secret と response を body に載せる", async () => {
      const { verifyTurnstileToken } = await loadTurnstile();
      await verifyTurnstileToken("token-abc");

      const body = lastBody();
      expect(body.get("secret")).toBe(SECRET);
      expect(body.get("response")).toBe("token-abc");
    });

    it("remoteIp を渡した時だけ remoteip を載せる", async () => {
      const { verifyTurnstileToken } = await loadTurnstile();

      await verifyTurnstileToken("token-abc");
      expect(lastBody().has("remoteip")).toBe(false);

      await verifyTurnstileToken("token-abc", "203.0.113.7");
      expect(lastBody().get("remoteip")).toBe("203.0.113.7");
    });

    it("単回使用トークンがキャッシュに載らないよう no-store で呼ぶ", async () => {
      const { verifyTurnstileToken } = await loadTurnstile();
      await verifyTurnstileToken("token-abc");

      expect(fetchMock.mock.calls[0][1]?.cache).toBe("no-store");
    });
  });

  describe("siteverify の結果", () => {
    it("success: true なら通す", async () => {
      stubFetch({ success: true });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: true,
        skipped: false,
      });
    });

    it("success: false なら invalid-token で弾く", async () => {
      stubFetch({ success: false, "error-codes": ["timeout-or-duplicate"] });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "invalid-token",
      });
    });

    it("HTTP エラーなら素通りさせず network-error で弾く", async () => {
      stubFetch({ error: "boom" }, { status: 500 });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "network-error",
      });
    });

    it("fetch が reject しても throw せず network-error を返す", async () => {
      fetchMock = vi.fn<FetchFn>(async () => {
        throw new Error("ECONNREFUSED");
      });
      vi.stubGlobal("fetch", fetchMock);
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "network-error",
      });
    });

    it("タイムアウトでも throw せず network-error を返す", async () => {
      fetchMock = vi.fn<FetchFn>(async () => {
        const err = new Error("timed out");
        err.name = "TimeoutError";
        throw err;
      });
      vi.stubGlobal("fetch", fetchMock);
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "network-error",
      });
    });

    it("レスポンスが JSON でなくても throw せず network-error を返す", async () => {
      fetchMock = vi.fn<FetchFn>(async () => new Response("<html>502</html>"));
      vi.stubGlobal("fetch", fetchMock);
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "network-error",
      });
    });
  });

  describe("ログ", () => {
    it("シークレットとトークンをログに出さない", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      stubFetch({ success: false, "error-codes": ["invalid-input-response"] });
      const { verifyTurnstileToken } = await loadTurnstile();

      await verifyTurnstileToken("super-secret-token");

      const logged = errorSpy.mock.calls.flat().map(String).join(" ");
      expect(logged).not.toContain(SECRET);
      expect(logged).not.toContain("super-secret-token");
    });
  });
});
