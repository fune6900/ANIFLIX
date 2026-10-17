// Auth.js が提供する `auth` 関数を `middleware` という名前でエクスポート。
// これにより、Next.js がリクエスト受信時に自動で認証チェックを実施する
export { auth as middleware } from "@/auth";

export const config = {
  // Middleware を適用するリクエストパスを正規表現で指定（ガードの対象範囲）。
  // 以下に該当しない「すべて」のルートへのアクセス時に認証判定を挟む。
  //
  // 除外するもの:
  // - api/auth/**: ログイン/ログアウトなどの Auth.js API エンドポイント
  // - /login, /login/error: 認証画面そのもの（認証ループ防止）
  // - _next/static, _next/image: Next.js の静的ファイルと画像最適化エンドポイント
  // - icons/**, manifest.json: public/ 配下の PWA アイコンとマニフェスト
  // - favicon.ico, icon.png, apple-icon.png: src/app/ 直下のファイルから
  //   Next.js が自動生成するアイコンルート（src/app/icon.png → /icon.png）
  //
  // 【重要】除外は必ず境界（`$` または `/`）を伴わせ、前方一致で終わらせないこと。
  // 境界を欠くと `login` の除外が `/logindq` まで通し、存在しないページが未認証の
  // まま 404 として描画される（= 認可境界の穴）。ドットも必ずエスケープする。
  //
  // 【保守ルール】public/ に静的アセットを追加した場合や、robots.txt / sitemap.xml
  // のように未認証でも配信すべきファイルを置いた場合は、ここへ境界付きで追記する。
  // 追記を忘れるとログイン必須になり、利用者からは 404 やアイコン欠けとして見える。
  // 認証画面を増やす場合は src/lib/auth-routes.ts の AUTH_ROUTES と対で更新すること。
  matcher: [
    "/((?!api/auth(?:/|$)|login$|login/error$|_next/static/|_next/image|icons/|manifest\\.json$|favicon\\.ico$|icon\\.png$|apple-icon\\.png$).*)",
  ],
};
