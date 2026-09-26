import type { TurnstileFailureReason } from "@/lib/turnstile";

/**
 * Turnstile の失敗理由 → 利用者向け文言。
 *
 * `src/lib/turnstile.ts` から分離してあるのは、こちらがクライアント
 * コンポーネント（`LoginForm`）からも読まれるため。型のみの import なので
 * `server-only` は巻き込まれない。
 *
 * 文言に環境変数名・エラーコード・内部状態を書かないこと
 * （`@.claude/rules/security.md`: エラーに内部情報を含めない）。
 */

/** 未知の理由に使う既定文言。`/login/error` の DEFAULT_MESSAGE と揃える */
export const TURNSTILE_DEFAULT_MESSAGE =
  "ログインに失敗しました。もう一度お試しください。";

/**
 * Record にすることで、失敗理由を増やした時に文言の追加漏れが型エラーになる。
 */
const MESSAGES: Record<TurnstileFailureReason, string> = {
  "missing-token":
    "確認が完了していません。枠内のチェックを済ませてから、もう一度お試しください。",
  "invalid-token":
    "確認の有効期限が切れました。もう一度チェックしてからお試しください。",
  "network-error":
    "確認サービスに接続できませんでした。時間をおいて再度お試しください。",
  misconfigured:
    "現在ログインを受け付けられません。時間をおいて再度お試しください。",
};

/** `code` が既知の失敗理由か。`in` 演算子は toString 等まで拾うため使わない */
function isFailureReason(code: string): code is TurnstileFailureReason {
  return Object.prototype.hasOwnProperty.call(MESSAGES, code);
}

/**
 * 失敗理由を利用者向け文言へ変換する。
 *
 * @returns 理由が無ければ null（バナーを出さない）。未知の理由は既定文言へ丸める
 */
export function turnstileErrorMessage(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  return isFailureReason(code) ? MESSAGES[code] : TURNSTILE_DEFAULT_MESSAGE;
}
