"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  parseFlash,
  FLASH_PARAM,
  FLASH_REASON_PARAM,
  type Flash,
} from "@/lib/flash";

/** 自動で消えるまでの時間（ミリ秒） */
const AUTO_DISMISS_MS = 5000;

const TONE_CLASSES: Record<Flash["tone"], string> = {
  success: "border-[#54b9c5]/60 bg-[#0d2b2f]/95",
  error: "border-[#E50914]/60 bg-[#2b0d10]/95",
};

/**
 * ログイン・ログアウトの結果を知らせるフラッシュメッセージ。
 *
 * 通知はクエリパラメータで運ばれてくる（`src/lib/flash.ts` に理由あり）。
 *
 * **URL の掃除は「表示した直後」ではなく「消える時」に行う。**
 * Next の App Router は `history.replaceState` を検知してルーターの状態を
 * 更新する。表示直後に掃除すると、その更新で通知が消えてしまい、一瞬も
 * 画面に出ない（実ブラウザで踏んだ）。消す時に掃除すれば、パラメータが
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
  const [dismissed, setDismissed] = useState(false);

  const dismiss = useCallback(() => {
    setDismissed(true);

    // URL から落とす。残したままだと再読み込みやブックマークの度に同じ通知が出る
    const next = new URLSearchParams(searchParams.toString());
    next.delete(FLASH_PARAM);
    next.delete(FLASH_REASON_PARAM);

    const query = next.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, [searchParams]);

  const message = flash?.message;

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, dismiss]);

  if (!flash || dismissed) return null;

  return (
    <div
      // 失敗は読み上げを割り込ませる。成功は手が空いた時でよい
      role={flash.tone === "error" ? "alert" : "status"}
      className="fixed left-1/2 top-20 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 px-1"
    >
      <div
        className={`flex items-start gap-3 rounded border px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-sm ${TONE_CLASSES[flash.tone]}`}
      >
        <p className="flex-1 text-left leading-relaxed">{flash.message}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="閉じる"
          className="-mr-1 shrink-0 rounded px-1 text-gray-400 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          ×
        </button>
      </div>
    </div>
  );
}
