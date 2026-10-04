import { notFound } from "next/navigation";
import { parsePageParam } from "@/lib/tmdb";
import { findGenre } from "@/lib/genres";
import { loadGenreAnimeList } from "@/lib/genre-list";
import { parseListSort } from "@/lib/list-sort";
import { filterEntries, parseBrowseFilter } from "@/lib/browse-filter";
import type { SeasonalEntry } from "@/lib/seasonal-anime";
import GenreListView from "@/components/GenreListView";

interface GenrePageProps {
  params: Promise<{ genreId: string }>;
  searchParams: Promise<{
    page?: string;
    sort?: string | string[];
    service?: string | string[];
  }>;
}

/** アニメのジャンル別（70 件/ページ・放送年順。アニメ映画の同じジャンルへ切り替えられる） */
export default async function GenrePage({
  params,
  searchParams,
}: GenrePageProps) {
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
    const data = await loadGenreAnimeList(genre, currentPage, sort);
    currentPage = data.page;
    const pageEntries: SeasonalEntry[] = data.results.map((anime) => ({
      kind: "tv",
      anime,
    }));
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
      media="anime"
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
