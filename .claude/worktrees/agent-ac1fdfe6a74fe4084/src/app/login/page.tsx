import { signInWithTurnstileAction } from "@/app/actions/auth";
import LoginBackdrop from "@/components/LoginBackdrop";
import LoginForm from "@/components/LoginForm";
import { pickRandomLoginBackdrops } from "@/lib/login-backdrops";
import { safeCallbackUrl } from "@/lib/safe-callback-url";

// ページコンポーネントの Props 型定義。
// Next.js 15 以降、searchParams は Promise で渡されるため Promise 型で定義
interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // クエリパラメーターからログイン後の遷移先（callbackUrl）を取得
  const { callbackUrl } = await searchParams;
  // 安全なリダイレクト先 URL を抽出
  const redirectTo = safeCallbackUrl(callbackUrl);

  // callbackUrl は hidden input ではなく bind で束縛する。
  // bind した引数は Next が署名付きでシリアライズするため改竄できない
  // （Server Action 側でも念のため safeCallbackUrl を通し直している）
  const loginAction = signInWithTurnstileAction.bind(null, redirectTo);

  // Turnstile のサイトキーはビルド時にクライアントバンドルへ埋め込まれる。
  // 未設定ならウィジェットを出さず、サーバー側の検証スキップと挙動を揃える
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;

  // 背景パターンはサーバー側で抽選する。
  // クライアントで抽選するとハイドレーション不一致になる
  const backdrops = pickRandomLoginBackdrops();

  return (
    <>
      <LoginBackdrop items={backdrops} />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-sm md:max-w-md rounded-lg bg-black/60 p-6 text-center shadow-2xl ring-1 ring-white/10 backdrop-blur-sm sm:p-8">
          <h1 className="mb-2 text-3xl font-bold tracking-widest text-[#E50914]">
            ANIFLIX
          </h1>
          <p className="mb-8 text-sm text-gray-300">
            ご利用には Google アカウントでのログインが必要です
          </p>

          <LoginForm action={loginAction} siteKey={siteKey} />
        </div>
      </div>
    </>
  );
}
