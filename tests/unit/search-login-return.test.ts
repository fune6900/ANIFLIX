import { describe, it, expect, vi } from "vitest";

// matcher の検証に Auth.js 本体は不要（例外 2。tests/unit/middleware.test.ts と同じ）
vi.mock("@/auth", () => ({ auth: () => undefined }));

import { config } from "@/middleware";
import { safeCallbackUrl } from "@/lib/safe-callback-url";

/**
 * 未ログインで検索結果画面を直接開いた時の経路（#101）。
 *
 * 1. middleware の matcher は検索結果画面をガードする（認可境界は緩めない）
 * 2. Auth.js は `request.nextUrl.href`（絶対 URL）を callbackUrl に載せて /login へ送る
 * 3. /login と Server Action が `safeCallbackUrl` で戻り先を決める → トップ（/）
 *
 * 検索結果は「その場で打った語」に対する画面で、ログインを挟んで戻しても意味が無い。
 * matcher を触らずに戻り先だけを倒していることを経路ごと固定する。
 */

const matchers = (config.matcher as string[]).map(
  (pattern) => new RegExp(`^${pattern}$`),
);

function isGuarded(pathname: string): boolean {
  return matchers.some((re) => re.test(pathname));
}

/** 未ログインのリクエスト URL から、ログイン後に戻る先を求める */
function returnPathAfterLogin(requestUrl: string): string {
  const href = new URL(requestUrl, "http://localhost:3000").href;
  return safeCallbackUrl(href);
}

describe("検索結果画面: 未ログインで開いた場合", () => {
  it.each([
    "/search/anime?q=%E9%80%B2%E6%92%83",
    "/search/movies?q=%E5%90%9B%E3%81%AE%E5%90%8D%E3%81%AF",
    "/search/voice-actors?q=x&page=2",
    "/search/characters?q=x",
    "/search?q=x",
    "/browse/movies?q=x",
    "/voice-actors?q=x",
  ])("%s はガードされ、ログイン後はトップへ戻る", (url) => {
    const pathname = new URL(url, "http://localhost:3000").pathname;

    expect(isGuarded(pathname)).toBe(true);
    expect(returnPathAfterLogin(url)).toBe("/");
  });

  it.each(["/anime/1429", "/browse/movies", "/voice-actors", "/browse/eras"])(
    "検索結果ではない %s はログイン後に元の画面へ戻る",
    (url) => {
      expect(isGuarded(url)).toBe(true);
      expect(returnPathAfterLogin(url)).toBe(url);
    },
  );
});
