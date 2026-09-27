import Image from "next/image";
import Link from "next/link";
import { getImageUrl } from "@/lib/tmdb";
import { pickDisplayTitle, type SeasonalEntry } from "@/lib/seasonal-anime";

interface SeasonAnimeCardProps {
  entry: SeasonalEntry;
  /** ON AIR バッジを表示する（放送中ページ用） */
  airingBadge?: boolean;
}

/** カードを描くのに必要な最小限。3 種類の入力をここへ揃える */
interface CardData {
  title: string;
  /** SP 用（縦長） */
  posterUrl: string | null;
  /** PC 用（横長） */
  backdropUrl: string | null;
  /** 10 点満点。無ければ null */
  score: number | null;
  /** 「2026年7月〜」形式。無ければ null */
  dateLabel: string | null;
  /** 詳細ページ。持たない作品は null（リンクを張らない） */
  href: string | null;
}

function monthLabel(
  year?: number | null,
  month?: number | null,
): string | null {
  if (!year || !month) return null;
  return `${year}年${month}月〜`;
}

function fromDateString(date: string | null | undefined): string | null {
  if (!date) return null;
  const [year, month] = date.split("-");
  if (!year || !month) return null;
  return monthLabel(Number(year), parseInt(month, 10));
}

/**
 * 3 種類の入力をカード用の形へ揃える。
 *
 * TMDb に無い作品は AniList のデータで描く。画像は AniList の CDN の
 * 絶対 URL なので `getImageUrl()` を通さない（`next.config.ts` の
 * `remotePatterns` で許可済み）。
 */
function toCardData(entry: SeasonalEntry): CardData {
  if (entry.kind === "tv") {
    const { anime } = entry;
    const poster = anime.poster_path ?? anime.backdrop_path;
    const backdrop = anime.backdrop_path ?? anime.poster_path;
    return {
      title: anime.name,
      posterUrl: poster ? getImageUrl(poster, "w342") : null,
      backdropUrl: backdrop ? getImageUrl(backdrop, "w780") : null,
      score: anime.vote_average || null,
      dateLabel: fromDateString(anime.first_air_date),
      href: `/anime/${anime.id}`,
    };
  }

  if (entry.kind === "movie") {
    const { movie } = entry;
    const poster = movie.poster_path ?? movie.backdrop_path;
    const backdrop = movie.backdrop_path ?? movie.poster_path;
    return {
      title: movie.title,
      posterUrl: poster ? getImageUrl(poster, "w342") : null,
      backdropUrl: backdrop ? getImageUrl(backdrop, "w780") : null,
      score: movie.vote_average || null,
      dateLabel: fromDateString(movie.release_date),
      href: `/movie/${movie.id}`,
    };
  }

  const { media } = entry;
  const cover = media.coverImage.extraLarge ?? media.coverImage.large;
  return {
    title: pickDisplayTitle(media),
    posterUrl: cover,
    // AniList のバナーは横長。無ければカバーで代用する
    backdropUrl: media.bannerImage ?? cover,
    // AniList は 100 点満点なので 10 点満点へ直す
    score: media.averageScore !== null ? media.averageScore / 10 : null,
    dateLabel: monthLabel(media.startDate.year, media.startDate.month),
    // 詳細ページを持たない
    href: null,
  };
}

/** PC は横長 backdrop、SP は縦長 poster の二系統で表示するシーズン作品カード */
export default function SeasonAnimeCard({
  entry,
  airingBadge = false,
}: SeasonAnimeCardProps) {
  const card = toCardData(entry);
  const score = card.score !== null ? card.score.toFixed(1) : null;
  const hasScore = score !== null && Number(score) > 0;

  const body = (
    <>
      {/* SP: 縦長ポスター */}
      <div className="md:hidden relative aspect-[2/3] rounded-sm overflow-hidden bg-gray-900">
        {card.posterUrl ? (
          <Image
            src={card.posterUrl}
            alt={card.title}
            fill
            sizes="50vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-white text-xs font-bold text-center leading-tight">
              {card.title}
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
        {hasScore && (
          <div className="absolute top-1.5 right-1.5 bg-black/70 rounded px-1.5 py-0.5">
            <span className="text-green-400 text-[11px] font-bold">
              ★ {score}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-white text-xs font-semibold leading-tight overflow-hidden text-ellipsis whitespace-nowrap">
            {card.title}
          </p>
          {card.dateLabel && (
            <p className="text-gray-400 text-[11px]">{card.dateLabel}</p>
          )}
        </div>
      </div>

      {/* PC: 横長 backdrop */}
      <div className="hidden md:block relative aspect-video rounded-md overflow-hidden bg-gray-900">
        {card.backdropUrl ? (
          <Image
            src={card.backdropUrl}
            alt={card.title}
            fill
            sizes="(max-width: 1024px) 30vw, (max-width: 1536px) 22vw, 18vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-white text-base font-bold text-center leading-tight">
              {card.title}
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
        {hasScore && (
          <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5">
            <span className="text-green-400 text-[11px] font-bold">
              ★ {score}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="text-white text-sm font-bold drop-shadow-md overflow-hidden text-ellipsis whitespace-nowrap">
            {card.title}
          </p>
          {card.dateLabel && (
            <p className="text-gray-300 text-[11px]">{card.dateLabel}</p>
          )}
        </div>
      </div>
    </>
  );

  // 詳細ページを持たない作品はリンクにしない。押せると 404 に落ちる
  if (!card.href) return <div className="group block">{body}</div>;

  return (
    <Link href={card.href} className="group block">
      {body}
    </Link>
  );
}
