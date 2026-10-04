import { notFound } from "next/navigation";
import { parsePageParam } from "@/lib/tmdb";
import { findEra } from "@/lib/eras";
import { loadEraMovieList } from "@/lib/era-list";
import { parseListSort } from "@/lib/list-sort";
import { toMovieEntry } from "@/lib/movie-card-item";
import { filterEntries, parseBrowseFilter } from "@/lib/browse-filter";
import type { SeasonalEntry } from "@/lib/seasonal-anime";
import EraListView from "@/components/EraListView";

interface EraMoviesPageProps {
  params: Promise<{ decade: string }>;
  searchParams: Promise<{
    page?: string;
    sort?: string | string[];
    genre?: string | string[];
    service?: string | string[];
  }>;
}

/** アニメ映画の年代別（70 件/ページ・公開年順。アニメの同じ年代へ切り替えられる） */
export default async function EraMoviesPage({
  params,
  searchParams,
}: EraMoviesPageProps) {
  const { decade: raw } = await params;
  const sp = await searchParams;

  // ANIME_ERAS に照合できた年代だけを TMDb へ渡す（キャッシュキーを増やさない）
  const era = /^\d{4}$/.test(raw) ? findEra(Number(raw)) : undefined;
  if (!era) notFound();

  let currentPage = parsePageParam(sp.page);
  const sort = parseListSort(sp.sort);
  const filter = parseBrowseFilter(sp);

  let entries: SeasonalEntry[] = [];
  let fetchedCount = 0;
  let totalPages = 1;
  let totalResults = 0;
  let error: string | null = null;

  try {
    const data = await loadEraMovieList(era, currentPage, sort);
    currentPage = data.page;
    const pageEntries = data.results.map(toMovieEntry);
    fetchedCount = pageEntries.length;
    // 取得済みの作品の中だけを絞る
    entries = await filterEntries(pageEntries, filter);
    totalPages = data.totalPages;
    totalResults = data.totalResults;
  } catch {
    error = "データの取得に失敗しました";
  }

  return (
    <EraListView
      era={era}
      media="movie"
      sort={sort}
      filter={filter}
      entries={entries}
      fetchedCount={fetchedCount}
      error={error}
      currentPage={currentPage}
      totalPages={totalPages}
      totalResults={totalResults}
    />
  );
}
