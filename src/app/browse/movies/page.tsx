import { getAnimeMovies } from "@/lib/tmdb";
import InfiniteGrid from "@/components/InfiniteGrid";
import type { NormalizedGridItem } from "@/app/api/browse/route";

export default async function MoviesPage() {
  const data = await getAnimeMovies(1).catch(() => null);
  const totalPages = Math.min(data?.total_pages ?? 1, 500);
  const totalResults = data?.total_results ?? 0;

  const initialItems: NormalizedGridItem[] = (data?.results ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    posterPath: m.poster_path,
    backdropPath: m.backdrop_path,
    year: m.release_date?.split("-")[0] ?? "",
    score: m.vote_average ?? 0,
    href: `/movie/${m.id}`,
  }));

  return (
    <div className="min-h-screen bg-[#141414] text-white pt-24 pb-24 px-4 md:px-12">
      {/* ヘッダー */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">🎬</span>
          <div>
            <h1 className="text-white text-3xl font-black">アニメ映画</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {totalResults > 0 && `${totalResults.toLocaleString()}件の作品`}
            </p>
          </div>
        </div>
        <div className="h-0.5 w-16 bg-[#E50914] mt-3" />
      </div>

      {initialItems.length > 0 ? (
        <InfiniteGrid
          initialItems={initialItems}
          initialPage={1}
          totalPages={totalPages}
          fetchUrl="/api/browse?type=movies"
        />
      ) : (
        <div className="text-center py-20 text-gray-500">
          データを取得できませんでした
        </div>
      )}
    </div>
  );
}
