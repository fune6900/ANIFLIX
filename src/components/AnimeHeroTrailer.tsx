"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties } from "react";

interface AnimeHeroTrailerProps {
  trailerKey: string | null;
  backdropUrl: string | null;
  title: string;
}

/**
 * 前景のキービジュアルの四辺を背景（ブラーの塗り）へ溶かすマスク。
 * 横・縦 2 本のグラデーションの共通部分（intersect）だけを残す。
 * Safari は標準の mask-* を持たない版があるため -webkit- も併記する
 */
const FEATHER_GRADIENTS =
  "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent), " +
  "linear-gradient(to bottom, transparent, #000 10%, #000 90%, transparent)";

const FEATHER_MASK: CSSProperties = {
  maskImage: FEATHER_GRADIENTS,
  WebkitMaskImage: FEATHER_GRADIENTS,
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
};

/**
 * アニメ詳細ヒーロー領域の背景にトレーラーをループ再生する。
 * - 初期状態は muted（autoplay 制約対応）
 * - 右下のボタンで mute/unmute を YouTube IFrame API の postMessage で切替
 * - トレーラー無し / 再生開始までは backdrop 画像を表示
 */
export default function AnimeHeroTrailer({
  trailerKey,
  backdropUrl,
  title,
}: AnimeHeroTrailerProps) {
  const [muted, setMuted] = useState(true);
  const [trailerVisible, setTrailerVisible] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const toggleMute = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const next = !muted;
    iframe.contentWindow.postMessage(
      JSON.stringify({
        event: "command",
        func: next ? "mute" : "unMute",
        args: [],
      }),
      "https://www.youtube-nocookie.com",
    );
    setMuted(next);
  };

  const trailerSrc = trailerKey
    ? `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=1&loop=1&playlist=${trailerKey}&controls=0&modestbranding=1&playsinline=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&enablejsapi=1`
    : null;

  return (
    // 箱は 16:9（YouTube の iframe と一致）。70vh の上限が効いて横長になった分は、
    // 前景を高さ基準で収め、余りを同じ画像のブラーで埋める（HeroSection と同じ手）
    <div className="relative w-full aspect-video max-h-[70vh] overflow-hidden bg-black">
      {backdropUrl ? (
        <>
          <Image
            src={backdropUrl}
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            className="object-cover scale-110 blur-2xl opacity-60"
          />
          {/* マスクは画像の実寸（16:9）の箱に掛ける。object-contain の img 要素は
              箱いっぱいに広がるため、要素へ直接掛けると画像の無い縁がフェードするだけになる */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-full aspect-video max-w-full"
            style={FEATHER_MASK}
          >
            <Image
              src={backdropUrl}
              alt={title}
              fill
              priority
              sizes="100vw"
              className={`object-contain object-center transition-opacity duration-700 ${
                trailerVisible ? "opacity-0" : "opacity-100"
              }`}
            />
          </div>
        </>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black" />
      )}

      {trailerSrc && (
        <iframe
          ref={iframeRef}
          src={trailerSrc}
          title={`${title} トレーラー`}
          allow="autoplay; encrypted-media"
          // 高さ基準で 16:9 に収める（はみ出して切る min-width/min-height 100% はやめた）
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-full aspect-video max-w-full pointer-events-none border-0"
          onLoad={() => {
            // YouTube が autoplay を蹴った場合に備えて少し待ってからフェード
            setTimeout(() => setTrailerVisible(true), 800);
          }}
        />
      )}

      {/* 下端だけを背景色へ寄せる。全面にかけると動画の下半分が沈み、
          終端を不透明にすると最下段（PV の放送日テロップ等）が消えるので半透明で止める */}
      <div className="absolute inset-x-0 bottom-0 h-1/6 bg-gradient-to-t from-[#141414]/60 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/70 via-transparent to-transparent pointer-events-none" />

      {trailerSrc && (
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "ミュートを解除" : "ミュートする"}
          aria-pressed={!muted}
          className="absolute bottom-4 right-4 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 backdrop-blur border border-white/40 text-white transition focus:outline-none focus:ring-2 focus:ring-[#54b9c5]"
        >
          {muted ? (
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
