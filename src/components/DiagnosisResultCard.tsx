import Image from "next/image";
import Link from "next/link";
import { getImageUrl } from "@/lib/tmdb";
import type { DiagnosisResultItem } from "@/lib/diagnosis";

interface DiagnosisResultCardProps {
  item: DiagnosisResultItem;
  rank: number;
}

const OVERVIEW_LIMIT = 90;

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

function truncate(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit).trimEnd()}…`;
}

export default function DiagnosisResultCard({
  item,
  rank,
}: DiagnosisResultCardProps) {
  const { anime, compatibility } = item;
  const year = anime.first_air_date?.split("-")[0];
  // PC: backdrop（横長キービジュアル）優先 / SP: ポスター（縦長）優先
  const desktopImage = anime.backdrop_path ?? anime.poster_path;
  const mobileImage = anime.poster_path ?? anime.backdrop_path;

  return (
    <Link
      href={`/anime/${anime.id}`}
      className="group flex flex-row md:flex-col bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/30 rounded-lg overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-xl"
    >
      {/* キービジュアル: SP は縦ポスター / PC は横長 backdrop */}
      <div className="relative w-24 sm:w-32 md:w-full aspect-[2/3] md:aspect-[16/9] flex-shrink-0 bg-gray-900 overflow-hidden">
        {/* SP: ポスター */}
        <div className="md:hidden w-full h-full">
          {mobileImage ? (
            <Image
              src={getImageUrl(mobileImage, "w342")}
              alt={anime.name}
              fill
              sizes="(max-width: 640px) 96px, 128px"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-2 bg-gradient-to-br from-gray-800 to-gray-900">
              <span className="text-white text-xs font-bold text-center leading-tight">
                {anime.name}
              </span>
            </div>
          )}
        </div>
        {/* PC: backdrop */}
        <div className="hidden md:block w-full h-full">
          {desktopImage ? (
            <Image
              src={getImageUrl(
                desktopImage,
                desktopImage === anime.backdrop_path ? "w780" : "w342",
              )}
              alt={anime.name}
              fill
              sizes="(max-width: 1024px) 640px, 768px"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-800 to-gray-900">
              <span className="text-white text-lg font-bold text-center leading-tight">
                {anime.name}
              </span>
            </div>
          )}
          {/* グラデオーバーレイ（PC のみ）*/}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
        </div>
        <span
          className={`absolute top-2 left-2 ${rankBadgeColor(rank)} text-xs font-black px-2 py-0.5 rounded shadow`}
        >
          #{rank}
        </span>
        {/* PC: backdrop の上にタイトルをオーバーレイ */}
        <div className="hidden md:flex absolute inset-x-0 bottom-0 p-4 items-end justify-between gap-2">
          <h3 className="text-white font-black text-lg lg:text-xl leading-tight drop-shadow-md line-clamp-2">
            {anime.name}
          </h3>
          {year && (
            <span className="text-gray-300 text-xs font-medium flex-shrink-0">
              {year}
            </span>
          )}
        </div>
      </div>

      {/* メタ */}
      <div className="flex-1 min-w-0 py-3 pr-3 md:p-4 flex flex-col justify-between gap-3">
        <div>
          {/* SP のみタイトル表示（PC は画像上にオーバーレイ済み） */}
          <div className="md:hidden flex items-baseline gap-2 flex-wrap">
            <h3 className="text-white font-bold text-base leading-tight">
              {anime.name}
            </h3>
            {year && <span className="text-gray-500 text-xs">{year}</span>}
          </div>

          <div className="flex items-center gap-3 mt-2 md:mt-0">
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
            <p className="hidden sm:block text-gray-400 text-xs md:text-sm mt-2 leading-relaxed">
              {truncate(anime.overview, OVERVIEW_LIMIT)}
            </p>
          )}
        </div>

        {/* 相性度 */}
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-[200px] md:max-w-none h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#54b9c5] to-[#E50914] rounded-full transition-all duration-700"
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
