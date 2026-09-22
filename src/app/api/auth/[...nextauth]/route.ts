// src/auth.ts で定義・エクスポートした handlers (NextAuth の API ハンドラー) を呼び出す
import { handlers } from "@/auth";

// Auth.js が内部で使用する HTTP リクエスト (GET / POST) の処理ロジックを展開してエクスポート。
// - GET: ログイン画面への遷移、OAuth プロバイダ一覧の取得、セッション情報の取得など
// - POST: ログインフォームの送信、ログアウト処理、OAuth コールバックの受信など
export const { GET, POST } = handlers;