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

/** 本番のウィジェット（action: "login"）を本番のドメインで解いた応答 */
const VALID = {
  success: true,
  action: "login",
  hostname: "aniflix.example",
};

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
  stubFetch(VALID);
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
      stubFetch(VALID);
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

  describe("action の照合", () => {
    it("action が login でなければ action-mismatch で弾く（開発環境でも）", async () => {
      stubFetch({ ...VALID, action: "signup" });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "action-mismatch",
      });
    });

    it("action が無ければ action-mismatch で弾く（fail-closed）", async () => {
      stubFetch({ success: true, hostname: "aniflix.example" });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "action-mismatch",
      });
    });

    it("success: false は action より先に invalid-token で弾く", async () => {
      stubFetch({ success: false, action: "login" });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "invalid-token",
      });
    });
  });

  describe("hostname の照合（本番）", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("許可リスト（環境変数）にあれば通す", async () => {
      vi.stubEnv(
        "TURNSTILE_ALLOWED_HOSTNAMES",
        "www.aniflix.example, aniflix.example",
      );
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: true,
        skipped: false,
      });
    });

    it("許可リストに無い hostname は hostname-mismatch で弾く", async () => {
      // 開発用ウィジェットを本番と使い回した設定事故で、localhost で解いたトークンが来た
      vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "aniflix.example");
      stubFetch({ ...VALID, hostname: "localhost" });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "hostname-mismatch",
      });
    });

    it("大文字小文字の違いは無視する", async () => {
      vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "ANIFLIX.example");
      const { verifyTurnstileToken } = await loadTurnstile();

      expect((await verifyTurnstileToken("token-abc")).ok).toBe(true);
    });

    it("許可リストが無ければ AUTH_URL のホスト名と照合する", async () => {
      vi.stubEnv("AUTH_URL", "https://aniflix.example/api/auth");
      const { verifyTurnstileToken } = await loadTurnstile();

      expect((await verifyTurnstileToken("token-abc")).ok).toBe(true);
    });

    it("どちらも無ければリクエストの Host と照合する（ポートは外す）", async () => {
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(
        (await verifyTurnstileToken("token-abc", undefined, "aniflix.example:443"))
          .ok,
      ).toBe(true);
      expect(
        await verifyTurnstileToken("token-abc", undefined, "evil.example"),
      ).toEqual({ ok: false, reason: "hostname-mismatch" });
    });

    it("x-forwarded-host が多段なら先頭（利用者が開いたホスト）を使う", async () => {
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(
        (
          await verifyTurnstileToken(
            "token-abc",
            undefined,
            "aniflix.example, internal-lb.local",
          )
        ).ok,
      ).toBe(true);
    });

    it("照合先が 1 つも決まらなければ弾く（fail-closed）", async () => {
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "hostname-mismatch",
      });
    });

    it("応答に hostname が無ければ弾く", async () => {
      vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "aniflix.example");
      stubFetch({ success: true, action: "login" });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "hostname-mismatch",
      });
    });

    it("弾いた時もトークンとシークレットをログに出さない", async () => {
      vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "aniflix.example");
      stubFetch({ ...VALID, hostname: "localhost" });
      const { verifyTurnstileToken } = await loadTurnstile();

      await verifyTurnstileToken("token-abc");

      const logged = vi
        .mocked(console.error)
        .mock.calls.flat()
        .map(String)
        .join(" ");
      expect(logged).not.toContain("token-abc");
      expect(logged).not.toContain(SECRET);
    });
  });

  describe("hostname の照合（開発環境）", () => {
    it("許可リストが無ければ照合しない（Cloudflare のテストキーは example.com を返す）", async () => {
      stubFetch({ ...VALID, hostname: "example.com" });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(
        (await verifyTurnstileToken("token-abc", undefined, "localhost:3000"))
          .ok,
      ).toBe(true);
    });

    it("許可リストを明示したら開発環境でも照合する", async () => {
      vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "localhost");
      stubFetch({ ...VALID, hostname: "example.com" });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "hostname-mismatch",
      });
    });
  });
});
