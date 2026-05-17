import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findSeason,
  getRecentSeasons,
  isValidSeason,
  SEASON_COLORS,
  type SeasonSlug,
} from "@/lib/seasons";
import { fetchSeasonalAnime } from "@/lib/seasonal-anime";
import SeasonAnimeCard from "@/components/SeasonAnimeCard";

interface SeasonPageProps {
  params: Promise<{ year: string; season: string }>;
}

export default async function SeasonPage({ params }: SeasonPageProps) {
  const { year: yearStr, season: seasonStr } = await params;

  const year = parseInt(yearStr, 10);
  if (isNaN(year) || year < 1960 || year > 2030) notFound();
  if (!isValidSeason(seasonStr)) notFound();

  const seasonSlug = seasonStr as SeasonSlug;
  const currentSeason = findSeason(year, seasonSlug);

  // AniList を季別タイトルリスト源、TMDb を表示データ源として一括取得
  const { items } = await fetchSeasonalAnime(year, seasonSlug, {
    limit: 100,
  });

  const totalResults = items.length;
  const recentSeasons = getRecentSeasons(8);
  const gradientClass = SEASON_COLORS[seasonSlug];

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* ヘッダー */}
      <div
        className={`relative bg-gradient-to-b ${gradientClass} pt-28 pb-10 px-4 md:px-12`}
      >
        <div className="relative z-10">
          <p className="text-gray-400 text-sm mb-1">シーズン別アニメ</p>
          <h1 className="text-4xl md:text-5xl font-black mb-2 flex items-center gap-3">
            <span>{currentSeason.emoji}</span>
            {currentSeason.label}アニメ
          </h1>
          <p className="text-gray-300 text-sm">
            {currentSeason.dateFrom} 〜 {currentSeason.dateTo}
            {totalResults > 0 && (
              <span className="ml-3 text-gray-400">
                {totalResults.toLocaleString()}件
              </span>
            )}
          </p>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] to-transparent opacity-40" />
      </div>

      <div className="px-4 md:px-12 pb-24">
        {/* シーズンナビゲーション */}
        <div
          className="flex gap-2 overflow-x-auto py-4 mb-6"
          style={{ scrollbarWidth: "none" }}
        >
          {recentSeasons.map((s) => {
            const isCurrentSeason = s.year === year && s.season === seasonSlug;
            return (
              <Link
                key={s.href}
                href={s.href}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                  isCurrentSeason
                    ? "bg-white text-black"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <span>{s.emoji}</span>
                {s.label}
              </Link>
            );
          })}
        </div>

        {items.length > 0 ? (
          <div className="max-w-[1920px] mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4 xl:gap-5">
            {items.map((anime) => (
              <SeasonAnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            このシーズンのアニメが見つかりませんでした
          </div>
        )}
      </div>
    </div>
  );
}
