import Link from "next/link";
import { notFound } from "next/navigation";
import { parsePageParam } from "@/lib/tmdb";
import { ANIME_GENRES, findGenre } from "@/lib/genres";
import { loadGenreMovieList, movieGenreListHref } from "@/lib/movie-list";
import { toMovieEntry } from "@/lib/movie-card-item";
import { filterEntries, parseBrowseFilter } from "@/lib/browse-filter";
import type { SeasonalEntry } from "@/lib/seasonal-anime";
import MovieListBody from "@/components/MovieListBody";

interface GenreMoviesPageProps {
  params: Promise<{ genreId: string }>;
  searchParams: Promise<{
    page?: string;
    service?: string | string[];
  }>;
}

/** アニメ映画のジャンル別（ホームのジャンル行の「すべて見る」） */
export default async function GenreMoviesPage({
  params,
  searchParams,
}: GenreMoviesPageProps) {
  const { genreId: raw } = await params;
  const sp = await searchParams;

  // ANIME_GENRES に照合できた ID だけを TMDb へ渡す（キャッシュキーを増やさない）
  const genre = /^\d{1,6}$/.test(raw) ? findGenre(Number(raw)) : undefined;
  if (!genre) notFound();

  let currentPage = parsePageParam(sp.page);
  // 既にこのジャンルに絞ったページなので、URL の genre= は読まない（ページ送りにも引き継がない）
  const filter = parseBrowseFilter({ service: sp.service });
  const basePath = movieGenreListHref(genre.id);

  let entries: SeasonalEntry[] = [];
  let fetchedCount = 0;
  let totalPages = 1;
  let totalResults = 0;
  let error: string | null = null;

  try {
    const data = await loadGenreMovieList(genre, currentPage);
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
    <div className="min-h-screen bg-[#141414]">
      <div
        className={`relative bg-gradient-to-b ${genre.color} to-[#141414] pt-24 pb-12`}
      >
        <div className="site-container relative">
          <Link
            href="/browse/movies"
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
            アニメ映画に戻る
          </Link>
          <div className="flex items-end gap-4">
            <span className="text-5xl md:text-6xl select-none">
              {genre.emoji}
            </span>
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">
                アニメ映画 / ジャンル
              </p>
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

      <div className="site-container pb-20">
        <div className="flex gap-2 flex-wrap mb-8 mt-6">
          {ANIME_GENRES.filter((g) => g.id !== genre.id).map((g) => (
            <Link
              key={g.id}
              href={movieGenreListHref(g.id)}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-full transition"
            >
              <span>{g.emoji}</span>
              {g.name}
            </Link>
          ))}
        </div>

        <MovieListBody
          basePath={basePath}
          filter={filter}
          showGenre={false}
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
