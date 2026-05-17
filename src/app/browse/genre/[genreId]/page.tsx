import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getAnimeByGenre, getAnimeByKeywords } from "@/lib/tmdb";
import { ANIME_GENRES, findGenre } from "@/lib/genres";
import { detectDevice, itemsPerPage } from "@/lib/device";
import type { TMDbAnime } from "@/types/tmdb";
import SeasonAnimeCard from "@/components/SeasonAnimeCard";

interface GenrePageProps {
  params: Promise<{ genreId: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function GenrePage({
  params,
  searchParams,
}: GenrePageProps) {
  const { genreId: genreIdStr } = await params;
  const sp = await searchParams;

  const genreId = parseInt(genreIdStr, 10);
  if (isNaN(genreId)) notFound();

  const genre = findGenre(genreId);
  if (!genre) notFound();

  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const ua = (await headers()).get("user-agent") ?? "";
  const device = detectDevice(ua);
  const limit = itemsPerPage(device);

  let results: TMDbAnime[] = [];
  let totalPages = 1;
  let totalResults = 0;
  let error: string | null = null;

  try {
    let data;
    if (genre.filterType === "keyword" && genre.keyword) {
      const allKeywords = [genre.keyword, ...(genre.extraKeywords ?? [])];
      data = await getAnimeByKeywords(allKeywords, currentPage);
    } else {
      data = await getAnimeByGenre(genreId, currentPage);
    }
    if (data) {
      results = data.results.slice(0, limit);
      totalPages = data.total_pages;
      totalResults = data.total_results;
    }
  } catch {
    error = "データの取得に失敗しました";
  }

  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* ジャンルヘッダー */}
      <div
        className={`relative bg-gradient-to-b ${genre.color} to-[#141414] pt-24 pb-12`}
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(ellipse at 30% 50%, white 0%, transparent 60%)`,
          }}
        />
        {/* タイトルもコンテンツと同じ最大幅 + 横パディングで中央寄せ */}
        <div className="relative max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-200 transition text-sm mb-6"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            ホームに戻る
          </Link>
          <div className="flex items-end gap-4">
            <span className="text-5xl md:text-6xl select-none">
              {genre.emoji}
            </span>
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">ジャンル</p>
              <h1 className="text-white text-3xl md:text-4xl font-black">
                {genre.name}
              </h1>
              {totalResults > 0 && (
                <p className="text-gray-400 text-sm mt-1">
                  {totalResults.toLocaleString()}件
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-20">
        <div className="max-w-[1920px] mx-auto">
          {/* 他ジャンルへのクイックリンク（ヘッダーと被らないようにマージン正方向） */}
          <div className="flex gap-2 flex-wrap mb-8 mt-6">
            {ANIME_GENRES.filter((g) => g.id !== genreId).map((g) => (
              <Link
                key={g.id}
                href={`/browse/genre/${g.id}`}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-full transition"
              >
                <span>{g.emoji}</span>
                {g.name}
              </Link>
            ))}
          </div>

          {/* エラー */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded mb-8">
              {error}
            </div>
          )}

          {/* 結果なし */}
          {!error && results.length === 0 && (
            <div className="text-center py-24">
              <p className="text-gray-500 text-lg">
                このジャンルの作品が見つかりませんでした
              </p>
              <Link
                href="/"
                className="text-[#54b9c5] text-sm mt-3 inline-block hover:underline"
              >
                ホームに戻る
              </Link>
            </div>
          )}

          {/* グリッド */}
          {results.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4 xl:gap-5">
              {results.map((anime) => (
                <SeasonAnimeCard key={anime.id} anime={anime} />
              ))}
            </div>
          )}

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-12">
              {prevPage ? (
                <Link
                  href={`/browse/genre/${genreId}?page=${prevPage}`}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded transition text-sm font-semibold"
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  前のページ
                </Link>
              ) : (
                <span className="flex items-center gap-2 bg-gray-800 text-gray-600 px-5 py-2.5 rounded text-sm font-semibold cursor-not-allowed">
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  前のページ
                </span>
              )}
              <span className="text-gray-400 text-sm">
                {currentPage} / {totalPages}
              </span>
              {nextPage ? (
                <Link
                  href={`/browse/genre/${genreId}?page=${nextPage}`}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded transition text-sm font-semibold"
                >
                  次のページ
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              ) : (
                <span className="flex items-center gap-2 bg-gray-800 text-gray-600 px-5 py-2.5 rounded text-sm font-semibold cursor-not-allowed">
                  次のページ
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
