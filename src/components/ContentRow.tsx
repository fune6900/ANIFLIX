"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export interface ContentRowItem {
  id: number;
  title: string;
  year?: string;
  rating?: string;
  match?: number;
  gradient?: string;
  label?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string;
  genres?: string[];
  href?: string;
  isPortrait?: boolean;
}

interface ContentRowProps {
  title: string;
  items: ContentRowItem[];
  allHref?: string;
}

// モジュールレベルキャッシュ: animeId → YouTubeキー (null = 動画なし)
const videoCache = new Map<number, string | null>();

// ────── プレビューポップアップ ──────
interface PopupProps {
  item: ContentRowItem;
  rect: DOMRect;
  videoKey: string | null | undefined; // undefined = フェッチ中
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function PreviewPopup({
  item,
  rect,
  videoKey,
  onMouseEnter,
  onMouseLeave,
}: PopupProps) {
  const POPUP_W = 300;
  const POPUP_H_APPROX = 300;

  // 水平位置: カード中央に合わせ、画面端からはみ出さないよう補正
  let left = rect.left + rect.width / 2 - POPUP_W / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - POPUP_W - 8));

  // 垂直位置: 下に表示。画面下端に近ければ上に反転
  const showAbove = rect.bottom + POPUP_H_APPROX + 8 > window.innerHeight;
  const top = showAbove ? rect.top - POPUP_H_APPROX - 4 : rect.bottom + 4;

  return (
    <div
      style={{ position: "fixed", left, top, width: POPUP_W, zIndex: 9999 }}
      className="bg-[#181818] rounded-lg shadow-2xl overflow-hidden border border-gray-700 animate-fade-in"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 動画 or バックドロップ */}
      <div className="relative w-full aspect-video bg-black">
        {videoKey ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${videoKey}&rel=0`}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            title={item.title}
          />
        ) : item.backdropPath ? (
          <>
            <Image
              src={`https://image.tmdb.org/t/p/w500${item.backdropPath}`}
              alt={item.title}
              fill
              className="object-cover"
            />
            {/* フェッチ中はスピナー表示 */}
            {videoKey === undefined && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-950 to-slate-900">
            <span className="text-white font-bold text-sm px-3 text-center">
              {item.title}
            </span>
          </div>
        )}
      </div>

      <div className="p-3">
        {/* アクションボタン */}
        <div className="flex items-center gap-2 mb-2">
          {item.href ? (
            <Link
              href={item.href}
              className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-gray-200 transition"
            >
              <svg
                className="w-4 h-4 text-black"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </Link>
          ) : (
            <button className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-gray-200 transition">
              <svg
                className="w-4 h-4 text-black"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
          <button className="w-8 h-8 rounded-full border-2 border-gray-400 flex items-center justify-center hover:border-white transition text-white">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
          {item.href && (
            <Link
              href={item.href}
              className="w-8 h-8 rounded-full border-2 border-gray-400 flex items-center justify-center hover:border-white transition text-white ml-auto"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </Link>
          )}
        </div>

        {/* メタ情報 */}
        <div className="flex items-center gap-2 text-xs mb-1">
          {item.match != null && item.match > 0 && (
            <span className="text-green-400 font-bold">{item.match}%一致</span>
          )}
          {item.rating && (
            <span className="border border-gray-500 text-gray-400 px-1">
              {item.rating}
            </span>
          )}
          {item.year && <span className="text-gray-400">{item.year}</span>}
        </div>
        <p className="text-white text-xs font-semibold truncate mb-1">
          {item.title}
        </p>
        {item.overview ? (
          <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
            {item.overview}
          </p>
        ) : item.genres && item.genres.length > 0 ? (
          <div className="flex items-center gap-1 text-xs text-gray-400 flex-wrap">
            {item.genres.slice(0, 3).map((g, i) => (
              <span key={g}>
                {i > 0 && (
                  <span className="w-1 h-1 rounded-full bg-gray-500 inline-block mr-1" />
                )}
                {g}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ────── アニメカード ──────
function AnimeCard({ item }: { item: ContentRowItem }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);
  const [videoKey, setVideoKey] = useState<string | null | undefined>(
    undefined,
  );
  const [mounted, setMounted] = useState(false);

  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openPopup = useCallback(() => {
    if (!cardRef.current) return;
    setCardRect(cardRef.current.getBoundingClientRect());
    setShowPopup(true);

    // 声優カードはトレーラーなし
    if (item.isPortrait) return;

    // キャッシュ済みならそのまま使用
    if (videoCache.has(item.id)) {
      setVideoKey(videoCache.get(item.id) ?? null);
      return;
    }

    setVideoKey(undefined); // フェッチ中
    fetch(`/api/videos?id=${item.id}`)
      .then((r) => r.json())
      .then((data) => {
        const key = data.key ?? null;
        videoCache.set(item.id, key);
        setVideoKey(key);
      })
      .catch(() => {
        videoCache.set(item.id, null);
        setVideoKey(null);
      });
  }, [item.id, item.isPortrait]);

  const handleMouseEnter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHovered(true);
    // 800ms ホバーでポップアップ表示
    hoverTimer.current = setTimeout(openPopup, 800);
  }, [openPopup]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    // 遅延クローズ: ポップアップへのマウス移動でキャンセル可能
    closeTimer.current = setTimeout(() => {
      setHovered(false);
      setShowPopup(false);
      setVideoKey(undefined);
    }, 200);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // 声優カードは PC でも縦長を維持。それ以外のアニメ/映画カードは PC で横長
  const useLandscapeOnDesktop = !item.isPortrait;
  const widthClass = useLandscapeOnDesktop
    ? "w-[120px] sm:w-[140px] md:w-[260px] lg:w-[300px] xl:w-[340px] 2xl:w-[380px] 3xl:w-[420px]"
    : "w-[120px] sm:w-[140px] md:w-[155px] lg:w-[175px] xl:w-[200px] 2xl:w-[225px] 3xl:w-[250px]";
  const aspectClass = useLandscapeOnDesktop
    ? "aspect-[2/3] md:aspect-video"
    : "aspect-[2/3]";
  const desktopImg = item.backdropPath ?? item.posterPath;
  const mobileImg = item.posterPath ?? item.backdropPath;

  const thumbnail = (
    <div
      ref={cardRef}
      className={`relative flex-shrink-0 ${widthClass} cursor-pointer`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`relative rounded-sm overflow-hidden transition-all duration-200 ${
          hovered ? "scale-105 md:scale-105 z-10 shadow-2xl" : ""
        }`}
      >
        <div
          className={`w-full ${aspectClass} relative overflow-hidden`}
          style={
            !item.posterPath && !item.backdropPath
              ? {
                  background:
                    item.gradient ?? "linear-gradient(135deg,#1a1a2e,#16213e)",
                }
              : undefined
          }
        >
          {item.posterPath || item.backdropPath ? (
            <>
              {/* モバイル: 縦長ポスター */}
              <Image
                src={`https://image.tmdb.org/t/p/w342${mobileImg}`}
                alt={item.title}
                fill
                sizes="(max-width: 768px) 140px, 0px"
                className={`object-cover ${useLandscapeOnDesktop ? "md:hidden" : ""}`}
                loading="lazy"
              />
              {/* PC: 横長バックドロップ（アニメ/映画のみ） */}
              {useLandscapeOnDesktop && (
                <Image
                  src={`https://image.tmdb.org/t/p/w780${desktopImg}`}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 0px, (max-width: 1280px) 300px, 420px"
                  className="hidden md:block object-cover"
                  loading="lazy"
                />
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3">
              {item.label && (
                <span className="bg-[#E50914] text-white text-[10px] font-bold px-1.5 py-0.5 mb-2 tracking-widest">
                  {item.label}
                </span>
              )}
              <span className="text-white font-black text-sm md:text-base text-center leading-tight drop-shadow-lg">
                {item.title}
              </span>
            </div>
          )}

          {(item.posterPath || item.backdropPath) && item.label && (
            <div className="absolute top-1 left-1">
              <span className="bg-[#E50914] text-white text-[9px] font-bold px-1 py-0.5 tracking-widest">
                {item.label}
              </span>
            </div>
          )}

          {(item.posterPath || item.backdropPath) && (
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
          )}

          {/* PC: 横長表示ではタイトルをオーバーレイ */}
          {useLandscapeOnDesktop && (item.posterPath || item.backdropPath) && (
            <div className="hidden md:block absolute inset-x-0 bottom-0 p-2.5">
              <p className="text-white text-sm font-bold truncate drop-shadow-md">
                {item.title}
              </p>
              {item.year && (
                <p className="text-gray-300 text-[11px]">{item.year}</p>
              )}
            </div>
          )}
        </div>

        {/* 声優カード用インラインパネル（ポートレートのみ） */}
        {hovered && item.isPortrait && (
          <div className="hidden md:block absolute top-full left-0 right-0 bg-[#181818] rounded-b-md p-3 shadow-2xl z-20">
            <div className="flex items-center gap-2 mb-2">
              <button className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-gray-200 transition">
                <svg
                  className="w-4 h-4 text-black"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <button className="w-8 h-8 rounded-full border-2 border-gray-400 flex items-center justify-center hover:border-white transition text-white">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs mb-1">
              {item.match != null && item.match > 0 && (
                <span className="text-green-400 font-bold">
                  {item.match}%一致
                </span>
              )}
              {item.year && (
                <span className="text-gray-400 truncate">{item.year}</span>
              )}
            </div>
            <p className="text-white text-xs font-semibold truncate">
              {item.title}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {item.href ? <Link href={item.href}>{thumbnail}</Link> : thumbnail}
      {mounted &&
        showPopup &&
        cardRect &&
        !item.isPortrait &&
        createPortal(
          <PreviewPopup
            item={item}
            rect={cardRect}
            videoKey={videoKey}
            onMouseEnter={cancelClose}
            onMouseLeave={handleMouseLeave}
          />,
          document.body,
        )}
    </>
  );
}

// ────── ContentRow ──────
export default function ContentRow({ title, items, allHref }: ContentRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (dir: "left" | "right") => {
    if (!rowRef.current) return;
    const amount = rowRef.current.clientWidth * 0.75;
    rowRef.current.scrollBy({
      left: dir === "right" ? amount : -amount,
      behavior: "smooth",
    });
  };

  const handleScroll = () => {
    if (!rowRef.current) return;
    setShowLeftArrow(rowRef.current.scrollLeft > 0);
    setShowRightArrow(
      rowRef.current.scrollLeft + rowRef.current.clientWidth <
        rowRef.current.scrollWidth - 10,
    );
  };

  return (
    <div className="relative group/row mb-6 md:mb-8 max-w-[1920px] mx-auto">
      <h2 className="text-white font-bold text-base md:text-lg xl:text-xl mb-2 md:mb-3 px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20 flex items-center gap-2">
        {title}
        {allHref && (
          <Link
            href={allHref}
            className="text-[#54b9c5] text-sm font-semibold opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-1"
          >
            すべて見る
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        )}
      </h2>

      <div className="relative">
        {showLeftArrow && (
          <button
            onClick={() => scroll("left")}
            className="hidden md:flex absolute left-0 top-0 bottom-0 z-10 w-10 items-center justify-center bg-black/50 hover:bg-black/70 transition text-white opacity-0 group-hover/row:opacity-100"
          >
            <svg
              className="w-6 h-6"
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
        )}

        <div
          ref={rowRef}
          onScroll={handleScroll}
          className="flex gap-1 md:gap-2 xl:gap-3 overflow-x-auto scrollbar-hide px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => (
            <AnimeCard key={item.id} item={item} />
          ))}
        </div>

        {showRightArrow && (
          <button
            onClick={() => scroll("right")}
            className="hidden md:flex absolute right-0 top-0 bottom-0 z-10 w-10 items-center justify-center bg-black/50 hover:bg-black/70 transition text-white opacity-0 group-hover/row:opacity-100"
          >
            <svg
              className="w-6 h-6"
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
        )}
      </div>
    </div>
  );
}
