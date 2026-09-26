import { describe, it, expect } from "vitest";
import {
  turnstileErrorMessage,
  TURNSTILE_DEFAULT_MESSAGE,
} from "@/lib/turnstile-messages";
import type { TurnstileFailureReason } from "@/lib/turnstile";

const ALL_REASONS: TurnstileFailureReason[] = [
  "misconfigured",
  "missing-token",
  "invalid-token",
  "network-error",
];

describe("turnstileErrorMessage", () => {
  it("理由が無ければ null を返す（バナーを出さない）", () => {
    expect(turnstileErrorMessage(undefined)).toBeNull();
    expect(turnstileErrorMessage("")).toBeNull();
  });

  it("既知の失敗理由すべてに文言がある", () => {
    for (const reason of ALL_REASONS) {
      const message = turnstileErrorMessage(reason);
      expect(message, reason).toBeTruthy();
      expect(message, reason).not.toBe(TURNSTILE_DEFAULT_MESSAGE);
    }
  });

  it("理由ごとに文言が異なる", () => {
    const messages = ALL_REASONS.map((r) => turnstileErrorMessage(r));
    expect(new Set(messages).size).toBe(ALL_REASONS.length);
  });

  it("未知のコードは既定文言へ丸める", () => {
    expect(turnstileErrorMessage("totally-unknown")).toBe(
      TURNSTILE_DEFAULT_MESSAGE,
    );
  });

  it("未知のコードをそのまま画面へ出さない", () => {
    // `?error=` は利用者が自由に書ける。内部情報も入力値も反射しないこと
    const injected = '<img src=x onerror=alert(1)>"';
    const message = turnstileErrorMessage(injected);
    expect(message).toBe(TURNSTILE_DEFAULT_MESSAGE);
    expect(message).not.toContain("<img");
  });

  it("設定不備を利用者向け文言で隠す", () => {
    // 環境変数の欠落を利用者に晒さない（security.md: 内部情報を返さない）
    const message = turnstileErrorMessage("misconfigured") ?? "";
    expect(message).not.toMatch(/環境変数|SECRET|KEY|設定/);
  });
});
