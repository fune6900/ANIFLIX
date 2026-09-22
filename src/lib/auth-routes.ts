/**
 * 未認証でも到達を許す認証画面のパス。
 *
 * `src/middleware.ts` の matcher は **この 2 つだけ** を除外する。
 * 前方一致で除外すると `/logindq` のような存在しないパスまでガードの外へ出るため、
 * 完全一致で管理すること。
 */
const AUTH_ROUTES = ["/login", "/login/error"] as const;

/** 認証画面（/login・/login/error）かどうか */
export function isAuthRoute(pathname: string): boolean {
  return (AUTH_ROUTES as readonly string[]).includes(pathname);
}
