/**
 * ログインフォームの Turnstile ウィジェットに付ける action。
 *
 * ウィジェット（クライアント）が `turnstile.render()` に渡し、サーバーの
 * siteverify 検証（`src/lib/turnstile.ts`）が応答の `action` と照合する。
 * 片方だけ変えると全員ログインできなくなるので、ここ 1 か所で持つ。
 * `server-only` を持たないため、クライアントからも読める。
 */
export const TURNSTILE_LOGIN_ACTION = "login";
