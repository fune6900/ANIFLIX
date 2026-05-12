"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { TMDbEpisode, TMDbSeason } from "@/types/tmdb";

function getImageUrl(path: string | null, size = "w300"): string {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function EpisodeCard({ ep }: { ep: TMDbEpisode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex gap-3 md:gap-4 py-4 border-b border-gray-800 last:border-0 group">
      {/* エピソード番号 */}
      <div className="flex-shrink-0 w-8 text-center pt-1">
        <span className="text-gray-500 text-lg font-bold">
          {ep.episode_number}
        </span>
      </div>

      {/* スチル画像 */}
      <div className="flex-shrink-0 w-36 sm:w-44 md:w-52">
        <div className="relative aspect-video rounded overflow-hidden bg-gray-900">
          {ep.still_path ? (
            <Image
              src={getImageUrl(ep.still_path, "w300")}
              alt={ep.name}
              fill
              sizes="208px"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-700"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* テキスト情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-white text-sm font-semibold leading-snug line-clamp-2">
            {ep.name}
          </p>
          {ep.runtime && (
            <span className="flex-shrink-0 text-gray-500 text-xs mt-0.5">
              {ep.runtime}分
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mb-1.5">
          {ep.air_date && (
            <span className="text-gray-500 text-xs">{ep.air_date}</span>
          )}
          {ep.vote_average > 0 && (
            <span className="text-yellow-500 text-xs font-semibold">
              ★ {ep.vote_average.toFixed(1)}
            </span>
          )}
        </div>

        {ep.overview && (
          <>
            <p
              className={`text-gray-400 text-xs leading-relaxed ${expanded ? "" : "line-clamp-2"}`}
            >
              {ep.overview}
            </p>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-gray-500 hover:text-gray-300 text-xs mt-1 transition-colors"
            >
              {expanded ? "閉じる" : "続きを読む"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface SeasonEpisodesProps {
  animeId: number;
  seasons: TMDbSeason[];
}

const PAGE_SIZE = 30;

export default function SeasonEpisodes({
  animeId,
  seasons,
}: SeasonEpisodesProps) {
  const mainSeasons = seasons.filter((s) => s.season_number > 0);
  const [selectedSeason, setSelectedSeason] = useState<number>(
    mainSeasons[0]?.season_number ?? 1,
  );
  const [episodes, setEpisodes] = useState<TMDbEpisode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);

  const fetchEpisodes = useCallback(
    async (seasonNumber: number) => {
      setLoading(true);
      setError(false);
      setEpisodes([]);
      try {
        const res = await fetch(
          `/api/season-episodes?animeId=${animeId}&season=${seasonNumber}`,
        );
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        setEpisodes(data.episodes ?? []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [animeId],
  );

  useEffect(() => {
    fetchEpisodes(selectedSeason);
    setPage(1);
  }, [selectedSeason, fetchEpisodes]);

  if (mainSeasons.length === 0) return null;

  const totalPages = Math.ceil(episodes.length / PAGE_SIZE);
  const pagedEpisodes = episodes.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  return (
    <section className="mt-10">
      <h2 className="text-white font-bold text-lg mb-4">エピソード</h2>

      {/* シーズンタブ */}
      <div className="flex gap-2 flex-wrap mb-6">
        {mainSeasons.map((s) => (
          <button
            key={s.season_number}
            onClick={() => setSelectedSeason(s.season_number)}
            className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
              s.season_number === selectedSeason
                ? "bg-white text-black"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {s.name}
            <span className="ml-1.5 text-xs opacity-60">
              ({s.episode_count}話)
            </span>
          </button>
        ))}
      </div>

      {/* エピソードリスト */}
      <div className="bg-[#1a1a1a] rounded-md px-3 md:px-5 min-h-[120px]">
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
            <svg
              className="w-5 h-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
            読み込み中…
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-gray-500 text-sm">
            エピソード情報を取得できませんでした
          </div>
        )}

        {!loading && !error && episodes.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            エピソード情報がありません
          </div>
        )}

        {!loading &&
          pagedEpisodes.map((ep) => <EpisodeCard key={ep.id} ep={ep} />)}
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="前のページ"
          >
            ‹
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const isEdge = p === 1 || p === totalPages;
            const isNear = Math.abs(p - page) <= 1;
            if (!isEdge && !isNear) {
              if (p === 2 || p === totalPages - 1) {
                return (
                  <span key={p} className="text-gray-600 px-1 text-sm">
                    …
                  </span>
                );
              }
              return null;
            }
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`min-w-[2rem] px-2 py-1.5 rounded text-sm font-semibold transition-colors ${
                  p === page
                    ? "bg-white text-black"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {p}
              </button>
            );
          })}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="次のページ"
          >
            ›
          </button>

          <span className="text-gray-600 text-xs ml-2">
            {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, episodes.length)} / {episodes.length}話
          </span>
        </div>
      )}
    </section>
  );
}
