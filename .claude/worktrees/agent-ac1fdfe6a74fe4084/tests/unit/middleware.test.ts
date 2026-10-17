import { describe, it, expect, vi } from "vitest";

// middleware.ts は `export { auth as middleware } from "@/auth"` で Auth.js 本体を
// 引き込む。matcher の検証に認証処理は不要なため、副作用ごと差し替える
vi.mock("@/auth", () => ({ auth: () => undefined }));

import { config } from "@/middleware";

/**
 * matcher が「認証ガードを通すパス」を実際に判定できているかを検証する。
 *
 * この matcher は前方一致で書くと `/logindq` のような別パスまでガードの外へ出し、
 * しかも **エラーを出さずに静かに素通りする**（PR #53 で実際に踏んだ）。
 * 回帰として経路テーブルごと固定する。
 */
const matchers = (config.matcher as string[]).map(
  (pattern) => new RegExp(`^${pattern}$`),
);

/** 指定パスで Middleware（= 認証判定）が動くか */
function isGuarded(pathname: string): boolean {
  return matchers.some((re) => re.test(pathname));
}

describe("middleware matcher", () => {
  it.each([
    "/",
    "/anime/1429",
    "/browse/genre/16",
    "/api/search",
    "/api/videos",
  ])("通常のルート %s をガードする", (path) => {
    expect(isGuarded(path)).toBe(true);
  });

  it.each([
    "/logindq",
    "/login-page",
    "/loginx",
    "/login/xyz",
    "/api/authors",
    "/api/auth-secret-dump",
    "/iconsX/x",
    "/manifestXjson",
    "/nonexistent",
  ])("接頭辞が除外対象と同じだけの %s もガードする", (path) => {
    expect(isGuarded(path)).toBe(true);
  });

  it.each([
    "/login",
    "/login/error",
    "/api/auth",
    "/api/auth/providers",
    "/api/auth/callback/google",
  ])("認証に必要な %s は素通りさせる", (path) => {
    expect(isGuarded(path)).toBe(false);
  });

  it.each([
    "/_next/static/chunk.js",
    "/icons/icon-192.png",
    "/manifest.json",
    "/favicon.ico",
    "/icon.png",
    "/apple-icon.png",
  ])("静的アセット %s は素通りさせる", (path) => {
    expect(isGuarded(path)).toBe(false);
  });
});
