import type { TurnstileFailureReason } from "@/lib/turnstile";

/**
 * ログインフォームの `useActionState` が持つ状態。
 *
 * Server Action 本体（`src/app/actions/auth.ts`）に置けないのは、
 * `"use server"` ファイルが async 関数以外の値を export できないため。
 * 型のみの import なので `server-only` は巻き込まれず、クライアントからも読める。
 */
export interface LoginActionState {
  /** 直前の送信が失敗した理由。初期状態および成功時は null */
  error: TurnstileFailureReason | null;
}

export const LOGIN_INITIAL_STATE: LoginActionState = { error: null };
