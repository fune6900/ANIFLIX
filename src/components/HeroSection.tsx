"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { getImageUrl } from "@/lib/tmdb";

export interface HeroItem {
  id: number;
  title: string;
  overview: string;
  backdropPath: string | null;
  year?: string;
  match?: number;
  href: string;
  trailerKey?: string;
}

interface HeroSectionProps {
  items: HeroItem[];
}

export default function HeroSection({ items }: HeroSectionProps) {
  const [current, setCurrent] = useState(0);
  const [modalKey, setModalKey] = useState<string | null>(null);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % items.length);
  }, [items.length]);

  // モーダルが開いている間は自動スライドを停止
  useEffect(() => {
    if (items.length <= 1 || modalKey) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next, items.length, modalKey]);

  // ESC キーでモーダルを閉じる
  useEffect(() => {
    if (!modalKey) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalKey(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modalKey]);

  if (items.length === 0) return null;

  const item = items[current];

  return (
    <>
      <section className="group relative w-full aspect-video max-h-[85vh] min-h-[400px] overflow-hidden">
        {/* 背景: 全スライドを重ねて opacity でクロスフェード */}
        {items.map((it, i) =>
          it.backdropPath ? (
            <div
              key={it.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                i === current ? "opacity-100" : "opacity-0"
              }`}
            >
              {/* 箱の縦横比が 16:9 とずれた時に余る領域。同じ画像を引き伸ばして
                  ぼかし、黒帯を作らずに埋める（前景は切らない） */}
              <Image
                src={getImageUrl(it.backdropPath, "w780")}
                alt=""
                aria-hidden="true"
                fill
                sizes="100vw"
                className="object-cover scale-110 blur-2xl opacity-60"
                priority={i < 2}
              />
              {/* 前景: キービジュアル全体を切らずに収める */}
              <Image
                src={getImageUrl(it.backdropPath, "original")}
                alt={it.title}
                fill
                sizes="100vw"
                className="object-contain object-center"
                priority={i < 2}
              />
            </div>
          ) : (
            <div
              key={it.id}
              className={`absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 transition-opacity duration-1000 ${
                i === current ? "opacity-100" : "opacity-0"
              }`}
            >
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `radial-gradient(ellipse at 20% 50%, #7c3aed 0%, transparent 50%),
                                    radial-gradient(ellipse at 80% 20%, #1e40af 0%, transparent 50%),
                                    radial-gradient(ellipse at 60% 80%, #be185d 0%, transparent 40%)`,
                }}
              />
              <div className="absolute top-1/4 right-8 md:right-24 text-white/5 text-[120px] md:text-[200px] font-black leading-none select-none pointer-events-none">
                ANIME
              </div>
            </div>
          ),
        )}

        {/* 左フェードオーバーレイ（背景画像の視認性確保のため軽めに） */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/95 via-[#141414]/30 to-transparent" />
        {/* 下フェードオーバーレイ */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#141414] to-transparent" />

        {/* コンテンツ（スライドごとに再レンダリングしてアニメーション） */}
        <div
          key={current}
          className="absolute bottom-[20%] md:bottom-[28%] left-4 md:left-12 lg:left-16 xl:left-20 2xl:left-28 4xl:left-32 5xl:left-40 max-w-xs sm:max-w-md md:max-w-xl lg:max-w-2xl xl:max-w-3xl 4xl:max-w-4xl 5xl:max-w-5xl animate-fade-in"
        >
          {/* 年 */}
          {item.year && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gray-300 text-xs xl:text-sm">
                {item.year}
              </span>
            </div>
          )}

          {/* タイトル */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-black text-white leading-tight drop-shadow-xl mb-3">
            {item.title}
          </h1>

          {/* スコア */}
          <div className="flex items-center gap-3 mb-3">
            {item.match !== undefined && (
              <span className="text-green-400 font-bold text-sm">
                {item.match}%一致
              </span>
            )}
            <span className="border border-gray-500 text-gray-400 text-xs px-1.5 py-0.5">
              HD
            </span>
          </div>

          {/* あらすじ */}
          {item.overview && (
            <p className="hidden sm:block text-gray-200 text-sm md:text-base xl:text-lg 2xl:text-xl 4xl:text-2xl leading-relaxed line-clamp-3 mb-5 drop-shadow">
              {item.overview}
            </p>
          )}

          {/* ボタン */}
          <div className="flex items-center gap-3">
            {item.trailerKey ? (
              <button
                onClick={() => setModalKey(item.trailerKey!)}
                className="flex items-center gap-2 bg-white text-black font-bold px-5 md:px-8 py-2 md:py-3 rounded text-sm md:text-base hover:bg-white/80 transition-colors"
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                再生
              </button>
            ) : (
              <Link
                href={item.href}
                className="flex items-center gap-2 bg-white text-black font-bold px-5 md:px-8 py-2 md:py-3 rounded text-sm md:text-base hover:bg-white/80 transition-colors"
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                再生
              </Link>
            )}
            <Link
              href={item.href}
              className="flex items-center gap-2 bg-gray-500/60 text-white font-bold px-5 md:px-8 py-2 md:py-3 rounded text-sm md:text-base hover:bg-gray-500/40 transition-colors backdrop-blur-sm"
            >
              <svg
                className="w-5 h-5 md:w-6 md:h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="hidden sm:inline">詳細情報</span>
            </Link>
          </div>
        </div>

        {/* スライドドット */}
        {items.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`${i + 1} 枚目のスライドへ`}
                aria-current={i === current}
                className={`h-2 xl:h-2.5 rounded-full transition-all duration-300 ${
                  i === current
                    ? "bg-white w-6 xl:w-8"
                    : "bg-white/40 hover:bg-white/70 w-2 xl:w-2.5"
                }`}
              />
            ))}
          </div>
        )}

        {/* 左右の矢印 */}
        {items.length > 1 && (
          <>
            <button
              onClick={() =>
                setCurrent((c) => (c - 1 + items.length) % items.length)
              }
              aria-label="前のスライド"
              className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-11 h-11 md:w-12 md:h-12 xl:w-14 xl:h-14 rounded-full bg-black/50 group-hover:bg-black/70 hover:!bg-black/85 text-white flex items-center justify-center transition-colors backdrop-blur-sm border border-white/20 focus:outline-none focus:ring-2 focus:ring-[#54b9c5]"
            >
              <svg
                className="w-5 h-5 md:w-6 md:h-6 xl:w-7 xl:h-7"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={next}
              aria-label="次のスライド"
              className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-11 h-11 md:w-12 md:h-12 xl:w-14 xl:h-14 rounded-full bg-black/50 group-hover:bg-black/70 hover:!bg-black/85 text-white flex items-center justify-center transition-colors backdrop-blur-sm border border-white/20 focus:outline-none focus:ring-2 focus:ring-[#54b9c5]"
            >
              <svg
                className="w-5 h-5 md:w-6 md:h-6 xl:w-7 xl:h-7"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </>
        )}
      </section>

      {/* YouTubeトレーラーモーダル */}
      {modalKey && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setModalKey(null)}
        >
          {/* 閉じるボタン */}
          <button
            className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition z-10"
            onClick={() => setModalKey(null)}
            aria-label="閉じる"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* タイトル */}
          <div className="absolute top-4 left-4 md:top-6 md:left-6">
            <p className="text-white text-sm font-semibold opacity-80">
              {item.title}
            </p>
          </div>

          {/* iframe ラッパー（クリックでモーダルが閉じないよう伝播を止める） */}
          <div
            className="relative w-full max-w-5xl mx-4 md:mx-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative w-full"
              style={{ paddingBottom: "56.25%" }}
            >
              <iframe
                className="absolute inset-0 w-full h-full rounded-md shadow-2xl"
                src={`https://www.youtube.com/embed/${modalKey}?autoplay=1&rel=0&modestbranding=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`${item.title} トレーラー`}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
