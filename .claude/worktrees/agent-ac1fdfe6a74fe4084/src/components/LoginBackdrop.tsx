"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { getImageUrl } from "@/lib/tmdb";
import type { LoginBackdrop as LoginBackdropItem } from "@/lib/login-backdrops";

interface LoginBackdropProps {
  items: LoginBackdropItem[];
}

/** 1 枚あたりの表示時間（ミリ秒） */
const SLIDE_INTERVAL_MS = 7000;

/** 次の 1 枚を読み込み始めるまでの待ち時間（ミリ秒）。切り替えより前に完了させる */
const PRELOAD_DELAY_MS = 5000;

/** クロスフェードの所要時間（ミリ秒）。CSS の duration と揃えること */
const FADE_DURATION_MS = 1500;

/**
 * ログイン画面の背景。
 * 静的 JSON から渡された横長バックドロップ（16:9）をクロスフェードで流す。
 * SP / PC どちらも同じ横長画像を object-cover で敷く。
 *
 * 全 6 枚を最初から DOM に置くと、`fixed inset-0` で全てビューポート内に入るため
 * ネイティブの遅延読み込みが働かず、合計 800KB 超を一度に取得してしまう。
 * ここは全ユーザーが必ず通る未認証の入口ページなので、実際に表示する直前まで
 * <Image> をマウントせず、次の 1 枚だけを先読みする。
 */
export default function LoginBackdrop({ items }: LoginBackdropProps) {
  const [current, setCurrent] = useState(0);
  // マウント済み（= 読み込みを開始してよい）インデックス。初期は 1 枚目のみ
  const [mounted, setMounted] = useState<number[]>([0]);

  const mount = useCallback((index: number) => {
    setMounted((prev) => (prev.includes(index) ? prev : [...prev, index]));
  }, []);

  // 次の 1 枚を切り替えの手前で先読みする
  useEffect(() => {
    if (items.length <= 1) return;
    const next = (current + 1) % items.length;
    const timer = setTimeout(() => mount(next), PRELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [current, items.length, mount]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(
      () => setCurrent((c) => (c + 1) % items.length),
      SLIDE_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden bg-[#141414]"
      aria-hidden="true"
    >
      {items.map((item, i) => (
        <div
          key={item.id}
          className={`absolute inset-0 transition-opacity ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
          style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
        >
          {mounted.includes(i) && (
            <Image
              src={getImageUrl(item.backdropPath, "w1280")}
              alt=""
              fill
              sizes="100vw"
              priority={i === 0}
              className="object-cover"
            />
          )}
        </div>
      ))}
      {/* 文字の可読性を確保する暗幕。上下は #141414 へ落として本文と馴染ませる */}
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#141414] via-[#141414]/30 to-[#141414]" />
    </div>
  );
}
