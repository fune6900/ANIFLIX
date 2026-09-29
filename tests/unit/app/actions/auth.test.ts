import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TurnstileVerdict } from "@/lib/turnstile";

/**
 * ログイン用 Server Action のゲート契約。
 *
 * `@/auth` のモックは `tests/unit/middleware.test.ts` と同じ理由
 * （Auth.js 本体は Vitest 環境で解決できず、検証対象でもない）。
 *
 * `@/lib/turnstile` のモックは**引数をそのまま透過させる**こと。
 * 引数を捨てると「何を検証に渡したか」を確かめられず、フォームの値を
 * 読み違えても戻り値だけでテストが通ってしまう。
 */

const signIn = vi.fn();
const signOut = vi.fn();
const verifyTurnstileToken =
  vi.fn<
    (
      token: string | null,
      remoteIp?: string,
      requestHost?: string,
    ) => Promise<TurnstileVerdict>
  >();

/** `next/headers` が返す x-forwarded-for。null ならヘッダー自体が無い */
let forwardedFor: string | null = null;
/** `next/headers` が返す x-forwarded-host / host。null ならヘッダー自体が無い */
let forwardedHost: string | null = null;
let host: string | null = null;

vi.mock("@/auth", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  signOut: (...args: unknown[]) => signOut(...args),
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: (
    token: string | null,
    remoteIp?: string,
    requestHost?: string,
  ) => verifyTurnstileToken(token, remoteIp, requestHost),
}));

vi.mock("next/headers", () => ({
  headers: async () => {
    const h = new Headers();
    if (forwardedFor !== null) h.set("x-forwarded-for", forwardedFor);
    if (forwardedHost !== null) h.set("x-forwarded-host", forwardedHost);
    if (host !== null) h.set("host", host);
    return h;
  },
}));

const { signInWithTurnstileAction, signOutAction } =
  await import("@/app/actions/auth");
const { LOGIN_INITIAL_STATE } = await import("@/lib/login-action");

/** トークン入りのフォーム送信を組み立てる */
function formWithToken(token?: string): FormData {
  const form = new FormData();
  if (token !== undefined) form.set("cf-turnstile-response", token);
  return form;
}

