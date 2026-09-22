/**
 * クライアントから Route Handler（/api/**）を叩く際の共通処理。
 *
 * サイト全体が Google ログイン必須のため、セッションが切れたクライアントの
 * リクエストには Middleware（src/auth.ts の authorized）が 401 JSON を返す。
 * 各コンポーネントが個別に 401 を判定すると配線漏れが起きるため、判定と文言を
 * ここへ集約する。
 */

/** セッション切れ時に利用者へ見せる文言 */
export const SESSION_EXPIRED_MESSAGE =
  "セッションが切れました。ページを再読み込みしてください";

/** 未認証（セッション切れ）を表すエラー */
export class SessionExpiredError extends Error {
  constructor() {
    super(SESSION_EXPIRED_MESSAGE);
    this.name = "SessionExpiredError";
  }
}

/**
 * Route Handler のレスポンスを検証する。
 *
 * 401 を素通しすると、呼び出し側は「結果 0 件」や汎用エラーとして扱ってしまい、
 * 利用者にはログインが切れたことが伝わらない。
 */
export function assertApiOk(res: Response): void {
  if (res.status === 401) throw new SessionExpiredError();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/** 捕捉したエラーがセッション切れかどうか */
export function isSessionExpired(error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}
