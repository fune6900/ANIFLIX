import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findSeason,
  getRecentSeasons,
  isValidSeason,
  SEASON_COLORS,
  type SeasonSlug,
} from "@/lib/seasons";
import { entryKey, fetchSeasonalAnime } from "@/lib/seasonal-anime";
import SeasonAnimeCard from "@/components/SeasonAnimeCard";
import BrowseFilterForm from "@/components/BrowseFilterForm";
import BrowseFilterEmpty from "@/components/BrowseFilterEmpty";
import {
  filterEntries,
  isFilterActive,
  parseBrowseFilter,
  withFilter,
} from "@/lib/browse-filter";
import type { BrowseFilterParams } from "@/lib/browse-filter";

interface SeasonPageProps {
  params: Promise<{ year: string; season: string }>;
  searchParams: Promise<BrowseFilterParams>;
}

export default async function SeasonPage({
  params,
  searchParams,
}: SeasonPageProps) {
  const { year: yearStr, season: seasonStr } = await params;
  const filter = parseBrowseFilter(await searchParams);

  const year = parseInt(yearStr, 10);
  if (isNaN(year) || year < 1960 || year > 2030) notFound();
  if (!isValidSeason(seasonStr)) notFound();

  const seasonSlug = seasonStr as SeasonSlug;
  const currentSeason = findSeason(year, seasonSlug);

  // AniList を季別タイトルリスト源、TMDb を表示データ源として一括取得
  // 上限は既定（1 シーズン分を取り切る）に任せる
  const { entries: fetched } = await fetchSeasonalAnime(year, seasonSlug);
  // 取得済みの作品の中だけを絞る
  const entries = await filterEntries(fetched, filter);

  const totalResults = entries.length;
  const recentSeasons = getRecentSeasons(8);
  const gradientClass = SEASON_COLORS[seasonSlug];

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* ヘッダー（タイトルもグリッドと同じ最大幅・横パディングで中央寄せ） */}
      <div className={`relative bg-gradient-to-b ${gradientClass} pt-28 pb-10`}>
        <div className="site-container relative z-10">
          <p className="text-gray-400 text-sm mb-1">シーズン</p>
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] to-transparent opacity-40 pointer-events-none" />
      </div>

      <div className="site-container pb-24">
        {/* シーズンナビゲーション（中央寄せ） */}
        <div
          className="flex gap-2 overflow-x-auto py-4 mb-6"
          style={{ scrollbarWidth: "none" }}
        >
          {recentSeasons.map((s) => {
            const isCurrentSeason = s.year === year && s.season === seasonSlug;
            return (
              <Link
                key={s.href}
                // シーズンを移っても絞り込みを外さない
                href={withFilter(s.href, filter)}
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

        <BrowseFilterForm
          action={currentSeason.href}
          filter={filter}
          fetchedCount={fetched.length}
          shownCount={entries.length}
        />

        {entries.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 md:gap-4 xl:gap-5">
            {entries.map((entry) => (
              <SeasonAnimeCard key={entryKey(entry)} entry={entry} />
            ))}
          </div>
        ) : isFilterActive(filter) && fetched.length > 0 ? (
          <BrowseFilterEmpty />
        ) : (
          <div className="text-center py-20 text-gray-500">
            このシーズンのアニメが見つかりませんでした
          </div>
        )}
      </div>
    </div>
  );
}
