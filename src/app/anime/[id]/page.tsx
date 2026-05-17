import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAnimeByGenre,
  getAnimeDetail,
  getAnimeExternalIds,
  getAnimeVideos,
  getAnimeWatchProviders,
  getImageUrl,
} from "@/lib/tmdb";
import type {
  TMDbAnime,
  TMDbCastMember,
  TMDbExternalIds,
  TMDbTVDetail,
  TMDbVideo,
  TMDbWatchProvidersResponse,
} from "@/types/tmdb";
import ContentRow from "@/components/ContentRow";
import type { ContentRowItem } from "@/components/ContentRow";
import SeasonEpisodes from "@/components/SeasonEpisodes";
import SeasonTimeline from "@/components/SeasonTimeline";
import WatchProviders, {
  pickProviderCountry,
} from "@/components/WatchProviders";

interface AnimeDetailPageProps {
  params: Promise<{ id: string }>;
}

function getSeasonStart(d: Date): Date {
  const m = d.getMonth(),
    y = d.getFullYear();
  if (m < 3) return new Date(y, 0, 1);
  if (m < 6) return new Date(y, 3, 1);
  if (m < 9) return new Date(y, 6, 1);
  return new Date(y, 9, 1);
}
function getSeasonEnd(d: Date): Date {
  const m = d.getMonth(),
    y = d.getFullYear();
  if (m < 3) return new Date(y, 2, 31, 23, 59, 59);
  if (m < 6) return new Date(y, 5, 30, 23, 59, 59);
  if (m < 9) return new Date(y, 8, 30, 23, 59, 59);
  return new Date(y, 11, 31, 23, 59, 59);
}

function computeAiringStatus(anime: TMDbTVDetail): {
  label: string;
  color: string;
} {
  if (anime.status === "Canceled")
    return { label: "打ち切り", color: "text-red-400 border-red-700" };

  const now = new Date();
  const seasonStart = getSeasonStart(now);
  const seasonEnd = getSeasonEnd(now);

  const firstAir = anime.first_air_date ? new Date(anime.first_air_date) : null;
  const lastAir = anime.last_air_date ? new Date(anime.last_air_date) : null;

  // 初回放送が現在シーズン終了より未来 → 放送予定
  if (firstAir && firstAir > seasonEnd) {
    return { label: "放送予定", color: "text-blue-400 border-blue-600" };
  }

  // TMDb の次エピソード情報がある → 確実に放送中
  if (anime.next_episode_to_air) {
    return { label: "放送中", color: "text-green-400 border-green-600" };
  }

  // 制作フラグがある → 放送中（続編製作中含む）
  if (anime.in_production) {
    return { label: "放送中", color: "text-green-400 border-green-600" };
  }

  // 最終放送日が現在シーズン内 → 放送中
  if (lastAir && lastAir >= seasonStart && lastAir <= seasonEnd) {
    return { label: "放送中", color: "text-green-400 border-green-600" };
  }

  // 初回放送が現在シーズン内でまだ終了日不明 → 放送中
  if (
    firstAir &&
    firstAir >= seasonStart &&
    firstAir <= seasonEnd &&
    !lastAir
  ) {
    return { label: "放送中", color: "text-green-400 border-green-600" };
  }

  // 制作中ステータスのまま放送前 → 制作中
  if (anime.status === "In Production") {
    return { label: "制作中", color: "text-yellow-400 border-yellow-600" };
  }

  return { label: "完結", color: "text-gray-400 border-gray-600" };
}

