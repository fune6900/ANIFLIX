"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  parseFlash,
  FLASH_PARAM,
  FLASH_REASON_PARAM,
  type Flash,
} from "@/lib/flash";

/** 自動で消えるまでの時間（ミリ秒）。残り時間バーの所要時間と共有する */
export const AUTO_DISMISS_MS = 5000;

/** 退出アニメーションの時間（ミリ秒）。CSS の duration と揃えること */
export const EXIT_MS = 300;

const TONE_CLASSES: Record<Flash["tone"], string> = {
  success: "border-[#54b9c5]/60 bg-[#0d2b2f]/95",
  error: "border-[#E50914]/60 bg-[#2b0d10]/95",
};

/** 残り時間バーの色 */
const TIMER_CLASSES: Record<Flash["tone"], string> = {
  success: "bg-[#54b9c5]",
  error: "bg-[#E50914]",
};

/**
 * ログイン・ログアウトの結果を知らせるフラッシュメッセージ。
 *
 * 画面右上に、右からスライドして現れる。下端のバーが残り時間を表す。
 *
 * 通知はクエリパラメータで運ばれてくる（`src/lib/flash.ts` に理由あり）。
 *
 * **URL の掃除は「表示した直後」ではなく「消えた後」に行う。**
 * Next の App Router は `history.replaceState` を検知してルーターの状態を
 * 更新する。表示直後に掃除すると、その更新で通知が消えてしまい、一瞬も
 * 画面に出ない（実ブラウザで踏んだ）。消えた後に掃除すれば、パラメータが
 * 無くなった結果として非表示になるだけなので、再描画の挙動に左右されない。
 *
 * `useSearchParams()` を使うため、ルートレイアウトでは `<Suspense>` で包むこと。
 * 包まないと静的レンダリングのページがビルド時に落ちる。
 */
export default function FlashMessage() {
  const searchParams = useSearchParams();
  const flash = parseFlash(
    searchParams.get(FLASH_PARAM),
    searchParams.get(FLASH_REASON_PARAM),
  );

  /** 入場アニメーションを開始したか */
  const [entered, setEntered] = useState(false);
  /** 退出アニメーション中か */
  const [leaving, setLeaving] = useState(false);
  /** DOM から外したか */
  const [gone, setGone] = useState(false);

  // 初回描画で画面外の状態を一度描いてから動かす。
  // 同じコミットで最終状態にすると transition が走らない
  useEffect(() => {
    setEntered(true);
  }, []);

  const message = flash?.message;

  // 自動消滅
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setLeaving(true), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message]);

  // 退出アニメーションが終わってから DOM を外し、URL を掃除する
  useEffect(() => {
    if (!leaving) return;

    const timer = setTimeout(() => {
      setGone(true);

      // 残したままだと再読み込みやブックマークの度に同じ通知が出る
      const next = new URLSearchParams(searchParams.toString());
      next.delete(FLASH_PARAM);
      next.delete(FLASH_REASON_PARAM);

      const query = next.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`,
      );
    }, EXIT_MS);

    return () => clearTimeout(timer);
  }, [leaving, searchParams]);

  const dismiss = useCallback(() => setLeaving(true), []);

  if (!flash || gone) return null;

  const onScreen = entered && !leaving;

  return (
    <div
      // 失敗は読み上げを割り込ませる。成功は手が空いた時でよい
      role={flash.tone === "error" ? "alert" : "status"}
      // Navbar と BottomNav はどちらも z-50。トーストはレイアウト上
      // Navbar より前に描画されるため、同じ z だと隠れる
      className={`fixed right-4 top-20 z-[60] w-[calc(100%-2rem)] max-w-sm transition-all duration-300 ease-out motion-reduce:transition-none sm:right-6 ${
        onScreen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
    >
      <div
        className={`overflow-hidden rounded border shadow-2xl backdrop-blur-sm ${TONE_CLASSES[flash.tone]}`}
      >
        <div className="flex items-start gap-3 px-4 py-3 text-sm text-white">
          <p className="flex-1 text-left leading-relaxed">{flash.message}</p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="閉じる"
            // 指で押せる 44px 四方を確保する。負のマージンで親の padding へ
            // はみ出させるので、トーストの高さは増えない
            className="-my-3 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded text-lg leading-none text-gray-400 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            ×
          </button>
        </div>

        {/* 残り時間。文言は role=status / role=alert で伝わるので読み上げない */}
        <div aria-hidden="true" className="h-1 bg-white/10">
          <div
            data-flash-timer
            className={`h-full ${TIMER_CLASSES[flash.tone]}`}
            style={{
              width: entered ? "0%" : "100%",
              transitionProperty: "width",
              transitionTimingFunction: "linear",
              transitionDuration: `${AUTO_DISMISS_MS}ms`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
