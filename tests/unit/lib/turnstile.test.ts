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

/** Cloudflare 公式テストキーの実際の応答（action を返さず、hostname は example.com） */
const TEST_KEY_RESPONSE = {
  success: true,
  "error-codes": [],
  hostname: "example.com",
  metadata: { result_with_testing_key: true },
};

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
    beforeEach(() => {
      vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "aniflix.example");
    });

    it("action が login でなければ action-mismatch で弾く", async () => {
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

    it("攻撃者が決められる action の値を長いままログに出さない", async () => {
      stubFetch({ ...VALID, action: "x".repeat(200) });
      const { verifyTurnstileToken } = await loadTurnstile();

      await verifyTurnstileToken("token-abc");

      const logged = vi
        .mocked(console.error)
        .mock.calls.flat()
        .map(String)
        .join(" ");
      expect(logged).not.toContain("x".repeat(33));
    });
  });

  describe("hostname の照合", () => {
    it("許可リストにあれば通す（大文字小文字は無視）", async () => {
      vi.stubEnv(
        "TURNSTILE_ALLOWED_HOSTNAMES",
        "www.aniflix.example, ANIFLIX.example",
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

    it("応答に hostname が無ければ弾く", async () => {
      vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "aniflix.example");
      stubFetch({ success: true, action: "login" });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "hostname-mismatch",
      });
    });

    it.each([
      ["スキーム付き", "https://aniflix.example"],
      ["スキームとパス付き", "https://aniflix.example/login"],
      ["末尾ドット付き", "aniflix.example."],
      ["ポート付き", "aniflix.example:443"],
    ])("許可リストの値が %s でも読める", async (_label, raw) => {
      vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", raw);
      const { verifyTurnstileToken } = await loadTurnstile();

      expect((await verifyTurnstileToken("token-abc")).ok).toBe(true);
    });

    it("応答の hostname の末尾ドットも無視する", async () => {
      vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "aniflix.example");
      stubFetch({ ...VALID, hostname: "aniflix.example." });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect((await verifyTurnstileToken("token-abc")).ok).toBe(true);
    });

    it("許可リストが設定されているのに有効な値が 1 つも無ければ misconfigured", async () => {
      vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", " , ,");
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "misconfigured",
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

  describe("本番は許可リストが必須", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("許可リストが無ければ misconfigured で弾く（Host ヘッダーは攻撃者が書けるので頼らない）", async () => {
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "misconfigured",
      });
    });

    it("AUTH_URL があっても許可リストの代わりにしない（www・プレビューで締め出すため）", async () => {
      vi.stubEnv("AUTH_URL", "https://aniflix.example/api/auth");
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "misconfigured",
      });
    });

    it("許可リストがあれば照合して通す", async () => {
      vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "aniflix.example");
      const { verifyTurnstileToken } = await loadTurnstile();

      expect((await verifyTurnstileToken("token-abc")).ok).toBe(true);
    });

    it("テストキーの応答は本番では misconfigured で弾く", async () => {
      vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "aniflix.example");
      stubFetch(TEST_KEY_RESPONSE);
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "misconfigured",
      });
    });
  });

  describe("開発環境", () => {
    it("Cloudflare 公式テストキーの応答（action 無し・hostname は example.com）で通す", async () => {
      // 実際の応答: success: true, hostname: example.com, action 無し,
      // metadata.result_with_testing_key: true
      stubFetch(TEST_KEY_RESPONSE);
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: true,
        skipped: false,
      });
    });

    it("許可リストを明示しなければ hostname を照合しない", async () => {
      stubFetch({ ...VALID, hostname: "localhost" });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect((await verifyTurnstileToken("token-abc")).ok).toBe(true);
    });

    it("許可リストを明示したら開発環境でも照合する", async () => {
      vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "aniflix.example");
      stubFetch({ ...VALID, hostname: "localhost" });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "hostname-mismatch",
      });
    });

    it("本物のキーの応答なら開発環境でも action を照合する", async () => {
      stubFetch({ ...VALID, action: "signup" });
      const { verifyTurnstileToken } = await loadTurnstile();

      expect(await verifyTurnstileToken("token-abc")).toEqual({
        ok: false,
        reason: "action-mismatch",
      });
    });
  });
});