beforeEach(() => {
  forwardedFor = "203.0.113.7, 10.0.0.1";
  forwardedHost = null;
  host = null;
  verifyTurnstileToken.mockResolvedValue({ ok: true, skipped: false });
  signIn.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("signInWithTurnstileAction", () => {
  describe("検証へ渡す値", () => {
    it("フォームのトークンをそのまま検証へ渡す", async () => {
      await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(verifyTurnstileToken).toHaveBeenCalledWith(
        "token-abc",
        "203.0.113.7",
        undefined,
      );
    });

    it("x-forwarded-for が多段でも先頭の IP だけを渡す", async () => {
      // プロキシが連ねた中継 IP を混ぜないこと
      forwardedFor = "203.0.113.7, 10.0.0.1, 10.0.0.2";

      await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(verifyTurnstileToken).toHaveBeenCalledWith(
        "token-abc",
        "203.0.113.7",
        undefined,
      );
    });

    it("x-forwarded-for が 1 件だけでもそのまま渡す", async () => {
      forwardedFor = "198.51.100.42";

      await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(verifyTurnstileToken).toHaveBeenCalledWith(
        "token-abc",
        "198.51.100.42",
        undefined,
      );
    });

    it("x-forwarded-for の前後の空白を落とす", async () => {
      forwardedFor = "   198.51.100.42   , 10.0.0.1";

      await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(verifyTurnstileToken).toHaveBeenCalledWith(
        "token-abc",
        "198.51.100.42",
        undefined,
      );
    });

    it("x-forwarded-for が無ければ IP を渡さない", async () => {
      forwardedFor = null;

      await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(verifyTurnstileToken).toHaveBeenCalledWith(
        "token-abc",
        undefined,
        undefined,
      );
    });

    it("x-forwarded-for が空文字でも IP を渡さない", async () => {
      forwardedFor = "";

      await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(verifyTurnstileToken).toHaveBeenCalledWith(
        "token-abc",
        undefined,
        undefined,
      );
    });

    it("トークン欄が無ければ null を渡す", async () => {
      verifyTurnstileToken.mockResolvedValue({
        ok: false,
        reason: "missing-token",
      });

      await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken(),
      );

      expect(verifyTurnstileToken).toHaveBeenCalledWith(null, "203.0.113.7", undefined);
    });

    it("トークン欄が空文字なら null に落として渡す", async () => {
      verifyTurnstileToken.mockResolvedValue({
        ok: false,
        reason: "missing-token",
      });

      await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken(""),
      );

      expect(verifyTurnstileToken).toHaveBeenCalledWith(null, "203.0.113.7", undefined);
    });

    it("トークン欄が File なら文字列として扱わず null に落とす", async () => {
      // 同じ name で <input type="file"> を送り込めるため、型で絞る必要がある
      verifyTurnstileToken.mockResolvedValue({
        ok: false,
        reason: "missing-token",
      });
      const form = new FormData();
      form.set("cf-turnstile-response", new File(["x"], "token.txt"));

      await signInWithTurnstileAction("/", LOGIN_INITIAL_STATE, form);

      expect(verifyTurnstileToken).toHaveBeenCalledWith(null, "203.0.113.7", undefined);
      expect(signIn).not.toHaveBeenCalled();
    });
  });

  describe("hostname の照合に渡す Host", () => {
    it("x-forwarded-host を優先して渡す（リバースプロキシ配下）", async () => {
      forwardedHost = "aniflix.example";
      host = "internal-lb.local:8080";

      await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(verifyTurnstileToken.mock.calls[0][2]).toBe("aniflix.example");
    });

    it("x-forwarded-host が無ければ host を渡す", async () => {
      host = "aniflix.example";

      await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(verifyTurnstileToken.mock.calls[0][2]).toBe("aniflix.example");
    });
  });

  describe("ゲートの挙動", () => {
    it("検証を通ったら signIn を呼ぶ", async () => {
      await signInWithTurnstileAction(
        "/anime/1429",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(signIn).toHaveBeenCalledWith("google", {
        redirectTo: "/anime/1429?flash=signed-in",
      });
    });

    it("ログイン成功のフラッシュを遷移先に載せる", async () => {
      // OAuth の往復を跨いで通知を届ける唯一の経路
      await signInWithTurnstileAction(
        "/search?q=naruto",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(signIn).toHaveBeenCalledWith("google", {
        redirectTo: "/search?q=naruto&flash=signed-in",
      });
    });

    it("検証を通ったら失敗理由を持たない state を返す", async () => {
      const state = await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(state).toEqual({ error: null });
    });

    it("検証に失敗したら signIn を呼ばない", async () => {
      verifyTurnstileToken.mockResolvedValue({
        ok: false,
        reason: "invalid-token",
      });

      await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(signIn).not.toHaveBeenCalled();
    });

    it("検証に失敗したら理由を state で返す", async () => {
      verifyTurnstileToken.mockResolvedValue({
        ok: false,
        reason: "network-error",
      });

      const state = await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(state).toEqual({ error: "network-error" });
    });

    it("検証をスキップした時も signIn を呼ぶ", async () => {
      // 開発環境（シークレット未設定）でログインできること
      verifyTurnstileToken.mockResolvedValue({ ok: true, skipped: true });

      await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken(),
      );

      expect(signIn).toHaveBeenCalledWith("google", {
        redirectTo: "/?flash=signed-in",
      });
    });

    it("失敗の度に新しい state を返す（同じ理由が続いてもリセットを発火させる）", async () => {
      verifyTurnstileToken.mockResolvedValue({
        ok: false,
        reason: "invalid-token",
      });

      const first = await signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken("a"),
      );
      const second = await signInWithTurnstileAction(
        "/",
        first,
        formWithToken("b"),
      );

      expect(second).toEqual(first);
      expect(second).not.toBe(first);
    });
  });

  describe("リダイレクト先の扱い", () => {
    it("callbackUrl を safeCallbackUrl で自サイト内へ丸めてから使う", async () => {
      await signInWithTurnstileAction(
        "https://evil.example/anime/1429",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(signIn).toHaveBeenCalledWith("google", {
        redirectTo: "/anime/1429?flash=signed-in",
      });
    });

    it("プロトコル相対 URL もオリジンを捨ててパスだけ使う", async () => {
      await signInWithTurnstileAction(
        "//evil.example/x",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(signIn).toHaveBeenCalledWith("google", {
        redirectTo: "/x?flash=signed-in",
      });
    });

    it("スキーム付きの危険な値はトップへ丸める", async () => {
      await signInWithTurnstileAction(
        "javascript:alert(1)",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      );

      expect(signIn).toHaveBeenCalledWith("google", {
        redirectTo: "/?flash=signed-in",
      });
    });
  });

  it("signIn が投げるリダイレクト例外を握り潰さない", async () => {
    // signIn は NEXT_REDIRECT を throw して遷移する。catch すると
    // 「ボタンを押しても何も起きない」サイレント障害になる
    const redirectError = new Error("NEXT_REDIRECT");
    signIn.mockRejectedValue(redirectError);

    await expect(
      signInWithTurnstileAction(
        "/",
        LOGIN_INITIAL_STATE,
        formWithToken("token-abc"),
      ),
    ).rejects.toThrow(redirectError);
  });
});

describe("signOutAction", () => {
  it("ログアウトのフラッシュを付けてログイン画面へ戻す", async () => {
    await signOutAction();

    expect(signOut).toHaveBeenCalledWith({
      redirectTo: "/login?flash=signed-out",
    });
  });

  it("signOut が投げるリダイレクト例外を握り潰さない", async () => {
    const redirectError = new Error("NEXT_REDIRECT");
    signOut.mockRejectedValue(redirectError);

    await expect(signOutAction()).rejects.toThrow(redirectError);
  });
});
