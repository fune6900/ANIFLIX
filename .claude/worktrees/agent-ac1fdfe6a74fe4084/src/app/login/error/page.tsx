import { redirect } from "next/navigation";
import { withFlash } from "@/lib/flash";

// ページコンポーネントの Props 型定義。
// Next.js 15 以降、searchParams は Promise で渡されるため Promise 型で定義
interface LoginErrorPageProps {
  searchParams: Promise<{ error?: string }>;
}

/**
 * Auth.js のエラーコードとして受け付ける最大長。
 * 実際のコードは `AccessDenied` 程度の短い識別子で、
 * これを超える値は URL を膨らませるだけなので捨てる。
 */
const MAX_ERROR_CODE_LENGTH = 64;

/**
 * 認証エラーの着地点（Auth.js の `pages.error`）。
 *
 * かつてはここで文言を出して「ログイン画面へ戻る」リンクを置く行き止まりだったが、
 * ログイン画面へフラッシュ付きで送り返す薄いページに変えた。利用者はその場で
 * 再試行できる。文言の対応表は `src/lib/flash.ts` が持つ。
 *
 * **ルート自体は残す。** 消すと `src/middleware.ts` の matcher と
 * `src/lib/auth-routes.ts` の `AUTH_ROUTES` を触ることになり、認可境界に影響する。
 */
export default async function LoginErrorPage({
  searchParams,
}: LoginErrorPageProps) {
  const { error } = await searchParams;

  // 値は `parseFlash()` が対応表に照らすため、そのまま画面へ出ることはない
  const reason =
    error && error.length <= MAX_ERROR_CODE_LENGTH ? error : undefined;

  redirect(withFlash("/login", "sign-in-failed", reason));
}
