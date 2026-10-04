import Link from "next/link";
import HeroSection from "@/components/HeroSection";
import type { HeroItem } from "@/components/HeroSection";
import ContentRow from "@/components/ContentRow";
import type { ContentRowItem } from "@/components/ContentRow";
import AnimeMovieSearch, {
  isAnimeMovieSearchRequest,
} from "@/components/AnimeMovieSearch";
import type { AnimeMovieSearchParams } from "@/components/AnimeMovieSearch";
import { getMovieVideos } from "@/lib/tmdb";
import { loadAnimeMovieHome } from "@/lib/movie-home-rows";
import type { TMDbMovie } from "@/types/tmdb";

interface MoviesPageProps {
  searchParams: Promise<AnimeMovieSearchParams>;
}

/**
 * 「すべて見る」の遷移先。専用ページとフィルターは #91 で作るため、それまでは
 * 既存の検索画面（詳細フィルター）の該当条件へ飛ばす
 */
const LATEST_ALL_HREF =
  "/browse/movies?mode=filter&sort=primary_release_date.desc";

function genreAllHref(genreId: number): string {
  return `/browse/movies?mode=filter&genre=${genreId}`;
}

/** 検索画面（キーワード未入力）への入口 */
const SEARCH_HREF = "/browse/movies?mode=keyword";

function toMovieCardItem(movie: TMDbMovie): ContentRowItem {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.release_date?.split("-")[0] || undefined,
    match:
      movie.vote_average > 0 ? Math.round(movie.vote_average * 10) : undefined,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    overview: movie.overview,
    href: `/movie/${movie.id}`,
    mediaType: "movie",
  };
}

/** 近日公開は年ではなく公開日を出す（「2026」だけでは近日の意味が無い） */
function toUpcomingCardItem(movie: TMDbMovie): ContentRowItem {
  const [, month, day] = movie.release_date?.split("-") ?? [];
  return {
    ...toMovieCardItem(movie),
    year: month && day ? `${Number(month)}/${Number(day)} 公開` : undefined,
  };
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
  const params = await searchParams;

  // 検索系クエリがあれば従来の検索画面（キーワード / 詳細フィルター）
  if (isAnimeMovieSearchRequest(params)) {
    // フックを持たない async の Server Component なので関数として呼んで待つ
    // （ページの描画結果をそのまま返し、テストからも同じ形で描ける）
    return AnimeMovieSearch({ params });
  }

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
        <div className="site-container flex justify-end mb-2">
          <Link
            href={SEARCH_HREF}
            className="text-[#54b9c5] text-xs md:text-sm font-semibold hover:text-white transition"
          >
            🔍 アニメ映画を検索
          </Link>
        </div>

        {home.latest.length > 0 && (
          <ContentRow
            title="🆕 最新作"
            items={home.latest.map(toMovieCardItem)}
            allHref={LATEST_ALL_HREF}
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
            items={home.upcoming.map(toUpcomingCardItem)}
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
              allHref={genreAllHref(genre.id)}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}
