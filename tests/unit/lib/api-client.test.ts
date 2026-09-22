import { describe, it, expect } from "vitest";
import {
  assertApiOk,
  isSessionExpired,
  SessionExpiredError,
  SESSION_EXPIRED_MESSAGE,
} from "@/lib/api-client";

/** fetch の Response を最小限に模した値を作る */
function res(status: number): Response {
  return new Response(null, { status });
}

describe("assertApiOk", () => {
  it("成功レスポンスは通す", () => {
    expect(() => assertApiOk(res(200))).not.toThrow();
    expect(() => assertApiOk(res(204))).not.toThrow();
  });

  it("401 はセッション切れとして投げる", () => {
    // Middleware（src/auth.ts の authorized）が未認証の /api/* へ返すステータス
    expect(() => assertApiOk(res(401))).toThrow(SessionExpiredError);
    try {
      assertApiOk(res(401));
    } catch (e) {
      expect(isSessionExpired(e)).toBe(true);
      expect((e as Error).message).toBe(SESSION_EXPIRED_MESSAGE);
    }
  });

  it("401 以外の失敗は汎用エラーとして投げる", () => {
    for (const status of [400, 404, 500]) {
      try {
        assertApiOk(res(status));
        throw new Error("should have thrown");
      } catch (e) {
        expect(isSessionExpired(e)).toBe(false);
        expect((e as Error).message).toBe(`HTTP ${status}`);
      }
    }
  });
});

describe("isSessionExpired", () => {
  it("セッション切れ以外を false と判定する", () => {
    expect(isSessionExpired(new Error("boom"))).toBe(false);
    expect(isSessionExpired(null)).toBe(false);
    expect(isSessionExpired("401")).toBe(false);
  });
});
