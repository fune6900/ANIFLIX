import PersonSearchCard from "@/components/PersonSearchCard";
import SearchResults from "@/components/SearchResults";
import { sanitizeSearchQuery } from "@/lib/search-results";
import {
  isJapaneseVoiceActor,
  parsePageParam,
  searchPerson,
  TMDB_MAX_PAGE,
} from "@/lib/tmdb";
import type { TMDbPerson } from "@/types/tmdb";

interface VoiceActorSearchPageProps {
  searchParams: Promise<{ q?: string | string[]; page?: string }>;
}

/**
 * 声優の検索結果（ヘッダー検索の「声優」タブ。#101）。
 * TMDb の人物検索から日本の声優・俳優だけを残す。絞り込み後の総数は分からないため件数は出さない
 */
export default async function VoiceActorSearchPage({
  searchParams,
}: VoiceActorSearchPageProps) {
  const params = await searchParams;
  const query = sanitizeSearchQuery(params.q);
  const currentPage = parsePageParam(params.page);

  let results: TMDbPerson[] = [];
  let totalPages = 1;
  let error: string | null = null;

  if (query) {
    try {
      // searchPerson は cacheTime 0（キーワードがキャッシュキーになるため）
      const data = await searchPerson(query, currentPage);
      results = data.results.filter(isJapaneseVoiceActor);
      totalPages = Math.min(Math.max(data.total_pages, 1), TMDB_MAX_PAGE);
    } catch {
      error = "検索中にエラーが発生しました";
    }
  }

  return (
    <SearchResults
      category="voice-actors"
      query={query}
      items={results}
      itemKey={(person) => person.id}
      renderItem={(person) => <PersonSearchCard person={person} />}
      currentPage={currentPage}
      totalPages={totalPages}
      error={error}
    />
  );
}
