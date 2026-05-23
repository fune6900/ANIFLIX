import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMovieDetail,
  getMovieWatchProviders,
  getImageUrl,
} from "@/lib/tmdb";
import type {
  TMDbCastMember,
  TMDbExternalIds,
  TMDbMovie,
  TMDbVideo,
  TMDbWatchProvidersResponse,
} from "@/types/tmdb";
import AnimeHeroTrailer from "@/components/AnimeHeroTrailer";
import ContentRow from "@/components/ContentRow";
import type { ContentRowItem } from "@/components/ContentRow";
import RelatedCharacters from "@/components/RelatedCharacters";
import WatchProviders, {
  pickProviderCountry,
} from "@/components/WatchProviders";

interface MovieDetailPageProps {
  params: Promise<{ id: string }>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    Released: { label: "公開済み", color: "text-green-400 border-green-600" },
    "Post Production": {
      label: "制作中",
      color: "text-yellow-400 border-yellow-600",
    },
    "In Production": {
      label: "制作中",
      color: "text-yellow-400 border-yellow-600",
    },
    Rumored: { label: "噂段階", color: "text-gray-400 border-gray-600" },
    Canceled: { label: "中止", color: "text-red-400 border-red-700" },
  };
  const s = map[status] ?? {
    label: status,
    color: "text-gray-400 border-gray-600",
  };
  return (
    <span className={`border text-xs px-2 py-0.5 rounded ${s.color}`}>
      {s.label}
    </span>
  );
}

function VideoTypeLabel({
  type,
  official,
}: {
  type: string;
  official: boolean;
}) {
  const labels: Record<string, string> = {
    Trailer: "予告編",
    Teaser: "ティーザー",
    "Opening Credits": "オープニング",
    Clip: "クリップ",
    Featurette: "特別映像",
  };
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
      {official && (
        <span className="bg-blue-900/60 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded font-semibold">
          公式
        </span>
      )}
      <span>{labels[type] ?? type}</span>
    </span>
  );
}

function formatRuntime(minutes: number | null): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}

