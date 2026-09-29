import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { parsePageParam } from "@/lib/tmdb";
import { detectDevice, itemsPerPage } from "@/lib/device";
import {
  browseCategoryTitle,
  isBrowseCategory,
  loadBrowseCategory,
} from "@/lib/browse-category";
import type { TMDbAnime } from "@/types/tmdb";
import SeasonAnimeCard from "@/components/SeasonAnimeCard";

interface BrowsePageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function BrowsePage({
  params,
  searchParams,
}: BrowsePageProps) {
  const { category } = await params;
  const sp = await searchParams;

  if (!isBrowseCategory(category)) notFound();

  const title = browseCategoryTitle(category);
  let currentPage = parsePageParam(sp.page);

  const ua = (await headers()).get("user-agent") ?? "";
  const device = detectDevice(ua);
  const limit = itemsPerPage(device);

  let results: TMDbAnime[] = [];
  let totalPages = 1;
  let totalResults = 0;
  let error: string | null = null;

  try {
    // トレンド・新着は 70 件、人気はデバイス別件数（lib/browse-category.ts）
    const data = await loadBrowseCategory(category, currentPage, limit);
    currentPage = data.page;
    results = data.results;
    totalPages = data.totalPages;
    totalResults = data.totalResults;
  } catch {
    error = "データの取得に失敗しました";
  }

  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-20">
      <div className="site-container">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-300 transition text-sm mb-4"
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
          <h1 className="text-white text-2xl md:text-3xl font-black">
            {title}
          </h1>
          {totalResults > 0 && (
            <p className="text-gray-500 text-sm mt-1">
              {totalResults.toLocaleString()}件
            </p>
          )}
        </div>

        {/* エラー */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded mb-8">
            {error}
          </div>
        )}

        {/* グリッド */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 md:gap-4 xl:gap-5">
            {results.map((anime) => (
              <SeasonAnimeCard key={anime.id} entry={{ kind: "tv", anime }} />
            ))}
          </div>
        )}

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-12">
            {prevPage ? (
              <Link
                href={`/browse/${category}?page=${prevPage}`}
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
                href={`/browse/${category}?page=${nextPage}`}
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
  );
}
