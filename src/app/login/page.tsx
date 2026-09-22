import { signIn } from "@/auth";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import LoginBackdrop from "@/components/LoginBackdrop";
import { pickRandomLoginBackdrops } from "@/lib/login-backdrops";

// ページコンポーネントの Props 型定義。
// Next.js 15 以降、searchParams は Promise で渡されるため Promise 型で定義
interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

/**
 * リダイレクト先 URL のオープンリダイレクト脆弱性を防止する安全化関数。
 * Auth.js の middleware は callbackUrl に絶対 URL を入れてくるため、
 * オリジンを捨ててパス部分だけを採用し、必ず自サイト内へ閉じる。
 */
function safeCallbackUrl(raw: string | undefined): string {
  if (!raw) return "/";
  try {
    const { pathname, search } = new URL(raw, "http://localhost");
    return pathname.startsWith("/") && !pathname.startsWith("//")
      ? `${pathname}${search}`
      : "/";
  } catch {
    return "/";
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // クエリパラメーターからログイン後の遷移先（callbackUrl）を取得
  const { callbackUrl } = await searchParams;
  // 安全なリダイレクト先 URL を抽出
  const redirectTo = safeCallbackUrl(callbackUrl);

  // 背景パターンはサーバー側で抽選する。
  // クライアントで抽選するとハイドレーション不一致になる
  const backdrops = pickRandomLoginBackdrops();

  return (
    <>
      <LoginBackdrop items={backdrops} />
      <div className="relative flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm md:max-w-md rounded-lg bg-black/60 p-8 text-center shadow-2xl ring-1 ring-white/10 backdrop-blur-sm">
          <h1 className="mb-2 text-3xl font-bold tracking-widest text-[#E50914]">
            ANIFLIX
          </h1>
          <p className="mb-8 text-sm text-gray-300">
            ご利用には Google アカウントでのログインが必要です
          </p>

          {/* Server Action を使用したログインフォーム */}
          <form
            action={async () => {
              "use server";
              // Google OAuth ログイン処理を実行し、ログイン後に元の指定ページへリダイレクト
              await signIn("google", { redirectTo });
            }}
          >
            <GoogleSignInButton />
          </form>
        </div>
      </div>
    </>
  );
}
