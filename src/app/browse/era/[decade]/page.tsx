import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getAnimeByEra, getImageUrl } from "@/lib/tmdb";
import { ANIME_ERAS, findEra } from "@/lib/eras";
import { detectDevice, itemsPerPage } from "@/lib/device";
import type { TMDbAnime } from "@/types/tmdb";

interface EraPageProps {
  params: Promise<{ decade: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

function AnimeGridCard({ anime }: { anime: TMDbAnime }) {
  const month = anime.first_air_date
    ? `${anime.first_air_date.split("-")[0]}年${parseInt(anime.first_air_date.split("-")[1], 10)}月`
    : null;
  return (
    <Link href={`/anime/${anime.id}`} className="group block">
      <div className="relative aspect-[2/3] rounded-sm overflow-hidden bg-gray-900">
        {anime.poster_path ? (
          <Image
            src={getImageUrl(anime.poster_path, "w342")}
            alt={anime.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-white text-sm font-bold text-center leading-tight">
              {anime.name}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 to-transparent" />
        {anime.vote_average > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5">
            <span className="text-green-400 text-xs font-bold">
              ★ {anime.vote_average.toFixed(1)}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-white text-xs font-semibold truncate leading-tight">
            {anime.name}
          </p>
          {month && <p className="text-gray-400 text-[11px] mt-0.5">{month}</p>}
        </div>
      </div>
    </Link>
  );
}

export default async function EraPage({ params, searchParams }: EraPageProps) {
  const { decade: decadeStr } = await params;
  const sp = await searchParams;

  const decade = parseInt(decadeStr, 10);
  if (isNaN(decade)) notFound();

  const era = findEra(decade);
  if (!era) notFound();

  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const sort = sp.sort === "date" ? "first_air_date.asc" : "popularity.desc";
  const sortLabel = sort === "first_air_date.asc" ? "date" : "popular";

  const ua = (await headers()).get("user-agent") ?? "";
  const device = detectDevice(ua);
  const limit = itemsPerPage(device);

  let results: TMDbAnime[] = [];
  let totalPages = 1;
  let totalResults = 0;
  let error: string | null = null;

  try {
    const data = await getAnimeByEra(decade, currentPage, sort);
    results = data.results.slice(0, limit);
    totalPages = data.total_pages;
    totalResults = data.total_results;
  } catch {
    error = "データの取得に失敗しました";
  }

  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;
  const pageBase = `/browse/era/${decade}?sort=${sortLabel}`;

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* ヘッダー */}
      <div
        className={`relative bg-gradient-to-b ${era.color} to-[#141414] pt-24 pb-14 overflow-hidden`}
      >
        {/* 大きな年代テキスト（装飾） */}
        <div className="absolute right-4 md:right-16 top-1/2 -translate-y-1/2 text-white/5 font-black text-[120px] md:text-[180px] leading-none select-none pointer-events-none">
          {era.shortLabel}
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-200 transition text-sm mb-6 relative"
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

        <div className="relative flex items-end gap-5">
          <span className="text-5xl md:text-6xl select-none">{era.emoji}</span>
          <div>
            <p className="text-gray-400 text-sm font-medium mb-1">年代</p>
            <h1 className="text-white text-3xl md:text-4xl font-black">
              {era.label}
            </h1>
            <p className="text-gray-400 text-sm mt-1">{era.description}</p>
            {totalResults > 0 && (
              <p className="text-gray-500 text-xs mt-1">
                {totalResults.toLocaleString()}件
              </p>
            )}
          </div>
        </div>

        {/* 年代タイムライン */}
        <div
          className="relative mt-8 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {ANIME_ERAS.map((e) => (
            <Link
              key={e.decade}
              href={`/browse/era/${e.decade}`}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                e.decade === decade
                  ? "bg-white text-black"
                  : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white"
              }`}
            >
              {e.shortLabel}
            </Link>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-20">
        <div className="max-w-[1920px] mx-auto">
          {/* ソートボタン */}
          <div className="flex items-center gap-3 mb-6 mt-4">
            <span className="text-gray-500 text-sm">並び替え:</span>
            <Link
              href={`/browse/era/${decade}?sort=popular&page=1`}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                sortLabel === "popular"
                  ? "bg-white text-black"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              人気順
            </Link>
            <Link
              href={`/browse/era/${decade}?sort=date&page=1`}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                sortLabel === "date"
                  ? "bg-white text-black"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              放送日順
            </Link>
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
                この年代の作品が見つかりませんでした
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
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5 gap-3 md:gap-4 xl:gap-5">
              {results.map((anime) => (
                <AnimeGridCard key={anime.id} anime={anime} />
              ))}
            </div>
          )}

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-12">
              {prevPage ? (
                <Link
                  href={`${pageBase}&page=${prevPage}`}
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
                  href={`${pageBase}&page=${nextPage}`}
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
