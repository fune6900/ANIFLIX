// このファイル内の関数がすべてサーバー側でのみ実行される Server Actions であることを宣言
"use server";

import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import type { LoginActionState } from "@/lib/login-action";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { verifyTurnstileToken } from "@/lib/turnstile";

/**
 * ユーザーのログアウト処理を行う Server Action。
 * ログアウト完了後、自動的にログイン画面（/login）へリダイレクトする
 */
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

/**
 * FormData から文字列の値だけを取り出す。
 * `formData.get()` の戻りは `string | File | null` で、同じ name に File を
 * 送り込むこともできるため、型で絞ってから使う（`as` は使わない）。
 */
function readFormString(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** 利用者の IP。プロキシ経由では x-forwarded-for の先頭が元の送信元 */
async function resolveRemoteIp(): Promise<string | undefined> {
  const forwardedFor = (await headers()).get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || undefined;
}

/**
 * Turnstile を通してから Google ログインを開始する Server Action。
 *
 * `/login` は Middleware のガード対象外で未認証のまま無制限に到達できるため、
 * ここが bot によるログインフロー連打を止める唯一の関門になる。
 *
 * 検証用の Route Handler を作らないのは、`/api/**` が Middleware に
 * ガードされており未認証リクエストには 401 JSON が返って本体が実行されないため。
 *
 * @param callbackUrl ログイン後の遷移先。`.bind()` でサーバー側から束縛する
 */
export async function signInWithTurnstileAction(
  callbackUrl: string,
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  // 束縛済みの値でも、クライアントを一往復した以上は未検証入力として扱う
  const redirectTo = safeCallbackUrl(callbackUrl);

  const verdict = await verifyTurnstileToken(
    readFormString(formData, "cf-turnstile-response"),
    await resolveRemoteIp(),
  );

  if (!verdict.ok) {
    // 失敗の度に新しいオブジェクトを返す。クライアントはこの参照の変化を見て
    // ウィジェットをリセットするため、同じ参照を使い回すとリセットが発火せず、
    // 消費済みトークンのまま何度でも失敗し続ける
    return { error: verdict.reason };
  }

  // signIn は NEXT_REDIRECT を throw して遷移を実現する。
  // try/catch で囲むと遷移が起きず「押しても何も起きない」障害になる
  await signIn("google", { redirectTo });
  return { error: null };
}