export default async function MovieDetailPage({
  params,
}: MovieDetailPageProps) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) notFound();

  let movie;
  let watchProviders: TMDbWatchProvidersResponse | null = null;
  try {
    [movie, watchProviders] = await Promise.all([
      getMovieDetail(numId),
      getMovieWatchProviders(numId).catch(() => null),
    ]);
  } catch {
    notFound();
  }
  const providerCountry = pickProviderCountry(watchProviders?.results);

  const year = movie.release_date?.split("-")[0];
  const score = movie.vote_average?.toFixed(1);
  const runtime = formatRuntime(movie.runtime);
  const cast: TMDbCastMember[] = movie.credits?.cast?.slice(0, 12) ?? [];

  const videos: TMDbVideo[] = (movie.videos?.results ?? []).filter(
    (v) => v.site === "YouTube",
  );
  const order = ["Trailer", "Teaser", "Opening Credits", "Clip", "Featurette"];
  videos.sort((a, b) => {
    const aScore = (a.official ? 10 : 0) + (10 - order.indexOf(a.type));
    const bScore = (b.official ? 10 : 0) + (10 - order.indexOf(b.type));
    return bScore - aScore;
  });
  const mainVideo = videos[0] ?? null;
  const extraVideos = videos.slice(1, 5);

  const externalIds: TMDbExternalIds | undefined = movie.external_ids;
  const snsLinks = [
    externalIds?.twitter_id && {
      label: "X (Twitter)",
      href: `https://twitter.com/${externalIds.twitter_id}`,
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.834L1.254 2.25H8.08l4.261 5.636 5.903-5.636zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    externalIds?.instagram_id && {
      label: "Instagram",
      href: `https://www.instagram.com/${externalIds.instagram_id}`,
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      ),
    },
  ].filter(Boolean) as { label: string; href: string; icon: React.ReactNode }[];

  const relatedMovies: TMDbMovie[] = (movie.recommendations?.results ?? [])
    .filter((m) => m.genre_ids.includes(16))
    .slice(0, 12);

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* ヒーロー: トレーラーがあれば背景にループ再生、無ければ backdrop 画像 */}
      <AnimeHeroTrailer
        trailerKey={mainVideo?.key ?? null}
        backdropUrl={
          movie.backdrop_path
            ? getImageUrl(movie.backdrop_path, "original")
            : null
        }
        title={movie.title}
      />

      {/* コンテンツ */}
      <div className="relative -mt-32 md:-mt-48 pb-24">
        <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="flex flex-col md:flex-row gap-6 md:gap-10">
            {/* ポスター */}
            <div className="flex-shrink-0 w-36 md:w-48 lg:w-56 mx-auto md:mx-0">
              <div className="relative aspect-[2/3] rounded-md overflow-hidden shadow-2xl border border-gray-700/50">
                {movie.poster_path ? (
                  <Image
                    src={getImageUrl(movie.poster_path, "w342")}
                    alt={movie.title}
                    fill
                    sizes="(max-width: 768px) 144px, 224px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center p-4">
                    <span className="text-white text-sm text-center font-bold">
                      {movie.title}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 情報パネル */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black mb-1 leading-tight">
                {movie.title}
              </h1>
              {movie.original_title && movie.original_title !== movie.title && (
                <p className="text-gray-400 text-base mb-3">
                  {movie.original_title}
                </p>
              )}
              {movie.tagline && (
                <p className="text-gray-300 italic text-sm mb-4">
                  &ldquo;{movie.tagline}&rdquo;
                </p>
              )}

              {/* メタバッジ */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {score && parseFloat(score) > 0 && (
                  <span className="flex items-center gap-1 text-green-400 font-bold text-base">
                    ★ {score}
                    <span className="text-gray-500 text-xs font-normal">
                      ({movie.vote_count?.toLocaleString()}件)
                    </span>
                  </span>
                )}
                {year && (
                  <span className="text-gray-400 text-sm">{year}年</span>
                )}
                {movie.status && <StatusBadge status={movie.status} />}
                {runtime && (
                  <span className="text-gray-400 text-sm">{runtime}</span>
                )}
              </div>

              {/* ジャンル */}
              {movie.genres && movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {movie.genres.map((g) => (
                    <span
                      key={g.id}
                      className="border border-gray-600 text-gray-300 text-xs px-2 py-0.5 rounded"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {mainVideo ? (
                  <a
                    href={`https://www.youtube.com/watch?v=${mainVideo.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white text-black font-bold px-6 py-2.5 rounded hover:bg-gray-200 transition text-sm"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    予告編を見る
                  </a>
                ) : (
                  <button className="flex items-center gap-2 bg-white text-black font-bold px-6 py-2.5 rounded hover:bg-gray-200 transition text-sm opacity-50 cursor-not-allowed">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    再生
                  </button>
                )}
                {movie.homepage && (
                  <a
                    href={movie.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-gray-700/60 text-gray-200 font-semibold px-5 py-2.5 rounded hover:bg-gray-600/60 transition text-sm border border-gray-600"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    公式サイト
                  </a>
                )}
              </div>

              {/* SNS */}
              {snsLinks.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <span className="text-gray-500 text-xs">公式SNS:</span>
                  {snsLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 hover:text-white border border-gray-700 px-3 py-1.5 rounded-full text-xs transition"
                    >
                      {link.icon}
                      {link.label}
                    </a>
                  ))}
                </div>
              )}

              {/* あらすじ */}
              {movie.overview && (
                <div className="mb-6">
                  <h2 className="text-white font-semibold mb-2">あらすじ</h2>
                  <p className="text-gray-300 text-sm leading-relaxed max-w-2xl">
                    {movie.overview}
                  </p>
                </div>
              )}

              {/* 公開情報 */}
              <div className="text-gray-500 text-xs space-y-0.5">
                {movie.release_date && (
                  <p>
                    <span className="text-gray-400 font-semibold">
                      公開日:{" "}
                    </span>
                    {movie.release_date}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 動画セクション */}
          {videos.length > 0 && (
            <section className="mt-12">
              <h2 className="text-white font-bold text-lg mb-5">
                動画・予告編
              </h2>
              {mainVideo && (
                <div className="mb-5">
                  <div className="relative w-full max-w-3xl aspect-video rounded-lg overflow-hidden bg-black shadow-2xl">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${mainVideo.key}?rel=0&modestbranding=1`}
                      title={mainVideo.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                  <div className="mt-2 max-w-3xl flex items-center justify-between">
                    <p className="text-gray-300 text-sm font-medium truncate">
                      {mainVideo.name}
                    </p>
                    <VideoTypeLabel
                      type={mainVideo.type}
                      official={mainVideo.official}
                    />
                  </div>
                </div>
              )}
              {extraVideos.length > 0 && (
                <div
                  className="flex gap-3 overflow-x-auto pb-1"
                  style={{ scrollbarWidth: "none" }}
                >
                  {extraVideos.map((v) => (
                    <a
                      key={v.id}
                      href={`https://www.youtube.com/watch?v=${v.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 group"
                    >
                      <div className="relative w-48 aspect-video rounded overflow-hidden bg-gray-900">
                        <Image
                          src={`https://img.youtube.com/vi/${v.key}/mqdefault.jpg`}
                          alt={v.name}
                          fill
                          sizes="192px"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                          <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-white translate-x-0.5"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-400 text-[11px] mt-1.5 w-48 truncate">
                        {v.name}
                      </p>
                      <VideoTypeLabel type={v.type} official={v.official} />
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 配信プラットフォーム */}
          <WatchProviders country={providerCountry} title={movie.title} />

          {/* キャスト・声優 */}
          {cast.length > 0 && (
            <section className="mt-10">
              <h2 className="text-white font-bold text-lg mb-4">
                キャスト・声優
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {cast.map((member) => (
                  <Link
                    key={member.id}
                    href={`/voice-actors/${member.id}`}
                    className="text-center group"
                  >
                    <div className="relative w-full aspect-square rounded-full overflow-hidden bg-gray-800 mb-2 mx-auto max-w-[72px] ring-2 ring-transparent group-hover:ring-[#54b9c5] transition-all duration-200">
                      {member.profile_path ? (
                        <Image
                          src={getImageUrl(member.profile_path, "w185")}
                          alt={member.name}
                          fill
                          sizes="72px"
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <svg
                            className="w-8 h-8"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-white text-[11px] font-semibold truncate group-hover:text-[#54b9c5] transition-colors">
                      {member.name}
                    </p>
                    {member.character && (
                      <p className="text-gray-500 text-[10px] truncate">
                        {member.character}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 関連キャラクター（AniList 経由・クリックで /characters/[id] へ） */}
          <RelatedCharacters
            title={movie.title}
            originalTitle={movie.original_title}
            mediaType="MOVIE"
          />

          {/* 関連映画 */}
          {relatedMovies.length > 0 && (
            <section className="mt-14 -mx-4 md:-mx-12">
              <ContentRow
                title="関連作品"
                items={relatedMovies.map(
                  (m): ContentRowItem => ({
                    id: m.id,
                    title: m.title,
                    year: m.release_date?.split("-")[0],
                    rating: m.vote_average
                      ? `★ ${m.vote_average.toFixed(1)}`
                      : undefined,
                    posterPath: m.poster_path ?? null,
                    backdropPath: m.backdrop_path ?? null,
                    overview: m.overview ?? undefined,
                    href: `/movie/${m.id}`,
                  }),
                )}
              />
            </section>
          )}

          {/* 戻る */}
          <div className="mt-12">
            <Link
              href="/browse/movies"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              映画一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
