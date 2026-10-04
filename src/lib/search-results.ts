/**
 * ヘッダー検索の結果画面（#101）。
 *
 * 検索はヘッダーの検索（`src/components/SearchDropdown.tsx`）に一本化し、
 * 結果は部門ごとに `/search/<部門>?q=` の画面で出す。4 部門で URL の組み立てと
 * キーワードのサニタイズをここに集める（ページごとに書くとずれる）。
 */

export type SearchCategory = "anime" | "movies" | "voice-actors" | "characters";

export interface SearchCategoryDef {
  slug: SearchCategory;
  /** 部門タブ・0 件表示に出す名前 */
  label: string;
}

/** 部門タブの並び順 */
export const SEARCH_CATEGORIES: readonly SearchCategoryDef[] = [
  { slug: "anime", label: "アニメ" },
  { slug: "movies", label: "アニメ映画" },
  { slug: "voice-actors", label: "声優" },
  { slug: "characters", label: "キャラ" },
];

/** ヘッダー検索のタブ。ドロップダウン内の状態名で、URL の部門名とは別 */
export type HeaderSearchMode = "anime" | "movie" | "voice-actor" | "character";

const CATEGORY_FOR_MODE: Record<HeaderSearchMode, SearchCategory> = {
  anime: "anime",
  movie: "movies",
  "voice-actor": "voice-actors",
  character: "characters",
};

const MAX_QUERY_LENGTH = 100;

/**
 * URL の `q` を検索に渡せる形へ丸める（`.claude/rules/security.md` の sanitizeQuery と同じ）。
 * 同じキーが複数あれば Next は配列で渡してくるため、先頭だけを採る。
 */
export function sanitizeSearchQuery(
  raw: string | string[] | undefined,
): string {
  const value = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return value
    .replace(/<[^>]*>/g, "") // HTML タグ除去（XSS 対策）
    .replace(/[<>"'`]/g, "") // 残存する危険文字除去
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

/** 部門の検索結果画面の URL。page は 2 以降だけ付ける */
export function searchResultsHref(
  category: SearchCategory,
  query: string,
  page = 1,
): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/search/${category}?${qs}` : `/search/${category}`;
}

/** ヘッダー検索の Enter / 「すべての結果」の遷移先 */
export function headerSearchResultsHref(
  mode: HeaderSearchMode,
  query: string,
): string {
  return searchResultsHref(CATEGORY_FOR_MODE[mode], query);
}

/**
 * 検索結果画面（旧 `/search` を含む）のパスか。
 * 境界を付けて判定する（前方一致だと `/searching` まで巻き込む）
 */
export function isSearchResultsPath(pathname: string): boolean {
  return pathname === "/search" || pathname.startsWith("/search/");
}
