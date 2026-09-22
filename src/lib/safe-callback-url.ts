/**
 * ログイン後のリダイレクト先を、必ず自サイト内の絶対パスへ丸める。
 *
 * Auth.js の middleware は callbackUrl に**絶対 URL**を載せてくる
 * （`request.nextUrl.href` をそのまま `searchParams` に入れる実装）。
 * 許可リストで弾く方式ではなくオリジンを捨ててパスだけを採る方式にすることで、
 * 外部ドメイン・プロトコル相対 URL・`javascript:` などのスキームが混ざっても
 * 構造的に自サイト内へ閉じる。
 */
export function safeCallbackUrl(raw: string | undefined): string {
  if (!raw) return "/";
  try {
    // 第2引数はパースを通すためのダミー。pathname と search しか使わない
    const { pathname, search } = new URL(raw, "http://localhost");
    return pathname.startsWith("/") && !pathname.startsWith("//")
      ? `${pathname}${search}`
      : "/";
  } catch {
    return "/";
  }
}
