import Link from "next/link";
import LoginBackdrop from "@/components/LoginBackdrop";
import { pickRandomLoginBackdrops } from "@/lib/login-backdrops";

// ページコンポーネントの Props 型定義。
// Next.js 15 以降、searchParams は Promise で渡されるため Promise 型で定義
interface LoginErrorPageProps {
  searchParams: Promise<{ error?: string }>;
}

/**
 * Auth.js が `?error=` に載せてくるエラーコードと、利用者向け文言の対応表。
 * 未知のコードは内部情報を晒さないよう既定文言へ丸める。
 */
const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "認証の設定に問題があります。時間をおいて再度お試しください。",
  AccessDenied:
    "アクセスが拒否されました。別の Google アカウントでお試しください。",
  Verification:
    "リンクの有効期限が切れています。もう一度ログインしてください。",
};

const DEFAULT_MESSAGE = "ログインに失敗しました。もう一度お試しください。";

export default async function LoginErrorPage({
  searchParams,
}: LoginErrorPageProps) {
  const { error } = await searchParams;
  const message = (error && ERROR_MESSAGES[error]) || DEFAULT_MESSAGE;

  const backdrops = pickRandomLoginBackdrops();

  return (
    <>
      <LoginBackdrop items={backdrops} />
      <div className="relative flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm md:max-w-md rounded-lg bg-black/60 p-8 text-center shadow-2xl ring-1 ring-white/10 backdrop-blur-sm">
          <h1 className="mb-2 text-3xl font-bold tracking-widest text-[#E50914]">
            ANIFLIX
          </h1>
          <p className="mb-8 text-sm text-gray-300">{message}</p>
          <Link
            href="/login"
            className="inline-block w-full rounded bg-white py-3 font-semibold text-black transition hover:bg-gray-200"
          >
            ログイン画面へ戻る
          </Link>
        </div>
      </div>
    </>
  );
}
