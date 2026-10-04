import SearchResults from "@/components/SearchResults";
import SeasonAnimeCard from "@/components/SeasonAnimeCard";
import { searchAnimeKeyword } from "@/lib/anime-search";
import { sanitizeSearchQuery } from "@/lib/search-results";
import { parsePageParam, TMDB_MAX_PAGE } from "@/lib/tmdb";
import type { TMDbAnime } from "@/types/tmdb";

interface AnimeSearchPageProps {
  searchParams: Promise<{ q?: string | string[]; page?: string }>;
}

/** アニメの検索結果（ヘッダー検索の「アニメ」タブ。#101） */
export default async function AnimeSearchPage({
  searchParams,
}: AnimeSearchPageProps) {
  const params = await searchParams;
  const query = sanitizeSearchQuery(params.q);
  const currentPage = parsePageParam(params.page);

  let results: TMDbAnime[] = [];
  let totalResults = 0;
  let totalPages = 1;
  let error: string | null = null;

  if (query) {
    // 揺らぎ吸収 + AniList フォールバック。キーワード検索はキャッシュしない（cacheTime 0）
    try {
      const data = await searchAnimeKeyword(query, currentPage);
      results = data.results;
      totalResults = data.totalResults;
      totalPages = Math.min(data.totalPages, TMDB_MAX_PAGE);
    } catch {
      error = "検索中にエラーが発生しました";
    }
  }

  return (
    <SearchResults
      category="anime"
      query={query}
      items={results}
      itemKey={(anime) => anime.id}
      renderItem={(anime) => <SeasonAnimeCard entry={{ kind: "tv", anime }} />}
      currentPage={currentPage}
      totalPages={totalPages}
      totalResults={totalResults}
      error={error}
    />
  );
}
