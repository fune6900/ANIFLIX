"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import TurnstileWidget from "@/components/TurnstileWidget";
import { LOGIN_INITIAL_STATE } from "@/lib/login-action";
import type { LoginActionState } from "@/lib/login-action";
import { turnstileErrorMessage } from "@/lib/turnstile-messages";
import type { TurnstileWidgetHandle } from "@/types/turnstile";

const SCRIPT_ERROR_MESSAGE =
  "認証チェックを読み込めませんでした。ページを再読み込みしてお試しください。";

interface LoginFormProps {
  /** `signInWithTurnstileAction` に callbackUrl を束縛した Server Action */
  action: (
    state: LoginActionState,
    formData: FormData,
  ) => Promise<LoginActionState>;
  /**
   * Turnstile のサイトキー。未設定（null）なら Turnstile を挟まない。
   * サーバー側もシークレット未設定なら検証をスキップするため挙動が揃う
   */
  siteKey: string | null;
}

/**
 * ログインフォーム。
 *
 * Turnstile を通過するまで送信ボタンを無効にし、失敗したら必ずウィジェットを
 * リセットする。トークンは単回使用なので、リセットを挟まずに再送すると
 * `timeout-or-duplicate` で永久に失敗し続ける。
 */
export default function LoginForm({ action, siteKey }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    LOGIN_INITIAL_STATE,
  );
  const [token, setToken] = useState<string | null>(null);
  const [scriptFailed, setScriptFailed] = useState(false);
  const widgetRef = useRef<TurnstileWidgetHandle>(null);

  // 検証に失敗した時点でトークンは消費済み。Server Action は失敗の度に
  // 新しいオブジェクトを返すため、同じ理由が続いてもここが発火する
  useEffect(() => {
    if (!state.error) return;
    setToken(null);
    widgetRef.current?.reset();
  }, [state]);

  const message = scriptFailed
    ? SCRIPT_ERROR_MESSAGE
    : turnstileErrorMessage(state.error);

  // サイトキーが無い時はボタンを塞がない（開発環境で詰まないようにする）
  const blockedByTurnstile = siteKey !== null && token === null;

  return (
    <form action={formAction}>
      {message && (
        <p
          role="alert"
          className="mb-4 rounded border border-[#E50914]/40 bg-[#E50914]/10 px-3 py-2 text-left text-sm text-gray-100"
        >
          {message}
        </p>
      )}

      {siteKey && (
        // Turnstile は最小 300px 必要だが、カードの内寸は SP でそれを下回る。
        // ここだけカードの padding を打ち消して幅を取り戻す
        <div className="-mx-4 mb-4 flex justify-center sm:mx-0">
          <TurnstileWidget
            ref={widgetRef}
            siteKey={siteKey}
            onToken={setToken}
            onScriptError={() => setScriptFailed(true)}
          />
        </div>
      )}

      <GoogleSignInButton disabled={blockedByTurnstile || pending} />
    </form>
  );
}
