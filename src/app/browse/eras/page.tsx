import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { ANIME_ERAS } from "@/lib/eras";
import { getImageUrl, searchTVByPage } from "@/lib/tmdb";
import { detectDevice, itemsPerPage } from "@/lib/device";
import type { TMDbAnime } from "@/types/tmdb";

interface ErasPageProps {
  searchParams: Promise<{ q?: string }>;
}

function AnimeGridCard({ anime }: { anime: TMDbAnime }) {
  const year = anime.first_air_date?.split("-")[0] ?? null;
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
          {year && <p className="text-gray-400 text-[11px] mt-0.5">{year}年</p>}
        </div>
      </div>
    </Link>
  );
}

function eraFromYear(year: number): number | null {
  const decade = Math.floor(year / 10) * 10;
  return ANIME_ERAS.some((e) => e.decade === decade) ? decade : null;
}

export default async function ErasPage({ searchParams }: ErasPageProps) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const isSearchMode = query.length > 0;

  const ua = (await headers()).get("user-agent") ?? "";
  const device = detectDevice(ua);
  const limit = itemsPerPage(device);

  let results: TMDbAnime[] = [];
  let error: string | null = null;

  if (isSearchMode) {
    try {
      const [r1, r2] = await Promise.allSettled([
        searchTVByPage(query, 1),
        searchTVByPage(query, 2),
      ]);
      const allResults = [
        ...(r1.status === "fulfilled" ? r1.value.results : []),
        ...(r2.status === "fulfilled" ? r2.value.results : []),
      ];
      results = allResults
        .filter(
          (a) =>
            (a.genre_ids?.includes(16) || a.origin_country?.includes("JP")) &&
            !!a.first_air_date,
        )
        .slice(0, limit * 2);
    } catch {
      error = "検索結果の取得に失敗した";
    }
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white pt-24 pb-24">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl xl:text-5xl font-black mb-2">
            年代別アニメ
          </h1>
          <p className="text-gray-400 text-sm xl:text-base">
            放送年代からアニメを探す
          </p>
        </div>

        {/* 検索フォーム */}
        <form
          method="GET"
          action="/browse/eras"
          className="mb-8 flex items-center gap-2"
        >
          <div className="relative flex-1 max-w-xl">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="アニメをタイトルで検索…"
              className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/15 border border-white/10 focus:border-white/30 rounded-full pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 outline-none transition"
            />
          </div>
          <button
            type="submit"
            className="bg-white text-black px-5 py-2 rounded-full text-xs font-bold hover:bg-gray-200 transition flex-shrink-0"
          >
            検索
          </button>
          {isSearchMode && (
            <Link
              href="/browse/eras"
              className="text-gray-400 hover:text-white text-xs underline flex-shrink-0 transition"
            >
              クリア
            </Link>
          )}
        </form>

        {/* 検索モード */}
        {isSearchMode && (
          <section className="mb-10">
            <p className="text-sm text-gray-400 mb-4">
              <span className="text-white font-semibold">「{query}」</span>
              の検索結果
              <span className="ml-2 font-bold text-white">
                {results.length}件
              </span>
            </p>

            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            {!error && results.length === 0 && (
              <p className="text-gray-500 text-sm py-12 text-center">
                「{query}」に一致する作品が見つからなかった
              </p>
            )}

            {!error && results.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5 gap-3 md:gap-4 xl:gap-5">
                {results.map((anime) => {
                  const year = parseInt(
                    anime.first_air_date?.split("-")[0] ?? "0",
                    10,
                  );
                  const decade = eraFromYear(year);
                  return (
                    <div key={anime.id} className="space-y-1.5">
                      <AnimeGridCard anime={anime} />
                      {decade && (
                        <Link
                          href={`/browse/era/${decade}`}
                          className="inline-block text-[10px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/15 px-2 py-0.5 rounded-full transition"
                        >
                          {decade}年代を見る →
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 年代タイル */}
        {!isSearchMode && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5 gap-4 xl:gap-5">
            {ANIME_ERAS.map((era) => (
              <Link
                key={era.decade}
                href={`/browse/era/${era.decade}`}
                className={`relative overflow-hidden rounded-lg h-32 md:h-40 xl:h-48 bg-gradient-to-br ${era.color} group`}
              >
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                <div className="absolute bottom-2 right-3 text-white/10 font-black text-5xl xl:text-7xl leading-none select-none">
                  {era.shortLabel}
                </div>
                <div className="relative p-4 h-full flex flex-col justify-between">
                  <span className="text-3xl xl:text-4xl">{era.emoji}</span>
                  <div>
                    <p className="text-white font-black text-base xl:text-lg leading-tight">
                      {era.label}
                    </p>
                    <p className="text-gray-300 text-[11px] xl:text-xs mt-0.5 line-clamp-1">
                      {era.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
