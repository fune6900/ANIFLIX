"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getImageUrl } from "@/lib/tmdb";
import type { LoginBackdrop as LoginBackdropItem } from "@/lib/login-backdrops";

interface LoginBackdropProps {
  items: LoginBackdropItem[];
}

/** 1 枚あたりの表示時間（ミリ秒） */
const SLIDE_INTERVAL_MS = 7000;

/**
 * ログイン画面の背景。
 * 静的 JSON から渡された横長バックドロップ（16:9）をクロスフェードで流す。
 * SP / PC どちらも同じ横長画像を object-cover で敷く。
 */
export default function LoginBackdrop({ items }: LoginBackdropProps) {
  const [current, setCurrent] = useState(0);

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
          className={`absolute inset-0 transition-opacity duration-[1500ms] ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={getImageUrl(item.backdropPath, "w1280")}
            alt=""
            fill
            sizes="100vw"
            priority={i === 0}
            className="object-cover"
          />
        </div>
      ))}
      {/* 文字の可読性を確保する暗幕。上下は #141414 へ落として本文と馴染ませる */}
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#141414] via-[#141414]/30 to-[#141414]" />
    </div>
  );
}
