// このファイル内の関数がすべてサーバー側でのみ実行される Server Actions であることを宣言
"use server";

import { signOut } from "@/auth";

/**
 * ユーザーのログアウト処理を行う Server Action。
 * ログアウト完了後、自動的にログイン画面（/login）へリダイレクトする
 */
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}