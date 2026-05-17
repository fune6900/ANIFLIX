import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getPopularAnime, getNewAnime, getTrendingAnime } from "@/lib/tmdb";
import { detectDevice, itemsPerPage } from "@/lib/device";
import type { TMDbAnime } from "@/types/tmdb";
import SeasonAnimeCard from "@/components/SeasonAnimeCard";

const CATEGORY_CONFIG = {
  popular: {
    title: "🔥 今期人気アニメ",
    fetcher: (page: number) => getPopularAnime(page),
    filter: null,
  },
  trending: {
    title: "📈 今週のトレンド",
    fetcher: (page: number) => getTrendingAnime(page),
    filter: (a: TMDbAnime) =>
      a.genre_ids.includes(16) || a.origin_country.includes("JP"),
  },
  new: {
    title: "🆕 新着アニメ",
    fetcher: (page: number) => getNewAnime(page),
    filter: null,
  },
} as const;

type Category = keyof typeof CATEGORY_CONFIG;

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

  if (!(category in CATEGORY_CONFIG)) notFound();

  const config = CATEGORY_CONFIG[category as Category];
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const ua = (await headers()).get("user-agent") ?? "";
  const device = detectDevice(ua);
  const limit = itemsPerPage(device);

  let results: TMDbAnime[] = [];
  let totalPages = 1;
  let totalResults = 0;
  let error: string | null = null;

  try {
    const data = await config.fetcher(currentPage);
    const filtered = config.filter
      ? data.results.filter(config.filter)
      : data.results;
    results = filtered.slice(0, limit);
    totalPages = data.total_pages;
    totalResults = data.total_results;
  } catch {
    error = "データの取得に失敗しました";
  }

  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-20">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
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
            {config.title}
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
