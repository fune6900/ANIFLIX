import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnimeByStudio } from "@/lib/tmdb";
import { ANIME_STUDIOS, findStudio } from "@/lib/studios";
import type { TMDbAnime } from "@/types/tmdb";
import SeasonAnimeCard from "@/components/SeasonAnimeCard";

interface StudioPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

function Pagination({
  studioId,
  currentPage,
  totalPages,
}: {
  studioId: number;
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const pageUrl = (p: number) => `/browse/studio/${studioId}?page=${p}`;

  const range = 2;
  const pages: number[] = [];
  for (
    let i = Math.max(1, currentPage - range);
    i <= Math.min(totalPages, currentPage + range);
    i++
  ) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-10 flex-wrap">
      {currentPage > 1 && (
        <Link
          href={pageUrl(currentPage - 1)}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
        >
          ← 前へ
        </Link>
      )}
      {pages[0] > 1 && (
        <>
          <Link
            href={pageUrl(1)}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
          >
            1
          </Link>
          {pages[0] > 2 && <span className="text-gray-500 px-1">…</span>}
        </>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={pageUrl(p)}
          className={`px-3 py-2 rounded text-sm transition ${
            p === currentPage
              ? "bg-[#E50914] text-white font-bold"
              : "bg-gray-800 hover:bg-gray-700 text-white"
          }`}
        >
          {p}
        </Link>
      ))}
      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span className="text-gray-500 px-1">…</span>
          )}
          <Link
            href={pageUrl(totalPages)}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
          >
            {totalPages}
          </Link>
        </>
      )}
      {currentPage < totalPages && (
        <Link
          href={pageUrl(currentPage + 1)}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
        >
          次へ →
        </Link>
      )}
    </div>
  );
}

export default async function StudioPage({
  params,
  searchParams,
}: StudioPageProps) {
  const { id: idStr } = await params;
  const { page: pageStr } = await searchParams;

  const studioId = parseInt(idStr, 10);
  if (isNaN(studioId)) notFound();

  const studio = findStudio(studioId);
  if (!studio) notFound();

  const currentPage = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  const data = await getAnimeByStudio(studioId, currentPage).catch(() => null);
  const anime: TMDbAnime[] = data?.results ?? [];
  const totalPages = Math.min(data?.total_pages ?? 1, 500);
  const totalResults = data?.total_results ?? 0;

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* ヘッダー */}
      <div className="relative bg-gradient-to-b from-gray-900 to-[#141414] pt-28 pb-10">
        <div className="flex items-center gap-4 mb-3">
          <span className="text-5xl">{studio.emoji}</span>
          <div>
            <p className="text-gray-400 text-xs font-semibold tracking-widest uppercase mb-1">
              スタジオ
            </p>
            <h1 className="text-3xl md:text-4xl font-black">{studio.name}</h1>
            <p className="text-gray-400 text-sm mt-1">{studio.description}</p>
          </div>
        </div>
        {totalResults > 0 && (
          <p className="text-gray-500 text-sm">
            {totalResults.toLocaleString()}件
            {totalPages > 1 && ` · ${currentPage} / ${totalPages} ページ`}
          </p>
        )}
      </div>

      <div className="px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-24">
        <div className="max-w-[1920px] mx-auto">
          {/* 他スタジオへのクイックリンク */}
          <div
            className="flex gap-2 overflow-x-auto py-3 mb-6"
            style={{ scrollbarWidth: "none" }}
          >
            {ANIME_STUDIOS.filter((s) => s.id !== studioId).map((s) => (
              <Link
                key={s.id}
                href={`/browse/studio/${s.id}`}
                className="flex-shrink-0 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-full transition"
              >
                <span>{s.emoji}</span>
                {s.name}
              </Link>
            ))}
          </div>

          {anime.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4 xl:gap-5">
              {anime.map((a) => (
                <SeasonAnimeCard key={a.id} anime={a} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-500">
              このスタジオの作品が見つかりませんでした
            </div>
          )}

          <Pagination
            studioId={studioId}
            currentPage={currentPage}
            totalPages={totalPages}
          />
        </div>
      </div>
    </div>
  );
}
