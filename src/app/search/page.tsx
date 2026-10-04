import { redirect } from "next/navigation";
import { sanitizeSearchQuery, searchResultsHref } from "@/lib/search-results";

interface LegacySearchPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

/**
 * 旧アニメ検索画面（キーワード / 詳細フィルター）。#101 で検索はヘッダーに一本化した。
 * ブックマーク・外部リンクのために、キーワードがあればアニメの検索結果へ送る。
 * キーワードが無い（旧フィルターモード等）なら送る先の結果が無いのでトップへ
 */
export default async function LegacySearchPage({
  searchParams,
}: LegacySearchPageProps) {
  const query = sanitizeSearchQuery((await searchParams).q);
  redirect(query ? searchResultsHref("anime", query) : "/");
}
