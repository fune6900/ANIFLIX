import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getImageUrl } from "@/lib/tmdb";
import { fetchSeasonalAnime } from "@/lib/seasonal-anime";
import { getRecentSeasons } from "@/lib/seasons";
import {
  aggregateSeasonalCast,
  type AggregatedCast,
} from "@/lib/seasonal-cast";
import { sanitizeSearchQuery, searchResultsHref } from "@/lib/search-results";

interface VoiceActorsPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

interface CastGridCardProps {
  cast: AggregatedCast;
}

function CastGridCard({ cast }: CastGridCardProps) {
  return (
    <Link href={`/voice-actors/${cast.id}`} className="group block">
      <div className="relative aspect-[2/3] rounded-sm overflow-hidden bg-gray-900">
        {cast.profilePath ? (
          <Image
            src={getImageUrl(cast.profilePath, "w342")}
            alt={cast.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw"
            className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-800 to-gray-900">
            <svg
              className="w-16 h-16 text-gray-600"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 to-transparent" />
        <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5">
          <span className="text-[#54b9c5] text-xs font-bold">
            {cast.appearances}本
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-white text-xs font-semibold truncate leading-tight">
            {cast.name}
          </p>
          {cast.topCharacter && (
            <p className="text-gray-400 text-[11px] mt-0.5 truncate">
              役: {cast.topCharacter}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * 声優一覧。今期人気アニメに出演している声優を出演本数順に並べる。
 * 検索はヘッダーに一本化した（#101）。旧 `?q=` は声優の検索結果へ送る
 */
export default async function VoiceActorsPage({
  searchParams,
}: VoiceActorsPageProps) {
  const query = sanitizeSearchQuery((await searchParams).q);
  if (query) redirect(searchResultsHref("voice-actors", query));

  // 「今期人気アニメに出演している声優」を集約して表示する。
  // /person/popular はワールドワイドで Hollywood 俳優ばかり拾ってしまうため
  // (日本の声優は 100 位までに 0 名級) 信頼できない。
  // 今期トップ 30 作品のキャスト (order < 15) を出演本数順に並べる。
  let casts: AggregatedCast[] = [];
  try {
    const currentSeason = getRecentSeasons(1)[0];
    const seasonResult = await fetchSeasonalAnime(
      currentSeason.year,
      currentSeason.season,
      { limit: 30 },
    );
    casts = await aggregateSeasonalCast(
      seasonResult.items.slice(0, 30).map((a) => a.id),
    );
  } catch {
    // 一覧の取得に失敗してもエラーは出さない
  }

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-24">
      <div className="site-container">
        <div className="mb-8">
          <h1 className="text-white text-2xl font-bold">声優</h1>
          {casts.length > 0 && (
            <p className="text-gray-400 text-sm mt-1">
              🇯🇵 今期アニメに出演中の声優 ({casts.length}名)
            </p>
          )}
        </div>

        {casts.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 md:gap-4 xl:gap-5">
            {casts.map((cast) => (
              <CastGridCard key={cast.id} cast={cast} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
