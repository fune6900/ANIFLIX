import Link from "next/link";
import { searchAnime, discoverAnime } from "@/lib/tmdb";
import type { TMDbAnime } from "@/types/tmdb";
import { ANIME_GENRES } from "@/lib/genres";
import SeasonAnimeCard from "@/components/SeasonAnimeCard";

function sanitize(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`]/g, "")
    .trim()
    .slice(0, 100);
}

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    mode?: string;
    genre?: string;
    yearFrom?: string;
    yearTo?: string;
    minScore?: string;
    sort?: string;
    status?: string;
    page?: string;
  }>;
}

const SORT_OPTIONS = [
  { value: "popularity.desc", label: "人気順（高い）" },
  { value: "vote_average.desc", label: "評価順（高い）" },
  { value: "first_air_date.desc", label: "放送日順（新しい）" },
  { value: "first_air_date.asc", label: "放送日順（古い）" },
];

const STATUS_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "0", label: "放送中" },
  { value: "2", label: "完結" },
  { value: "3", label: "制作中" },
];

const SCORE_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "5", label: "★5.0以上" },
  { value: "6", label: "★6.0以上" },
  { value: "7", label: "★7.0以上" },
  { value: "8", label: "★8.0以上" },
];

// ジャンルフィルター用（IDベースのみ。キーワードベースはdiscoverに不向きなので除外）
const FILTER_GENRES = ANIME_GENRES.filter((g) => g.filterType === "genre");

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
    return `/search?${params.toString()}`;
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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const rawQuery = params.q ?? "";
  const query = sanitize(rawQuery);
  const mode = params.mode === "filter" ? "filter" : "keyword";
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // フィルター値（parseInt が NaN を返した場合は undefined に正規化）
  const genreIdParsed = params.genre ? parseInt(params.genre, 10) : NaN;
  const genreId = Number.isFinite(genreIdParsed) ? genreIdParsed : undefined;
  const yearFrom = params.yearFrom ? parseInt(params.yearFrom, 10) : undefined;
  const yearTo = params.yearTo ? parseInt(params.yearTo, 10) : undefined;
  const minScore = params.minScore ? parseFloat(params.minScore) : undefined;
  const sort = params.sort ?? "popularity.desc";
  const status = params.status ?? "";

  // フィルターが1つでも設定されているか
  const hasFilters = !!(
    genreId ||
    yearFrom ||
    yearTo ||
    minScore ||
    params.status
  );

  let results: TMDbAnime[] = [];
  let totalResults = 0;
  let totalPages = 1;
  let error: string | null = null;

  if (mode === "filter" || hasFilters) {
    // 詳細検索モード → discover
    try {
      const data = await discoverAnime({
        genreId,
        yearFrom,
        yearTo,
        minScore,
        sortBy: sort,
        status: status || undefined,
        page: currentPage,
      });
      results = data.results;
      totalResults = data.total_results;
      totalPages = Math.min(data.total_pages, 500);
    } catch {
      error = "検索中にエラーが発生しました";
    }
  } else if (query) {
    // キーワード検索モード → search/tv
    try {
      const data = await searchAnime(query);
      results = data.results;
      totalResults = data.total_results;
      totalPages = Math.min(data.total_pages, 500);
    } catch {
      error = "検索中にエラーが発生しました";
    }
  }

  // ページネーション用ベースパラメータ
  const baseParams: Record<string, string> = {};
  if (mode === "filter") baseParams.mode = "filter";
  if (query) baseParams.q = query;
  if (genreId) baseParams.genre = String(genreId);
  if (yearFrom) baseParams.yearFrom = String(yearFrom);
  if (yearTo) baseParams.yearTo = String(yearTo);
  if (minScore) baseParams.minScore = String(minScore);
  if (sort !== "popularity.desc") baseParams.sort = sort;
  if (status) baseParams.status = status;

  const isFilterMode = mode === "filter";
  const selectedGenre = FILTER_GENRES.find((g) => g.id === genreId);

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-24">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="mb-8">
          <h1 className="text-white text-2xl font-bold mb-1">アニメを検索</h1>
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
            href="/search"
            className={`px-5 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
              !isFilterMode
                ? "text-white border-[#E50914]"
                : "text-gray-500 border-transparent hover:text-gray-300"
            }`}
          >
            🔍 キーワード検索
          </Link>
          <Link
            href="/search?mode=filter"
            className={`px-5 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
              isFilterMode
                ? "text-white border-[#E50914]"
                : "text-gray-500 border-transparent hover:text-gray-300"
            }`}
          >
            🎛️ 詳細フィルター
          </Link>
        </div>

        {/* キーワード検索フォーム */}
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
                placeholder="タイトル、ジャンルで検索"
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

        {/* 詳細フィルターフォーム */}
        {isFilterMode && (
          <form method="GET" className="mb-10">
            <input type="hidden" name="mode" value="filter" />
            <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 xl:gap-5">
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
                    {FILTER_GENRES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.emoji} {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 放送年（開始） */}
                <div>
                  <label className="block text-gray-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                    放送年（開始）
                  </label>
                  <input
                    type="number"
                    name="yearFrom"
                    defaultValue={yearFrom ?? ""}
                    placeholder="例: 2010"
                    min={1960}
                    max={2030}
                    className="w-full bg-[#2a2a2a] border border-gray-600 text-white text-sm rounded px-3 py-2 outline-none focus:border-gray-400 transition placeholder-gray-600"
                  />
                </div>

                {/* 放送年（終了） */}
                <div>
                  <label className="block text-gray-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                    放送年（終了）
                  </label>
                  <input
                    type="number"
                    name="yearTo"
                    defaultValue={yearTo ?? ""}
                    placeholder="例: 2024"
                    min={1960}
                    max={2030}
                    className="w-full bg-[#2a2a2a] border border-gray-600 text-white text-sm rounded px-3 py-2 outline-none focus:border-gray-400 transition placeholder-gray-600"
                  />
                </div>

                {/* 最低評価 */}
                <div>
                  <label className="block text-gray-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                    最低評価
                  </label>
                  <select
                    name="minScore"
                    defaultValue={minScore ?? ""}
                    className="w-full bg-[#2a2a2a] border border-gray-600 text-white text-sm rounded px-3 py-2 outline-none focus:border-gray-400 transition"
                  >
                    {SCORE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ステータス */}
                <div>
                  <label className="block text-gray-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                    ステータス
                  </label>
                  <select
                    name="status"
                    defaultValue={status}
                    className="w-full bg-[#2a2a2a] border border-gray-600 text-white text-sm rounded px-3 py-2 outline-none focus:border-gray-400 transition"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ソート順 */}
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
                  href="/search?mode=filter"
                  className="text-gray-400 hover:text-white text-sm transition"
                >
                  フィルターをリセット
                </Link>
              </div>
            </div>

            {/* アクティブフィルターバッジ */}
            {hasFilters && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedGenre && (
                  <span className="flex items-center gap-1.5 bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full">
                    {selectedGenre.emoji} {selectedGenre.name}
                  </span>
                )}
                {yearFrom && (
                  <span className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full">
                    {yearFrom}年〜
                  </span>
                )}
                {yearTo && (
                  <span className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full">
                    〜{yearTo}年
                  </span>
                )}
                {minScore && (
                  <span className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full">
                    ★{minScore}以上
                  </span>
                )}
                {status && (
                  <span className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full">
                    {STATUS_OPTIONS.find((o) => o.value === status)?.label}
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

        {/* エラー */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded mb-8">
            {error}
          </div>
        )}

        {/* 結果グリッド */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4 xl:gap-5">
            {results.map((anime) => (
              <SeasonAnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        )}

        {/* ページネーション */}
        {results.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            baseParams={baseParams}
          />
        )}

        {/* 結果なし */}
        {(query || isFilterMode) && results.length === 0 && !error && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-2">
              条件に一致するアニメは見つかりませんでした
            </p>
            <p className="text-gray-600 text-sm">
              {isFilterMode
                ? "フィルター条件を変えてみてください"
                : "別のキーワードで試してみてください"}
            </p>
          </div>
        )}

        {/* 初期表示 */}
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
              ジャンル・年・評価・ステータス・ソート順で検索できます
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
