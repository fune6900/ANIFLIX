import CharacterSearchCard from "@/components/CharacterSearchCard";
import SearchResults from "@/components/SearchResults";
import { searchAniListCharacters } from "@/lib/anilist";
import { searchAnnictCharacterByName } from "@/lib/annict";
import { sanitizeSearchQuery } from "@/lib/search-results";
import type { CharacterSearchResult } from "@/types/anilist";

interface CharacterSearchPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

/**
 * キャラの検索結果（ヘッダー検索の「キャラ」タブ。#101）。
 * AniList の検索は 1 ページ（上位 20 件）だけを返すため、ページ送りは出ない
 */
export default async function CharacterSearchPage({
  searchParams,
}: CharacterSearchPageProps) {
  const params = await searchParams;
  const query = sanitizeSearchQuery(params.q);

  let results: CharacterSearchResult[] = [];
  let error: string | null = null;

  if (query) {
    try {
      results = await searchAniListCharacters(query);
      // 各ヒットキャラの Annict プロフィールを並列で先取り（Next.js fetch cache に投入）
      // 詳細ページ初回アクセス時の待ち時間を短縮する。失敗は無視
      await Promise.allSettled(
        results.map((r) => searchAnnictCharacterByName(r.name)),
      );
    } catch (e) {
      console.error("[/search/characters]", e);
      error = "検索中にエラーが発生しました";
    }
  }

  return (
    <SearchResults
      category="characters"
      query={query}
      items={results}
      itemKey={(character) => character.id}
      renderItem={(character) => <CharacterSearchCard character={character} />}
      currentPage={1}
      totalPages={1}
      totalResults={results.length}
      error={error}
    />
  );
}
