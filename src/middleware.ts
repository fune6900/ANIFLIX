// Auth.js が提供する `auth` 関数を `middleware` という名前でエクスポート。
// これにより、Next.js がリクエスト受信時に自動で認証チェックを実施する
export { auth as middleware } from "@/auth";

export const config = {
  // Middleware を適用するリクエストパスを正規表現で指定（ガードの対象範囲）。
  // 以下に含まれるファイル・パス「以外（?!）」のすべてのルートへのアクセス時に認証判定を挟む
  // - api/auth: ログイン/ログアウトなどの Auth.js API エンドポイント
  // - login: ログイン画面と認証エラー画面（/login/error）。認証ループ防止のため除外
  // - _next/static, _next/image: Next.js の静的ファイルや画像最適化ファイル
  // - icons, manifest.json: public/ 配下の PWA アイコンとマニフェスト
  // - favicon.ico, icon.png, apple-icon.png: src/app/ 直下のファイルから
  //   Next.js が自動生成するアイコンルート（src/app/icon.png → /icon.png）
  //
  // 【保守ルール】public/ に静的アセットを追加した場合や、robots.txt / sitemap.xml
  // のように未認証でも配信すべきファイルを置いた場合は、必ずここの除外リストへ追記する。
  // 追記を忘れるとログイン必須になり、利用者からは 404 やアイコン欠けとして見える。
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|icons|manifest.json|favicon.ico|icon.png|apple-icon.png).*)",
  ],
};
