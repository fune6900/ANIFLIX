import { getRecentSeasons } from "@/lib/seasons";
import { entryKey, fetchSeasonalAnime } from "@/lib/seasonal-anime";
import SeasonAnimeCard from "@/components/SeasonAnimeCard";

export default async function AiringPage() {
  // アクセス日時から現在のシーズンを取得
  const currentSeason = getRecentSeasons(1)[0];

  // AniList を季別タイトルリスト源、TMDb を表示データ源として一括取得
  // 上限は既定（1 シーズン分を取り切る）に任せる
  const { entries } = await fetchSeasonalAnime(
    currentSeason.year,
    currentSeason.season,
  );

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* ヘッダー */}
      <div className="site-container relative bg-gradient-to-b from-red-950 to-[#141414] pt-28 pb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-sm font-bold tracking-widest">
              ON AIR
            </span>
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-black mb-2">
          {currentSeason.label}アニメ
        </h1>
        <p className="text-gray-400 text-sm">
          {currentSeason.label}（{currentSeason.dateFrom} 〜{" "}
          {currentSeason.dateTo}）放送・配信の日本アニメ
          {entries.length > 0 && (
            <span className="ml-3">{entries.length.toLocaleString()}件</span>
          )}
        </p>
      </div>

      <div className="site-container pb-24">
        {entries.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 md:gap-4 xl:gap-5">
            {entries.map((entry) => (
              <SeasonAnimeCard
                key={entryKey(entry)}
                entry={entry}
                airingBadge
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            データを取得できませんでした
          </div>
        )}
      </div>
    </div>
  );
}
