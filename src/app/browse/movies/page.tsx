import { redirect } from "next/navigation";
import HeroSection from "@/components/HeroSection";
import type { HeroItem } from "@/components/HeroSection";
import ContentRow from "@/components/ContentRow";
import { getMovieVideos } from "@/lib/tmdb";
import { loadAnimeMovieHome } from "@/lib/movie-home-rows";
import { MOVIE_LATEST_LIST_HREF, movieGenreListHref } from "@/lib/movie-list";
import {
  toMovieCardItem,
  toUpcomingMovieCardItem,
} from "@/lib/movie-card-item";
import { sanitizeSearchQuery, searchResultsHref } from "@/lib/search-results";

interface MoviesPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

interface SectionTitleProps {
  title: string;
}

/** 「スタジオ別」「ジャンル別」の区切り見出し */
function SectionTitle({ title }: SectionTitleProps) {
  return (
    <div className="site-container mt-6 mb-4 flex items-center gap-3">
      <p className="text-white font-black text-lg md:text-xl xl:text-2xl">
        {title}
      </p>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  );
}

/**
 * アニメ映画画面は毎リクエストでレンダリングする（トップ画面と同じ理由）。
 * 個々の fetch はキャッシュするが、静的プリレンダに倒れると shuffle() /
 * randomPage() がビルド時に凍結して全員が同じ並びを見る
 */
export const dynamic = "force-dynamic";

export default async function MoviesPage({ searchParams }: MoviesPageProps) {
  // 旧検索画面の URL（`?q=`）はアニメ映画の検索結果へ送る（#101）。
  // 旧検索画面の mode / genre / sort / page は捨ててホームを出す
  const query = sanitizeSearchQuery((await searchParams).q);
  if (query) redirect(searchResultsHref("movies", query));

  const home = await loadAnimeMovieHome();

  const trailerKeys = await Promise.all(
    home.hero.map((m) =>
      getMovieVideos(m.id)
        .then((vids) => vids[0]?.key ?? null)
        .catch(() => null),
    ),
  );

  const heroItems: HeroItem[] = home.hero.map((m, i) => ({
    id: m.id,
    title: m.title,
    overview: m.overview,
    backdropPath: m.backdrop_path,
    year: m.release_date?.split("-")[0] || undefined,
    match: m.vote_average > 0 ? Math.round(m.vote_average * 10) : undefined,
    href: `/movie/${m.id}`,
    trailerKey: trailerKeys[i] ?? undefined,
  }));

  return (
    <div className="bg-[#141414] min-h-screen">
      <HeroSection items={heroItems} />
      <div
        className={`relative z-10 pb-20 ${heroItems.length > 0 ? "-mt-16 md:-mt-24" : "pt-24"}`}
      >
        {home.latest.length > 0 && (
          <ContentRow
            title="🆕 最新作"
            items={home.latest.map(toMovieCardItem)}
            allHref={MOVIE_LATEST_LIST_HREF}
          />
        )}
        {home.japanTop10.length > 0 && (
          <ContentRow
            title="🇯🇵 アニメ映画TOP10（日本）"
            items={home.japanTop10.map(toMovieCardItem)}
          />
        )}
        {home.worldTop10.length > 0 && (
          <ContentRow
            title="🌏 アニメ映画TOP10（全世界）"
            items={home.worldTop10.map(toMovieCardItem)}
          />
        )}
        {home.upcoming.length > 0 && (
          <ContentRow
            title="📅 近日公開"
            items={home.upcoming.map(toUpcomingMovieCardItem)}
          />
        )}
        {home.topRated.length > 0 && (
          <ContentRow
            title="🏆 高評価の名作"
            items={home.topRated.map(toMovieCardItem)}
          />
        )}

        {/* スタジオ別 */}
        {home.studios.some((row) => row.movies.length > 0) && (
          <SectionTitle title="スタジオ別" />
        )}
        {home.studios.map(({ studio, movies }) =>
          movies.length > 0 ? (
            <ContentRow
              key={studio.id}
              title={`${studio.emoji} ${studio.name}`}
              items={movies.map(toMovieCardItem)}
            />
          ) : null,
        )}

        {home.theatrical.length > 0 && (
          <ContentRow
            title="🎬 TVシリーズの劇場版"
            items={home.theatrical.map(toMovieCardItem)}
          />
        )}

        {/* ジャンル別 */}
        {home.genres.some((row) => row.movies.length > 0) && (
          <SectionTitle title="ジャンル別" />
        )}
        {home.genres.map(({ genre, movies }) =>
          movies.length > 0 ? (
            <ContentRow
              key={genre.id}
              title={`${genre.emoji} ${genre.name}`}
              items={movies.map(toMovieCardItem)}
              allHref={movieGenreListHref(genre.id)}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}
