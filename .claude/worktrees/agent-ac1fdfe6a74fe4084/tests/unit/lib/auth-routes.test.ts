import { describe, it, expect } from "vitest";
import { isAuthRoute } from "@/lib/auth-routes";

describe("isAuthRoute", () => {
  it("認証画面を認識する", () => {
    expect(isAuthRoute("/login")).toBe(true);
    expect(isAuthRoute("/login/error")).toBe(true);
  });

  it("接頭辞が同じだけの別パスを認証画面と誤認しない", () => {
    // 前方一致で判定すると /logindq までサイト共通 UI が消える
    expect(isAuthRoute("/logindq")).toBe(false);
    expect(isAuthRoute("/login-page")).toBe(false);
    expect(isAuthRoute("/loginx")).toBe(false);
    expect(isAuthRoute("/login/xyz")).toBe(false);
  });

  it("通常のページを認証画面と誤認しない", () => {
    expect(isAuthRoute("/")).toBe(false);
    expect(isAuthRoute("/anime/1429")).toBe(false);
  });
});