function StatusBadge({ anime }: { anime: TMDbTVDetail }) {
  const s = computeAiringStatus(anime);
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

export default async function AnimeDetailPage({
  params,
}: AnimeDetailPageProps) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) notFound();

  let anime;
  let videos: TMDbVideo[] = [];
  let externalIds: TMDbExternalIds | null = null;
  let watchProviders: TMDbWatchProvidersResponse | null = null;
  try {
    [anime, videos, externalIds, watchProviders] = await Promise.all([
      getAnimeDetail(numId),
      getAnimeVideos(numId).catch(() => []),
      getAnimeExternalIds(numId).catch(() => null),
      getAnimeWatchProviders(numId).catch(() => null),
    ]);
  } catch {
    notFound();
  }
  const providerCountry = pickProviderCountry(watchProviders?.results);

  const year = anime.first_air_date?.split("-")[0];
  const score = anime.vote_average?.toFixed(1);
  const cast: TMDbCastMember[] = anime.credits?.cast?.slice(0, 12) ?? [];

  // 同ジャンルのアニメをランダムページから取得してシャッフル（最大10件、自分自身を除く）
  const firstGenreId = anime.genres?.[0]?.id ?? null;
  let relatedAnime: TMDbAnime[] = [];
  if (firstGenreId) {
    const rndPage = Math.floor(Math.random() * 4) + 1; // 1〜4ページのランダム
    const related = await getAnimeByGenre(firstGenreId, rndPage).catch(
      () => null,
    );
    const pool = (related?.results ?? []).filter((a) => a.id !== numId);
    // Fisher-Yates シャッフル
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    relatedAnime = pool.slice(0, 10);
  }

  // OP / ED 動画（専用セクションに表示）
  const opVideos = videos.filter((v) => v.type === "Opening Credits");
  const edVideos = videos.filter((v) => v.type === "Ending Credits");

  // トレーラー・予告編（OP/ED を除く）
  const trailerVideos = videos.filter(
    (v) => v.type !== "Opening Credits" && v.type !== "Ending Credits",
  );
  const mainVideo = trailerVideos[0] ?? null;
  const extraVideos = trailerVideos.slice(1, 5); // 最大4件追加表示

  // SNSリンク
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
    externalIds?.facebook_id && {
      label: "Facebook",
      href: `https://www.facebook.com/${externalIds.facebook_id}`,
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
    },
  ].filter(Boolean) as { label: string; href: string; icon: React.ReactNode }[];

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* ヒーローバックドロップ */}
      <div className="relative w-full h-[55vw] max-h-[70vh] overflow-hidden">
        {anime.backdrop_path ? (
          <Image
            src={getImageUrl(anime.backdrop_path, "original")}
            alt={anime.name}
            fill
            priority
            sizes="100vw"
            className="object-cover object-top"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/70 via-transparent to-transparent" />
      </div>

      {/* コンテンツ */}
      <div className="relative -mt-32 md:-mt-48 pb-20">
        <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="flex flex-col md:flex-row gap-6 md:gap-10">
            {/* ポスター */}
            <div className="flex-shrink-0 w-36 md:w-48 lg:w-56 mx-auto md:mx-0">
              <div className="relative aspect-[2/3] rounded-md overflow-hidden shadow-2xl border border-gray-700/50">
                {anime.poster_path ? (
                  <Image
                    src={getImageUrl(anime.poster_path, "w342")}
                    alt={anime.name}
                    fill
                    sizes="(max-width: 768px) 144px, 224px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center p-4">
                    <span className="text-white text-sm text-center font-bold">
                      {anime.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 情報パネル */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black mb-1 leading-tight">
                {anime.name}
              </h1>
              {anime.original_name && anime.original_name !== anime.name && (
                <p className="text-gray-400 text-base mb-3">
                  {anime.original_name}
                </p>
              )}
              {anime.tagline && (
                <p className="text-gray-300 italic text-sm mb-4">
                  &ldquo;{anime.tagline}&rdquo;
                </p>
              )}

              {/* メタバッジ */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {score && parseFloat(score) > 0 && (
                  <span className="flex items-center gap-1 text-green-400 font-bold text-base">
                    ★ {score}
                    <span className="text-gray-500 text-xs font-normal">
                      ({anime.vote_count?.toLocaleString()}件)
                    </span>
                  </span>
                )}
                {year && <span className="text-gray-400 text-sm">{year}</span>}
                {anime.status && <StatusBadge anime={anime} />}
                {anime.number_of_seasons > 0 && (
                  <span className="text-gray-400 text-sm">
                    {anime.number_of_seasons}シーズン
                  </span>
                )}
                {anime.number_of_episodes > 0 && (
                  <span className="text-gray-400 text-sm">
                    全{anime.number_of_episodes}話
                  </span>
                )}
              </div>

              {/* ジャンル */}
              {anime.genres && anime.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {anime.genres.map((g) => (
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
                {mainVideo && (
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
                    トレーラーを見る
                  </a>
                )}
                {/* ② 公式サイトリンク */}
                {anime.homepage && (
                  <a
                    href={anime.homepage}
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

              {/* 公式SNSリンク */}
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
              {anime.overview && (
                <div className="mb-6">
                  <h2 className="text-white font-semibold mb-2">あらすじ</h2>
                  <p className="text-gray-300 text-sm leading-relaxed max-w-2xl">
                    {anime.overview}
                  </p>
                </div>
              )}

              {/* ネットワーク */}
              {anime.networks && anime.networks.length > 0 && (
                <p className="text-gray-500 text-xs mb-1">
                  <span className="text-gray-400 font-semibold">放送局: </span>
                  {anime.networks.map((n) => n.name).join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* ③ 動画セクション */}
          {trailerVideos.length > 0 && (
            <section className="mt-12">
              <h2 className="text-white font-bold text-lg mb-5">
                動画・トレーラー
              </h2>

              {/* メイン動画（大） */}
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

              {/* サブ動画（小サムネ一覧） */}
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
                        {/* YouTube サムネイル */}
                        <Image
                          src={`https://img.youtube.com/vi/${v.key}/mqdefault.jpg`}
                          alt={v.name}
                          fill
                          sizes="192px"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {/* 再生アイコンオーバーレイ */}
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

          {/* OP・ED セクション */}
          {(opVideos.length > 0 || edVideos.length > 0) && (
            <section className="mt-12">
              <h2 className="text-white font-bold text-lg mb-5">OP・ED</h2>
              <div className="space-y-6">
                {opVideos.length > 0 && (
                  <div>
                    <h3 className="text-gray-300 font-semibold text-sm mb-3 flex items-center gap-2">
                      <span className="bg-[#E50914] text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        OP
                      </span>
                      オープニング
                    </h3>
                    <div
                      className="flex gap-3 overflow-x-auto pb-1"
                      style={{ scrollbarWidth: "none" }}
                    >
                      {opVideos.map((v) => (
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
                          <p className="text-gray-300 text-[11px] mt-1.5 w-48 truncate font-medium">
                            {v.name}
                          </p>
                          {v.official && (
                            <span className="text-[10px] text-blue-400">
                              公式
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {edVideos.length > 0 && (
                  <div>
                    <h3 className="text-gray-300 font-semibold text-sm mb-3 flex items-center gap-2">
                      <span className="bg-gray-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        ED
                      </span>
                      エンディング
                    </h3>
                    <div
                      className="flex gap-3 overflow-x-auto pb-1"
                      style={{ scrollbarWidth: "none" }}
                    >
                      {edVideos.map((v) => (
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
                          <p className="text-gray-300 text-[11px] mt-1.5 w-48 truncate font-medium">
                            {v.name}
                          </p>
                          {v.official && (
                            <span className="text-[10px] text-blue-400">
                              公式
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 配信プラットフォーム */}
          <WatchProviders country={providerCountry} title={anime.name} />

          {/* ① キャスト・声優（クリックで声優詳細へ） */}
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

          {/* ヒストリー（シリーズ年表）*/}
          {anime.seasons &&
            anime.seasons.filter((s) => s.season_number > 0).length > 0 && (
              <SeasonTimeline seasons={anime.seasons} />
            )}

          {/* シーズン・エピソード一覧 */}
          {anime.seasons &&
            anime.seasons.filter((s) => s.season_number > 0).length > 0 && (
              <SeasonEpisodes animeId={numId} seasons={anime.seasons} />
            )}

          {/* 関連アニメ（同ジャンル） */}
          {relatedAnime.length > 0 && (
            <section className="mt-14 -mx-4 md:-mx-12">
              <ContentRow
                title={`${anime.genres![0].name} の関連作品`}
                allHref={`/browse/genre/${anime.genres![0].id}`}
                items={relatedAnime.map(
                  (a): ContentRowItem => ({
                    id: a.id,
                    title: a.name,
                    year: a.first_air_date?.split("-")[0],
                    rating: a.vote_average
                      ? `★ ${a.vote_average.toFixed(1)}`
                      : undefined,
                    posterPath: a.poster_path ?? null,
                    backdropPath: a.backdrop_path ?? null,
                    overview: a.overview ?? undefined,
                    href: `/anime/${a.id}`,
                  }),
                )}
              />
            </section>
          )}

          {/* 戻るボタン */}
          <div className="mt-12">
            <Link
              href="/"
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
              ホームに戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
