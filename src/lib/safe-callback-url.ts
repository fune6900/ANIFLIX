import { isSearchResultsPath } from "@/lib/search-results";

/**
 * キーワード付きで開くと検索結果画面へ redirect する旧 URL（#101）。
 * キーワード無しなら通常の一覧画面なので、`q` がある時だけ検索結果として扱う
 */
const LEGACY_SEARCH_PATHS: readonly string[] = [
  "/browse/movies",
  "/voice-actors",
];

/**
 * 検索結果画面への戻りか。
 * 検索結果は「その場で打った語」に対する画面で、ログインを挟んでまで戻す価値が無い。
 * 未ログインで直接開かれた場合はトップへ倒す（matcher は触らない = 認可境界は緩めない）
 */
function isSearchResultsTarget(pathname: string, search: string): boolean {
  if (isSearchResultsPath(pathname)) return true;
  return (
    LEGACY_SEARCH_PATHS.includes(pathname) &&
    new URLSearchParams(search).has("q")
  );
}

/**
 * ログイン後のリダイレクト先を、必ず自サイト内の絶対パスへ丸める。
 *
 * Auth.js の middleware は callbackUrl に**絶対 URL**を載せてくる
 * （`request.nextUrl.href` をそのまま `searchParams` に入れる実装）。
 * 許可リストで弾く方式ではなくオリジンを捨ててパスだけを採る方式にすることで、
 * 外部ドメイン・プロトコル相対 URL・`javascript:` などのスキームが混ざっても
 * 構造的に自サイト内へ閉じる。
 *
 * 検索結果画面（`/search/**`）への戻りはトップ（`/`）にする（#101）。
 */
export function safeCallbackUrl(raw: string | undefined): string {
  if (!raw) return "/";
  try {
    // 第2引数はパースを通すためのダミー。pathname と search しか使わない
    const { pathname, search } = new URL(raw, "http://localhost");
    if (!pathname.startsWith("/") || pathname.startsWith("//")) return "/";
    if (isSearchResultsTarget(pathname, search)) return "/";
    return `${pathname}${search}`;
  } catch {
    return "/";
  }
}
