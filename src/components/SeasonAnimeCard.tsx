import Image from "next/image";
import Link from "next/link";
import { getImageUrl } from "@/lib/tmdb";
import type { TMDbAnime } from "@/types/tmdb";

interface SeasonAnimeCardProps {
  anime: TMDbAnime;
  /** ON AIR バッジを表示する（放送中ページ用） */
  airingBadge?: boolean;
}

/** PC は横長 backdrop、SP は縦長 poster の二系統で表示するシーズン作品カード */
export default function SeasonAnimeCard({
  anime,
  airingBadge = false,
}: SeasonAnimeCardProps) {
  const year = anime.first_air_date?.split("-")[0];
  const month = anime.first_air_date?.split("-")[1];
  const monthLabel =
    year && month ? `${year}年${parseInt(month, 10)}月〜` : null;
  const score = anime.vote_average?.toFixed(1);
  const posterImg = anime.poster_path ?? anime.backdrop_path;
  const backdropImg = anime.backdrop_path ?? anime.poster_path;

  return (
    <Link href={`/anime/${anime.id}`} className="group block">
      {/* SP: 縦長ポスター */}
      <div className="md:hidden relative aspect-[2/3] rounded-sm overflow-hidden bg-gray-900">
        {posterImg ? (
          <Image
            src={getImageUrl(posterImg, "w342")}
            alt={anime.name}
            fill
            sizes="50vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-white text-xs font-bold text-center leading-tight">
              {anime.name}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 to-transparent" />
        {airingBadge && (
          <div className="absolute top-1.5 left-1.5 bg-red-600 rounded-full px-2 py-0.5">
            <span className="text-white text-[9px] font-bold tracking-wider">
              ON AIR
            </span>
          </div>
        )}
        {score && parseFloat(score) > 0 && (
          <div className="absolute top-1.5 right-1.5 bg-black/70 rounded px-1.5 py-0.5">
            <span className="text-green-400 text-[11px] font-bold">
              ★ {score}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-white text-xs font-semibold truncate leading-tight">
            {anime.name}
          </p>
          {monthLabel && (
            <p className="text-gray-400 text-[11px]">{monthLabel}</p>
          )}
        </div>
      </div>

      {/* PC: 横長 backdrop */}
      <div className="hidden md:block relative aspect-video rounded-md overflow-hidden bg-gray-900">
        {backdropImg ? (
          <Image
            src={getImageUrl(backdropImg, "w780")}
            alt={anime.name}
            fill
            sizes="(max-width: 1024px) 30vw, (max-width: 1536px) 22vw, 18vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-white text-base font-bold text-center leading-tight">
              {anime.name}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300" />
        {airingBadge && (
          <div className="absolute top-2 left-2 bg-red-600 rounded-full px-2.5 py-0.5 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-white text-[10px] font-bold tracking-wider">
              ON AIR
            </span>
          </div>
        )}
        {score && parseFloat(score) > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5">
            <span className="text-green-400 text-[11px] font-bold">
              ★ {score}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="text-white text-sm font-bold truncate drop-shadow-md">
            {anime.name}
          </p>
          {monthLabel && (
            <p className="text-gray-300 text-[11px]">{monthLabel}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
