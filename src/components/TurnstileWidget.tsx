"use client";

import Script from "next/script";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import type {
  TurnstileRenderOptions,
  TurnstileWidgetHandle,
} from "@/types/turnstile";

/**
 * `next/script` は id をキーに注入済みスクリプトを管理する。
 * id が無いとクライアント遷移の度に script が増え、api.js が多重実行される
 */
const TURNSTILE_SCRIPT_ID = "cf-turnstile-api";

/**
 * `render=explicit` を必ず付ける。
 * 省略すると api.js が DOM を自動スキャンし、こちらの render() と合わせて
 * ウィジェットが 2 つできる
 */
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileWidgetProps {
  ref?: Ref<TurnstileWidgetHandle>;
  siteKey: string;
  /** 検証を通れば token 文字列、失効・エラー時は null */
  onToken: (token: string | null) => void;
  /** api.js 自体を取得できなかった（広告ブロッカー・企業プロキシ等） */
  onScriptError: () => void;
}

/**
 * Cloudflare Turnstile（Managed）のウィジェット。
 *
 * 暗黙レンダー（`class="cf-turnstile"`）を使わないのは、api.js が DOM を
 * 走査するのが読み込み完了時の 1 度だけだから。`/login/error` から `/login`
 * へクライアント遷移で戻ると再走査されず、枠が出ないままボタンが永久に
 * 無効になる。explicit render なら React 側がライフサイクルを主導できる。
 *
 * トークンを載せた hidden input（`cf-turnstile-response`）は Turnstile 自身が
 * 親フォームへ注入する。自前で同名の input を描画すると二重送信になるうえ、
 * reset() 後に消費済みの値が残る危険があるため作らない。
 */
export default function TurnstileWidget({
  ref,
  siteKey,
  onToken,
  onScriptError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // onReady 任せにせず自分でも存在を確認する。クライアント遷移での再マウント時に
  // スクリプトが既にキャッシュ済みでも描画できるようにするための保険。
  // SSR では window が無いので必ず false になり、ハイドレーション不整合も起きない
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== "undefined" && window.turnstile !== undefined,
  );

  // コールバックを ref へ逃がす。effect の依存配列に入れると、親が再レンダーする
  // 度に remove → render が走り、利用者が通過したチェックが消える
  const onTokenRef = useRef(onToken);
  const onScriptErrorRef = useRef(onScriptError);
  useEffect(() => {
    onTokenRef.current = onToken;
    onScriptErrorRef.current = onScriptError;
  });

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        if (widgetIdRef.current === null) return;
        window.turnstile?.reset(widgetIdRef.current);
      },
    }),
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    // 二重 render の抑止。React の StrictMode は開発時に effect を 2 回走らせる
    if (!scriptReady || !container || widgetIdRef.current !== null) return;

    const options: TurnstileRenderOptions = {
      sitekey: siteKey,
      // Managed モードで枠を常時表示する。"interaction-only" にすると枠が消える
      appearance: "always",
      theme: "dark",
      language: "ja",
      size: "flexible",
      // Cloudflare ダッシュボードで分析軸になるラベル
      action: "login",
      callback: (token) => onTokenRef.current(token),
      // トークンは発行から約 300 秒で失効する。ログイン画面は背景が流れ続ける
      // 「眺めていられる」画面なので、5 分放置は現実に起きる
      "expired-callback": () => onTokenRef.current(null),
      "timeout-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
    };

    widgetIdRef.current = window.turnstile?.render(container, options) ?? null;

    return () => {
      if (widgetIdRef.current === null) return;
      window.turnstile?.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [scriptReady, siteKey]);

  // ブラウザバックで bfcache から復元されると、消費済みトークンを抱えた
  // DOM がそのまま戻ってくる。必ず取り直させる
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (!event.persisted || widgetIdRef.current === null) return;
      window.turnstile?.reset(widgetIdRef.current);
      onTokenRef.current(null);
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return (
    <>
      <Script
        id={TURNSTILE_SCRIPT_ID}
        src={TURNSTILE_SCRIPT_SRC}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => onScriptErrorRef.current()}
      />
      {/* 中身は Turnstile が所有する。React 側の children を置かないこと
          （DOM の所有権が衝突し remove() 時に NotFoundError になる） */}
      <div ref={containerRef} />
    </>
  );
}
