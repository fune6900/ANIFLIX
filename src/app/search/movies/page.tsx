import MovieCard from "@/components/MovieCard";
import SearchResults from "@/components/SearchResults";
import { searchMovieKeyword } from "@/lib/anime-search";
import { sanitizeSearchQuery } from "@/lib/search-results";
import type { TMDbMovie } from "@/types/tmdb";

interface MovieSearchPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

/**
 * アニメ映画の検索結果（ヘッダー検索の「アニメ映画」タブ。#101）。
 * `searchMovieKeyword` は補強済みの 1 ページだけを返すため、ページ送りは出ない
 */
export default async function MovieSearchPage({
  searchParams,
}: MovieSearchPageProps) {
  const params = await searchParams;
  const query = sanitizeSearchQuery(params.q);

  let results: TMDbMovie[] = [];
  let totalResults = 0;
  let error: string | null = null;

  if (query) {
    try {
      const data = await searchMovieKeyword(query);
      results = data.results;
      totalResults = data.totalResults;
    } catch {
      error = "検索中にエラーが発生しました";
    }
  }

  return (
    <SearchResults
      category="movies"
      query={query}
      items={results}
      itemKey={(movie) => movie.id}
      renderItem={(movie) => <MovieCard movie={movie} />}
      currentPage={1}
      totalPages={1}
      totalResults={totalResults}
      error={error}
    />
  );
}
