import Link from "next/link";
import {
  searchMovie,
  discoverAnimeMovie,
  getAnimeMovieByKeywords,
  isJapaneseAnimeMovie,
} from "@/lib/tmdb";
import type { TMDbMovie } from "@/types/tmdb";
import { ANIME_GENRES, findGenre } from "@/lib/genres";
import MovieCard from "@/components/MovieCard";

function sanitize(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`]/g, "")
    .trim()
    .slice(0, 100);
}

interface SearchMoviesPageProps {
  searchParams: Promise<{
    q?: string;
    mode?: string;
    genre?: string;
    sort?: string;
    page?: string;
  }>;
}

const SORT_OPTIONS = [
  { value: "popularity.desc", label: "人気順（高い）" },
  { value: "vote_average.desc", label: "評価順（高い）" },
  { value: "primary_release_date.desc", label: "放送日（新しい）" },
  { value: "primary_release_date.asc", label: "放送日（古い）" },
];

function Pagination({
  currentPage,
  totalPages,
  baseParams,
}: {
  currentPage: number;
  totalPages: number;
  baseParams: Record<string, string>;
}) {
  if (totalPages <= 1) return null;

  function pageUrl(p: number) {
    const params = new URLSearchParams({ ...baseParams, page: String(p) });
    return `/search/movies?${params.toString()}`;
  }

  const range = 2;
  const pages: number[] = [];
  for (
    let i = Math.max(1, currentPage - range);
    i <= Math.min(totalPages, currentPage + range);
    i++
  ) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-10 flex-wrap">
      {currentPage > 1 && (
        <Link
          href={pageUrl(currentPage - 1)}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
        >
          ← 前へ
        </Link>
      )}
      {pages[0] > 1 && (
        <>
          <Link
            href={pageUrl(1)}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
          >
            1
          </Link>
          {pages[0] > 2 && <span className="text-gray-500 px-1">…</span>}
        </>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={pageUrl(p)}
          className={`px-3 py-2 rounded text-sm transition ${
            p === currentPage
              ? "bg-[#E50914] text-white font-bold"
              : "bg-gray-800 hover:bg-gray-700 text-white"
          }`}
        >
          {p}
        </Link>
      ))}
      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span className="text-gray-500 px-1">…</span>
          )}
          <Link
            href={pageUrl(totalPages)}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
          >
            {totalPages}
          </Link>
        </>
      )}
      {currentPage < totalPages && (
        <Link
          href={pageUrl(currentPage + 1)}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
        >
          次へ →
        </Link>
      )}
    </div>
  );
}

export default async function SearchMoviesPage({
  searchParams,
}: SearchMoviesPageProps) {
  const params = await searchParams;
  const rawQuery = params.q ?? "";
  const query = sanitize(rawQuery);
  const mode = params.mode === "filter" ? "filter" : "keyword";
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const genreIdParsed = params.genre ? parseInt(params.genre, 10) : NaN;
  const genreId = Number.isFinite(genreIdParsed) ? genreIdParsed : undefined;
  const selectedGenre = genreId ? findGenre(genreId) : undefined;
  const sort = params.sort ?? "popularity.desc";

  const hasFilters = !!selectedGenre || sort !== "popularity.desc";

  let results: TMDbMovie[] = [];
  let totalResults = 0;
  let totalPages = 1;
  let error: string | null = null;

  if (mode === "filter" || hasFilters) {
    try {
      if (selectedGenre?.filterType === "keyword" && selectedGenre.keyword) {
        const allKeywords = [
          selectedGenre.keyword,
          ...(selectedGenre.extraKeywords ?? []),
        ];
        const data = await getAnimeMovieByKeywords(allKeywords, currentPage);
        results = data.results;
        totalResults = data.total_results;
        totalPages = Math.min(data.total_pages, 500);
      } else {
        const data = await discoverAnimeMovie({
          genreId: selectedGenre?.id,
          sortBy: sort,
          page: currentPage,
        });
        results = data.results;
        totalResults = data.total_results;
        totalPages = Math.min(data.total_pages, 500);
      }
    } catch {
      error = "検索中にエラーが発生しました";
    }
  } else if (query) {
    try {
      const data = await searchMovie(query);
      const filtered = data.results.filter(isJapaneseAnimeMovie);
      results = filtered;
      totalResults = filtered.length;
      totalPages = Math.min(data.total_pages, 500);
    } catch {
      error = "検索中にエラーが発生しました";
    }
  }

  const baseParams: Record<string, string> = {};
  if (mode === "filter") baseParams.mode = "filter";
  if (query) baseParams.q = query;
  if (selectedGenre) baseParams.genre = String(selectedGenre.id);
  if (sort !== "popularity.desc") baseParams.sort = sort;

  const isFilterMode = mode === "filter";

  function tabUrl(targetMode: "keyword" | "filter") {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (targetMode === "filter") {
      sp.set("mode", "filter");
      if (selectedGenre) sp.set("genre", String(selectedGenre.id));
      if (sort !== "popularity.desc") sp.set("sort", sort);
    }
    const qs = sp.toString();
    return qs ? `/search/movies?${qs}` : "/search/movies";
  }

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-24">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="mb-8">
          <h1 className="text-white text-2xl font-bold mb-1">
            アニメ映画を検索
          </h1>
          {results.length > 0 && (
            <p className="text-gray-400 text-sm">
              {totalResults.toLocaleString()}件
              {totalPages > 1 && ` · ${currentPage} / ${totalPages} ページ`}
            </p>
          )}
        </div>

        {/* モード切り替えタブ */}
        <div className="flex border-b border-gray-700 mb-8 gap-0">
          <Link
            href={tabUrl("keyword")}
            className={`px-5 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
              !isFilterMode
                ? "text-white border-[#E50914]"
                : "text-gray-500 border-transparent hover:text-gray-300"
            }`}
          >
            🔍 キーワード検索
          </Link>
          <Link
            href={tabUrl("filter")}
            className={`px-5 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
              isFilterMode
                ? "text-white border-[#E50914]"
                : "text-gray-500 border-transparent hover:text-gray-300"
            }`}
          >
            🎛️ 詳細フィルター
          </Link>
          <Link
            href={`/search${query ? `?q=${encodeURIComponent(query)}` : ""}`}
            className="px-5 py-2.5 text-sm font-semibold transition text-gray-500 hover:text-gray-300 ml-auto"
          >
            📺 アニメ検索 →
          </Link>
        </div>

        {!isFilterMode && (
          <form method="GET" className="mb-10 max-w-xl">
            <div className="flex items-center border border-gray-600 bg-[#1a1a1a] rounded overflow-hidden focus-within:border-white transition-colors">
              <svg
                className="w-5 h-5 text-gray-400 ml-4 shrink-0"
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
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="映画タイトル、キーワードで検索"
                maxLength={100}
                autoComplete="off"
                className="flex-1 bg-transparent text-white px-4 py-3 text-sm outline-none placeholder-gray-500"
              />
              <button
                type="submit"
                className="bg-[#E50914] text-white px-5 py-3 text-sm font-semibold hover:bg-red-700 transition"
              >
                検索
              </button>
            </div>
          </form>
        )}

        {isFilterMode && (
          <form method="GET" className="mb-10">
            <input type="hidden" name="mode" value="filter" />
            {query && <input type="hidden" name="q" value={query} />}
            <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:gap-5">
                {/* ジャンル */}
                <div>
                  <label className="block text-gray-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                    ジャンル
                  </label>
                  <select
                    name="genre"
                    defaultValue={genreId ?? ""}
                    className="w-full bg-[#2a2a2a] border border-gray-600 text-white text-sm rounded px-3 py-2 outline-none focus:border-gray-400 transition"
                  >
                    <option value="">すべて</option>
                    {ANIME_GENRES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.emoji} {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 並び順 */}
                <div>
                  <label className="block text-gray-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                    並び順
                  </label>
                  <select
                    name="sort"
                    defaultValue={sort}
                    className="w-full bg-[#2a2a2a] border border-gray-600 text-white text-sm rounded px-3 py-2 outline-none focus:border-gray-400 transition"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-5">
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-[#E50914] text-white px-6 py-2.5 rounded font-semibold text-sm hover:bg-red-700 transition"
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
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  検索する
                </button>
                <Link
                  href={`/search/movies?mode=filter${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                  className="text-gray-400 hover:text-white text-sm transition"
                >
                  フィルターをリセット
                </Link>
              </div>
            </div>

            {hasFilters && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedGenre && (
                  <span className="flex items-center gap-1.5 bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full">
                    {selectedGenre.emoji} {selectedGenre.name}
                  </span>
                )}
                {sort !== "popularity.desc" && (
                  <span className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full">
                    {SORT_OPTIONS.find((o) => o.value === sort)?.label}
                  </span>
                )}
              </div>
            )}
          </form>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded mb-8">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4 xl:gap-5">
            {results.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}

        {results.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            baseParams={baseParams}
          />
        )}

        {(query || isFilterMode) && results.length === 0 && !error && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-2">
              条件に一致するアニメ映画は見つかりませんでした
            </p>
            <p className="text-gray-600 text-sm">
              {isFilterMode
                ? "フィルター条件を変えてみてください"
                : "別のキーワードで試してみてください"}
            </p>
          </div>
        )}

        {!query && !isFilterMode && results.length === 0 && !error && (
          <div className="text-center py-20">
            <svg
              className="w-16 h-16 text-gray-700 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-gray-400 mb-2">
              キーワードを入力するか、詳細フィルターで絞り込んでください
            </p>
            <p className="text-gray-600 text-sm">
              ジャンル・並び順で検索できます
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
