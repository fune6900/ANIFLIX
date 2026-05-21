"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SearchDropdown from "@/components/SearchDropdown";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#141414]"
          : "bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className="max-w-[1920px] mx-auto flex items-center justify-between px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-4">
        {/* ロゴ */}
        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/">
            <span className="text-[#E50914] font-extrabold text-2xl md:text-3xl tracking-widest select-none cursor-pointer">
              ANIFLIX
            </span>
          </Link>

          {/* デスクトップナビ */}
          <nav className="hidden md:flex items-center gap-3 text-sm text-gray-300">
            <Link
              href="/"
              className="text-white font-semibold hover:text-gray-300 transition"
            >
              ホーム
            </Link>
            <Link
              href="/search?q=アニメ"
              className="hover:text-white transition"
            >
              アニメ
            </Link>
            <Link href="/browse/movies" className="hover:text-white transition">
              映画
            </Link>

            {/* 放送中 */}
            <Link
              href="/browse/airing"
              className="flex items-center gap-1 hover:text-white transition"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              放送中
            </Link>

            {/* シーズン → 専用ページへ */}
            <Link
              href="/browse/seasons"
              className="hover:text-white transition"
            >
              シーズン
            </Link>

            {/* ジャンル → 専用ページへ */}
            <Link href="/browse/genres" className="hover:text-white transition">
              ジャンル
            </Link>

            {/* 年代 → 専用ページへ */}
            <Link href="/browse/eras" className="hover:text-white transition">
              年代
            </Link>

            <Link href="/voice-actors" className="hover:text-white transition">
              声優
            </Link>

            <Link
              href="/search/characters"
              className="hover:text-white transition"
            >
              キャラ
            </Link>

            {/* 診断 */}
            <Link
              href="/diagnosis"
              className="flex items-center gap-1 text-[#E50914] hover:text-red-400 font-bold transition"
            >
              <span>✦</span>
              診断
            </Link>
          </nav>

          {/* モバイルハンバーガー */}
          <div className="md:hidden relative">
            <button
              className="flex items-center gap-1 text-sm text-white"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              ブラウズ
              <svg
                className={`w-4 h-4 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute top-8 left-0 bg-[#141414] border border-gray-600 shadow-xl w-56 py-2 z-50 max-h-[80vh] overflow-y-auto">
                <div className="absolute -top-2 left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-600" />
                <Link
                  href="/"
                  className="block px-5 py-2 text-sm text-gray-200 hover:text-white hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  ホーム
                </Link>
                <Link
                  href="/search?q=アニメ"
                  className="block px-5 py-2 text-sm text-gray-200 hover:text-white hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  アニメ
                </Link>
                <Link
                  href="/browse/movies"
                  className="block px-5 py-2 text-sm text-gray-200 hover:text-white hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  映画
                </Link>
                <Link
                  href="/browse/airing"
                  className="flex items-center gap-2 px-5 py-2 text-sm text-gray-200 hover:text-white hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  放送中
                </Link>
                <Link
                  href="/browse/seasons"
                  className="block px-5 py-2 text-sm text-gray-200 hover:text-white hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  シーズン
                </Link>
                <Link
                  href="/browse/genres"
                  className="block px-5 py-2 text-sm text-gray-200 hover:text-white hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  ジャンル
                </Link>
                <Link
                  href="/browse/eras"
                  className="block px-5 py-2 text-sm text-gray-200 hover:text-white hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  年代
                </Link>

                <Link
                  href="/voice-actors"
                  className="block px-5 py-2 text-sm text-gray-200 hover:text-white hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  声優
                </Link>
                <Link
                  href="/search/characters"
                  className="block px-5 py-2 text-sm text-gray-200 hover:text-white hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  キャラ
                </Link>
                <Link
                  href="/diagnosis"
                  className="flex items-center gap-2 px-5 py-2 text-sm text-[#E50914] font-bold hover:text-red-400 hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  <span>✦</span>
                  診断
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* 右側アイコン */}
        <div className="flex items-center gap-3 md:gap-5">
          <div className="flex items-center">
            {searchOpen ? (
              <SearchDropdown onClose={() => setSearchOpen(false)} />
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="text-white hover:text-gray-300 transition"
                aria-label="検索を開く"
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            )}
          </div>
          <button
            className="hidden md:block text-white hover:text-gray-300 transition"
            aria-label="通知"
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
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
