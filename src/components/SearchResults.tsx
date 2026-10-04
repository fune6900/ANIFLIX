import type { ReactNode } from "react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import {
  SEARCH_CATEGORIES,
  searchResultsHref,
  type SearchCategory,
} from "@/lib/search-results";

/**
 * 部門ごとのカードグリッド。1920px 超は auto-fill に切り替える
 * （下限は conventions.md の表: ポスター 300px / 声優 170px / キャラ 250px）
 */
const GRID_CLASS: Record<SearchCategory, string> = {
  anime:
    "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 md:gap-4 xl:gap-5",
  movies:
    "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 md:gap-4 xl:gap-5",
  "voice-actors":
    "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 md:gap-4 xl:gap-5",
  characters:
    "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 3xl:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3 md:gap-4 xl:gap-5",
};

interface SearchResultsProps<T> {
  category: SearchCategory;
  /** サニタイズ済みのキーワード。空なら検索していない */
  query: string;
  items: T[];
  itemKey: (item: T) => string | number;
  renderItem: (item: T) => ReactNode;
  currentPage: number;
  totalPages: number;
  /** 全体の件数。部門によっては出せない（絞り込み後の総数が分からない）ので省略可 */
  totalResults?: number;
  error?: string | null;
}

/**
 * ヘッダー検索の結果画面（#101）。4 部門で見出し・部門タブ・カードグリッド・
 * ページ送りを共有する。ページ内には検索欄を置かない（検索はヘッダーに一本化）
 */
export default function SearchResults<T>({
  category,
  query,
  items,
  itemKey,
  renderItem,
  currentPage,
  totalPages,
  totalResults,
  error = null,
}: SearchResultsProps<T>) {
  const label =
    SEARCH_CATEGORIES.find((c) => c.slug === category)?.label ?? "作品";
  const hasItems = items.length > 0;
  // 声優は TMDb の 1 ページを日本の声優だけに絞るため、途中のページが空になり得る
  const hasOtherPages = totalPages > 1;

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-24">
      <div className="site-container">
        <div className="mb-6">
          <h1 className="text-white text-2xl font-bold mb-1">
            {query ? `「${query}」の検索結果` : "検索"}
          </h1>
          {hasItems && (
            <p className="text-gray-400 text-sm">
              {totalResults !== undefined &&
                `${totalResults.toLocaleString()}件`}
              {totalResults !== undefined && totalPages > 1 && " · "}
              {totalPages > 1 && `${currentPage} / ${totalPages} ページ`}
            </p>
          )}
        </div>

        {query && (
          <nav
            aria-label="検索部門"
            className="flex flex-wrap gap-2 mb-8 border-b border-gray-800 pb-4"
          >
            {SEARCH_CATEGORIES.map((c) => {
              const active = c.slug === category;
              return (
                <Link
                  key={c.slug}
                  href={searchResultsHref(c.slug, query)}
                  aria-current={active ? "page" : undefined}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                    active
                      ? "bg-[#E50914] text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {c.label}
                </Link>
              );
            })}
          </nav>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded mb-8">
            {error}
          </div>
        )}

        {hasItems && (
          <ul aria-label="検索結果" className={GRID_CLASS[category]}>
            {items.map((item) => (
              <li key={itemKey(item)}>{renderItem(item)}</li>
            ))}
          </ul>
        )}

        {query && !hasItems && !error && hasOtherPages && (
          <p className="text-center text-gray-400 py-12">
            このページには「{query}」に一致する{label}
            がありません。ほかのページを見てください
          </p>
        )}

        {/* 絞り込みで今のページが空でも、続きのページへは進めるようにする */}
        {query && !error && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageUrl={(p) => searchResultsHref(category, query, p)}
          />
        )}

        {query && !hasItems && !error && !hasOtherPages && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-2">
              「{query}」に一致する{label}は見つかりませんでした
            </p>
            <p className="text-gray-600 text-sm">
              別のキーワードか、ほかの部門で試してみてください
            </p>
          </div>
        )}

        {!query && !error && (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-2">
              ヘッダーの検索からキーワードを入力してください
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
