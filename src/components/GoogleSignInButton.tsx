/**
 * Google 公式ブランドガイドラインに準拠したログインボタン。
 * https://developers.google.com/identity/branding-guidelines?hl=ja
 *
 * ANIFLIX の背景（#141414）に合わせて公式の「ダークテーマ」仕様を採用する。
 * - 背景: #131314 / 枠線: #8E918F 1px（内側）/ 文字: #E3E3E3
 * - 文字: Roboto Medium 14px / 行送り 20px
 * - 余白: ロゴ左 12px、ロゴと文字の間 10px、文字右 12px、高さ 40px
 *
 * 【変更禁止】「G」ロゴのサイズ（18x18）と配色はガイドラインで改変が禁止されている。
 * 色・パス・比率に手を入れないこと。
 */
export default function GoogleSignInButton() {
  return (
    <button
      type="submit"
      className="flex h-10 w-full items-center justify-center rounded border border-[#8E918F] bg-[#131314] pl-3 pr-3 text-sm leading-5 text-[#E3E3E3] transition hover:bg-[#1e1f20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      style={{ fontFamily: '"Roboto", "Helvetica Neue", Arial, sans-serif' }}
    >
      {/* Google 公式「G」ロゴ（18x18・配色改変禁止） */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 48 48"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      {/* ガイドライン上、表示言語に合わせたローカライズは許可されている */}
      <span className="ml-[10px]">Google でログイン</span>
    </button>
  );
}
