import Link from "next/link";
import {
  searchAnime,
  discoverAnime,
  getAnimeByKeywords,
  isJapaneseAnimeTV,
} from "@/lib/tmdb";
import type { TMDbAnime } from "@/types/tmdb";
import { ANIME_GENRES, findGenre } from "@/lib/genres";
import {
  findSeason,
  getRecentSeasons,
  isValidSeason,
  type SeasonSlug,
} from "@/lib/seasons";
import SearchModeTabs from "@/components/SearchModeTabs";
import SeasonAnimeCard from "@/components/SeasonAnimeCard";
import SearchPageInput from "@/components/SearchPageInput";

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
    season?: string;
    sort?: string;
    page?: string;
  }>;
}

const SORT_OPTIONS = [
  { value: "popularity.desc", label: "人気順（高い）" },
  { value: "vote_average.desc", label: "評価順（高い）" },
  { value: "first_air_date.desc", label: "放送日順（新しい）" },
  { value: "first_air_date.asc", label: "放送日順（古い）" },
];

const RECENT_SEASONS = getRecentSeasons(20);

function parseSeasonParam(raw: string | undefined) {
  if (!raw) return undefined;
  const m = raw.match(/^(\d{4})-(winter|spring|summer|fall)$/);
  if (!m) return undefined;
  const year = parseInt(m[1], 10);
  if (!Number.isFinite(year)) return undefined;
  if (!isValidSeason(m[2])) return undefined;
  return findSeason(year, m[2] as SeasonSlug);
}

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

  // フィルター値
  const genreIdParsed = params.genre ? parseInt(params.genre, 10) : NaN;
  const genreId = Number.isFinite(genreIdParsed) ? genreIdParsed : undefined;
  const selectedGenre = genreId ? findGenre(genreId) : undefined;
  const seasonParam = params.season ?? "";
  const selectedSeason = parseSeasonParam(seasonParam);
  const sort = params.sort ?? "popularity.desc";

  // フィルターが 1 つでも設定されているか
  const hasFilters = !!(selectedGenre || selectedSeason);

  let results: TMDbAnime[] = [];
  let totalResults = 0;
  let totalPages = 1;
  let error: string | null = null;

  if (mode === "filter" || hasFilters) {
    try {
      if (selectedGenre?.filterType === "keyword" && selectedGenre.keyword) {
        // キーワードベースジャンル → keyword discover（シーズン範囲はサーバ側で適用して
        // totalResults / totalPages の整合を保つ）
        const allKeywords = [
          selectedGenre.keyword,
          ...(selectedGenre.extraKeywords ?? []),
        ];
        const data = await getAnimeByKeywords(allKeywords, currentPage, {
          dateFrom: selectedSeason?.dateFrom,
          dateTo: selectedSeason?.dateTo,
          sortBy: sort,
        });
        results = data.results;
        totalResults = data.total_results;
        totalPages = Math.min(data.total_pages, 500);
      } else {
        const data = await discoverAnime({
          genreId: selectedGenre?.id,
          dateFrom: selectedSeason?.dateFrom,
          dateTo: selectedSeason?.dateTo,
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
    // キーワード検索モード → search/tv（アニメ以外を除外）
    try {
      const data = await searchAnime(query);
      const filtered = data.results.filter(isJapaneseAnimeTV);
      results = filtered;
      totalResults = filtered.length;
      totalPages = Math.min(data.total_pages, 500);
    } catch {
      error = "検索中にエラーが発生しました";
    }
  }

  // ページネーション用ベースパラメータ
  const baseParams: Record<string, string> = {};
  if (mode === "filter") baseParams.mode = "filter";
  if (query) baseParams.q = query;
  if (selectedGenre) baseParams.genre = String(selectedGenre.id);
  if (selectedSeason) baseParams.season = seasonParam;
  if (sort !== "popularity.desc") baseParams.sort = sort;

  const isFilterMode = mode === "filter";

  // キーワードモード用の hidden fields（フィルター値の引き継ぎ）
  const keywordHiddenFields = [
    ...(selectedGenre
      ? [{ name: "genre", value: String(selectedGenre.id) }]
      : []),
    ...(selectedSeason ? [{ name: "season", value: seasonParam }] : []),
    ...(sort !== "popularity.desc" ? [{ name: "sort", value: sort }] : []),
  ];

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

        {/* モード切り替えタブ（切替時にキーワード・フィルター値を保持） */}
        <SearchModeTabs
          currentMode={isFilterMode ? "filter" : "keyword"}
          query={query}
          genreId={selectedGenre ? String(selectedGenre.id) : ""}
          season={seasonParam}
          sort={sort}
        />

        {/* キーワード検索フォーム（サジェスト付き） */}
        {!isFilterMode && (
          <SearchPageInput
            mode="tv"
            defaultValue={query}
            formAction="/search"
            hiddenFields={keywordHiddenFields}
          />
        )}

        {/* 詳細フィルターフォーム（キーワード q を hidden で保持） */}
        {isFilterMode && (
          <form id="search-filter-form" method="GET" className="mb-10">
            <input type="hidden" name="mode" value="filter" />
            {query && <input type="hidden" name="q" value={query} />}
            <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 xl:gap-5">
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

                {/* シーズン */}
                <div>
                  <label className="block text-gray-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                    シーズン
                  </label>
                  <select
                    name="season"
                    defaultValue={seasonParam}
                    className="w-full bg-[#2a2a2a] border border-gray-600 text-white text-sm rounded px-3 py-2 outline-none focus:border-gray-400 transition"
                  >
                    <option value="">すべて</option>
                    {RECENT_SEASONS.map((s) => {
                      const value = `${s.year}-${s.season}`;
                      return (
                        <option key={value} value={value}>
                          {s.emoji} {s.label}
                        </option>
                      );
                    })}
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
                  href={`/search?mode=filter${query ? `&q=${encodeURIComponent(query)}` : ""}`}
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
                {selectedSeason && (
                  <span className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full">
                    {selectedSeason.emoji} {selectedSeason.label}
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
              ジャンル・シーズン・ソート順で検索できます
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
