import { describe, it, expect } from "vitest";
import {
  withFlash,
  parseFlash,
  FLASH_PARAM,
  FLASH_REASON_PARAM,
} from "@/lib/flash";

describe("withFlash", () => {
  it("パスにフラッシュを付ける", () => {
    expect(withFlash("/anime/1429", "signed-in")).toBe(
      "/anime/1429?flash=signed-in",
    );
  });

  it("既存のクエリを壊さない", () => {
    expect(withFlash("/search?q=naruto", "signed-in")).toBe(
      "/search?q=naruto&flash=signed-in",
    );
  });

  it("同じパラメータを二重に付けない", () => {
    const once = withFlash("/", "signed-in");
    expect(withFlash(once, "signed-out")).toBe("/?flash=signed-out");
  });

  it("空のパスはトップとして扱う", () => {
    expect(withFlash("", "signed-out")).toBe("/?flash=signed-out");
  });

  it("外部オリジンを渡されてもパスだけにする", () => {
    // redirectTo は一度サニタイズ済みだが、ここでも閉じておく
    expect(withFlash("https://evil.example/x", "signed-in")).toBe(
      "/x?flash=signed-in",
    );
  });

  it("理由を添えられる", () => {
    expect(withFlash("/login", "sign-in-failed", "AccessDenied")).toBe(
      "/login?flash=sign-in-failed&reason=AccessDenied",
    );
  });

  it("パラメータ名は定数と一致する", () => {
    expect(FLASH_PARAM).toBe("flash");
    expect(FLASH_REASON_PARAM).toBe("reason");
  });
});

describe("parseFlash", () => {
  it("値が無ければ null", () => {
    expect(parseFlash(null)).toBeNull();
    expect(parseFlash(undefined)).toBeNull();
    expect(parseFlash("")).toBeNull();
  });

  it("ログイン成功を成功の見た目で返す", () => {
    expect(parseFlash("signed-in")).toEqual({
      kind: "signed-in",
      tone: "success",
      message: "ログインしました",
    });
  });

  it("ログアウトを成功の見た目で返す", () => {
    expect(parseFlash("signed-out")).toEqual({
      kind: "signed-out",
      tone: "success",
      message: "ログアウトしました",
    });
  });

  it("ログイン失敗を失敗の見た目で返す", () => {
    const flash = parseFlash("sign-in-failed");
    expect(flash?.tone).toBe("error");
    expect(flash?.message).toBe(
      "ログインに失敗しました。もう一度お試しください。",
    );
  });

  describe("失敗理由の対応表（従来の /login/error から引き継ぐ）", () => {
    it.each([
      [
        "Configuration",
        "認証の設定に問題があります。時間をおいて再度お試しください。",
      ],
      [
        "AccessDenied",
        "アクセスが拒否されました。別の Google アカウントでお試しください。",
      ],
      [
        "Verification",
        "リンクの有効期限が切れています。もう一度ログインしてください。",
      ],
    ])("%s は専用の文言になる", (reason, expected) => {
      expect(parseFlash("sign-in-failed", reason)?.message).toBe(expected);
    });

    it("未知の理由は既定文言へ丸める", () => {
      expect(parseFlash("sign-in-failed", "SomethingNew")?.message).toBe(
        "ログインに失敗しました。もう一度お試しください。",
      );
    });

    it("理由をそのまま画面へ出さない", () => {
      // ?reason= は利用者が自由に書ける。入力を反射しないこと
      const injected = "<img src=x onerror=alert(1)>";
      const message = parseFlash("sign-in-failed", injected)?.message ?? "";
      expect(message).not.toContain("<img");
      expect(message).toBe("ログインに失敗しました。もう一度お試しください。");
    });

    it("成功系のフラッシュは理由を無視する", () => {
      expect(parseFlash("signed-in", "AccessDenied")?.message).toBe(
        "ログインしました",
      );
    });
  });

  it("未知の種別は表示しない", () => {
    expect(parseFlash("totally-unknown")).toBeNull();
    expect(parseFlash("<script>alert(1)</script>")).toBeNull();
  });
});
