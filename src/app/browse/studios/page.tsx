import Link from "next/link";
import HeroSection from "@/components/HeroSection";
import type { HeroItem } from "@/components/HeroSection";
import ContentRow from "@/components/ContentRow";
import type { ContentRowItem } from "@/components/ContentRow";
import { getAnimeVideos } from "@/lib/tmdb";
import { ANIME_STUDIOS } from "@/lib/studios";
import { loadStudioHome } from "@/lib/studio-home";
import type { TMDbAnime } from "@/types/tmdb";

/** ピルの形（トップ画面の年代・シーズンのピルと同じ寸法） */
const PILL_CLASS =
  "flex-shrink-0 relative overflow-hidden rounded-lg w-36 md:w-44 xl:w-52 2xl:w-60 4xl:w-72 5xl:w-80 h-24 md:h-28 xl:h-32 2xl:h-36 4xl:h-40 5xl:h-44 bg-gradient-to-br group";

function studioHref(id: number): string {
  return `/browse/studio/${id}`;
}

function toCardItem(anime: TMDbAnime): ContentRowItem {
  return {
    id: anime.id,
    title: anime.name,
    year: anime.first_air_date?.split("-")[0],
    match:
      anime.vote_average > 0 ? Math.round(anime.vote_average * 10) : undefined,
    posterPath: anime.poster_path,
    backdropPath: anime.backdrop_path,
    overview: anime.overview,
    href: `/anime/${anime.id}`,
  };
}

/**
 * 毎リクエストでレンダリングする（アニメ映画画面と同じ理由）。
 * 個々の fetch はキャッシュするが、静的プリレンダに倒れるとカルーセルの
 * shuffle() がビルド時に凍結して全員が同じ 6 社を見る
 */
export const dynamic = "force-dynamic";

export default async function StudiosPage() {
  const home = await loadStudioHome();

  // 予告編は作品ごとに引き、失敗した作品は予告編なしで出す
  const trailerKeys = await Promise.all(
    home.hero.map((a) =>
      getAnimeVideos(a.id)
        .then((vids) => vids[0]?.key ?? null)
        .catch(() => null),
    ),
  );

  const heroItems: HeroItem[] = home.hero.map((a, i) => ({
    id: a.id,
    title: a.name,
    overview: a.overview,
    backdropPath: a.backdrop_path,
    year: a.first_air_date?.split("-")[0] || undefined,
    match: a.vote_average > 0 ? Math.round(a.vote_average * 10) : undefined,
    href: `/anime/${a.id}`,
    trailerKey: trailerKeys[i] ?? undefined,
  }));

  return (
    <div className="bg-[#141414] min-h-screen">
      <HeroSection items={heroItems} />
      <div
        className={`relative z-10 pb-20 ${heroItems.length > 0 ? "-mt-16 md:-mt-24" : "pt-24"}`}
      >
        {/* 全社へのピル（行が空の社にも一覧ページから辿れるよう、常に全社を出す） */}
        <div className="site-container mb-4 flex items-center gap-3">
          <p className="text-white font-black text-lg md:text-xl xl:text-2xl">
            制作会社
          </p>
          <div className="flex-1 h-px bg-gray-800" />
        </div>
        <nav
          aria-label="制作会社一覧"
          className="site-container flex gap-3 xl:gap-4 mb-8 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          {ANIME_STUDIOS.map((studio) => (
            <Link
              key={studio.id}
              href={studioHref(studio.id)}
              className={`${PILL_CLASS} ${studio.color}`}
            >
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
              <div className="relative p-3 h-full flex flex-col justify-between">
                <span className="text-2xl">{studio.emoji}</span>
                <div>
                  <p className="text-white font-black text-sm md:text-base leading-tight line-clamp-1">
                    {studio.name}
                  </p>
                  <p className="text-gray-300 text-[10px] mt-0.5 line-clamp-1">
                    {studio.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </nav>

        {/* 各社 1 行。取得に失敗した行（空）は出さない */}
        {home.rows.map(({ studio, anime }) =>
          anime.length > 0 ? (
            <ContentRow
              key={studio.id}
              title={`${studio.emoji} ${studio.name}`}
              items={anime.map(toCardItem)}
              allHref={studioHref(studio.id)}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}
