import Link from "next/link";
import { parsePageParam } from "@/lib/tmdb";
import { MOVIE_LATEST_LIST_HREF, loadLatestMovieList } from "@/lib/movie-list";
import { toMovieEntry } from "@/lib/movie-card-item";
import { filterEntries, parseBrowseFilter } from "@/lib/browse-filter";
import type { SeasonalEntry } from "@/lib/seasonal-anime";
import BrowseListBody from "@/components/BrowseListBody";

interface LatestMoviesPageProps {
  searchParams: Promise<{
    page?: string;
    genre?: string | string[];
    service?: string | string[];
  }>;
}

/** アニメ映画の最新作（ホームの「最新作」行の「すべて見る」） */
export default async function LatestMoviesPage({
  searchParams,
}: LatestMoviesPageProps) {
  const sp = await searchParams;
  let currentPage = parsePageParam(sp.page);
  const filter = parseBrowseFilter(sp);

  let entries: SeasonalEntry[] = [];
  let fetchedCount = 0;
  let totalPages = 1;
  let totalResults = 0;
  let error: string | null = null;

  try {
    const data = await loadLatestMovieList(currentPage);
    currentPage = data.page;
    const pageEntries = data.results.map(toMovieEntry);
    fetchedCount = pageEntries.length;
    // 取得済みの作品の中だけを絞る
    entries = await filterEntries(pageEntries, filter);
    totalPages = data.totalPages;
    totalResults = data.totalResults;
  } catch {
    error = "データの取得に失敗しました";
  }

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-20">
      <div className="site-container">
        <div className="mb-8">
          <Link
            href="/browse/movies"
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
            アニメ映画に戻る
          </Link>
          <p className="text-gray-400 text-sm font-medium mb-1">アニメ映画</p>
          <h1 className="text-white text-2xl md:text-3xl font-black">
            🆕 最新作
          </h1>
          {totalResults > 0 && (
            <p className="text-gray-500 text-sm mt-1">
              {totalResults.toLocaleString()}件
            </p>
          )}
        </div>

        <BrowseListBody
          basePath={MOVIE_LATEST_LIST_HREF}
          filter={filter}
          showGenre
          entries={entries}
          fetchedCount={fetchedCount}
          error={error}
          currentPage={currentPage}
          totalPages={totalPages}
        />
      </div>
    </div>
  );
}
