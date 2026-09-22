/**
 * 未認証でも表示する認証関連画面のパス接頭辞。
 *
 * `src/middleware.ts` の matcher が除外している `login` と対応させること。
 * 片方だけ変更すると「ガードは外れているのにサイト共通の UI が出る」といった
 * ちぐはぐな状態になる。
 */
const AUTH_ROUTE_PREFIX = "/login";

/** 認証画面（/login・/login/error）かどうか */
export function isAuthRoute(pathname: string): boolean {
  return pathname === AUTH_ROUTE_PREFIX || pathname.startsWith(`${AUTH_ROUTE_PREFIX}/`);
}
