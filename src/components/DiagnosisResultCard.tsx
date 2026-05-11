import Image from "next/image";
import Link from "next/link";
import { getImageUrl } from "@/lib/tmdb";
import type { DiagnosisResultItem } from "@/lib/diagnosis";

interface DiagnosisResultCardProps {
  item: DiagnosisResultItem;
  rank: number;
}

function rankBadgeColor(rank: number): string {
  if (rank === 1) return "bg-yellow-500 text-black";
  if (rank === 2) return "bg-gray-300 text-black";
  if (rank === 3) return "bg-amber-700 text-white";
  return "bg-white/15 text-white";
}

function compatibilityColor(score: number): string {
  if (score >= 90) return "text-green-400";
  if (score >= 75) return "text-[#54b9c5]";
  if (score >= 60) return "text-yellow-400";
  return "text-gray-300";
}

export default function DiagnosisResultCard({
  item,
  rank,
}: DiagnosisResultCardProps) {
  const { anime, compatibility } = item;
  const year = anime.first_air_date?.split("-")[0];

  return (
    <Link
      href={`/anime/${anime.id}`}
      className="group flex gap-4 bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30 rounded-lg overflow-hidden transition-all duration-200"
    >
      {/* ポスター */}
      <div className="relative w-24 sm:w-32 md:w-36 aspect-[2/3] flex-shrink-0 bg-gray-900">
        {anime.poster_path ? (
          <Image
            src={getImageUrl(anime.poster_path, "w342")}
            alt={anime.name}
            fill
            sizes="(max-width: 640px) 96px, (max-width: 1024px) 128px, 144px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-2 bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-white text-xs font-bold text-center leading-tight">
              {anime.name}
            </span>
          </div>
        )}
        <span
          className={`absolute top-2 left-2 ${rankBadgeColor(rank)} text-xs font-black px-2 py-0.5 rounded`}
        >
          #{rank}
        </span>
      </div>

      {/* メタ */}
      <div className="flex-1 min-w-0 py-3 pr-3 md:py-4 md:pr-4 flex flex-col justify-between">
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-white font-bold text-base md:text-lg leading-tight group-hover:text-white">
              {anime.name}
            </h3>
            {year && <span className="text-gray-500 text-xs">{year}</span>}
          </div>

          <div className="flex items-center gap-3 mt-2">
            {anime.vote_average > 0 && (
              <span className="text-green-400 text-xs font-bold">
                ★ {anime.vote_average.toFixed(1)}
              </span>
            )}
            {anime.vote_count > 0 && (
              <span className="text-gray-500 text-xs">
                {anime.vote_count.toLocaleString()} 票
              </span>
            )}
          </div>

          {anime.overview && (
            <p className="hidden sm:block text-gray-400 text-xs md:text-sm mt-2 line-clamp-3 leading-relaxed">
              {anime.overview}
            </p>
          )}
        </div>

        {/* 相性度 */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 max-w-[200px] h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#54b9c5] to-[#E50914] rounded-full"
              style={{ width: `${Math.min(100, compatibility)}%` }}
            />
          </div>
          <span
            className={`font-black text-lg md:text-xl ${compatibilityColor(compatibility)}`}
          >
            {compatibility}%
          </span>
        </div>
      </div>
    </Link>
  );
}
