import { notFound } from "next/navigation";
import { parsePageParam } from "@/lib/tmdb";
import { findGenre } from "@/lib/genres";
import { loadGenreMovieList } from "@/lib/genre-list";
import { parseListSort } from "@/lib/list-sort";
import { toMovieEntry } from "@/lib/movie-card-item";
import { filterEntries, parseBrowseFilter } from "@/lib/browse-filter";
import type { SeasonalEntry } from "@/lib/seasonal-anime";
import GenreListView from "@/components/GenreListView";

interface GenreMoviesPageProps {
  params: Promise<{ genreId: string }>;
  searchParams: Promise<{
    page?: string;
    sort?: string | string[];
    service?: string | string[];
  }>;
}

/** アニメ映画のジャンル別（ホームのジャンル行の「すべて見る」。アニメの同じジャンルへ切り替えられる） */
export default async function GenreMoviesPage({
  params,
  searchParams,
}: GenreMoviesPageProps) {
  const { genreId: raw } = await params;
  const sp = await searchParams;

  // ANIME_GENRES に照合できた ID だけを TMDb へ渡す（キャッシュキーを増やさない）
  const genre = /^\d{1,6}$/.test(raw) ? findGenre(Number(raw)) : undefined;
  if (!genre) notFound();

  let currentPage = parsePageParam(sp.page);
  const sort = parseListSort(sp.sort);
  // 既にこのジャンルに絞ったページなので、URL の genre= は読まない（ページ送りにも引き継がない）
  const filter = parseBrowseFilter({ service: sp.service });

  let entries: SeasonalEntry[] = [];
  let fetchedCount = 0;
  let totalPages = 1;
  let totalResults = 0;
  let error: string | null = null;

  try {
    const data = await loadGenreMovieList(genre, currentPage, sort);
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
    <GenreListView
      genre={genre}
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
