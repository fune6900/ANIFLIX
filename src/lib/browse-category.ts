// `/browse/[category]`（人気 / トレンド / 新着）の取得

import {
  TMDB_MAX_PAGE,
  getNewAnime,
  getPopularAnime,
  getTrendingAnime,
} from "@/lib/tmdb";
import type { TMDbAnime, TMDbSearchResponse } from "@/types/tmdb";

/** トレンド・新着の 1 ページあたりの件数（デバイス別件数より優先する） */
export const WIDE_PAGE_SIZE = 70;

/** TMDb の 1 ページあたりの件数 */
const TMDB_PAGE_SIZE = 20;

/** TMDb が返す最後の件（500 ページ × 20 件）まで届く wide ページ数 */
const MAX_WIDE_PAGE = Math.ceil(
  (TMDB_MAX_PAGE * TMDB_PAGE_SIZE) / WIDE_PAGE_SIZE,
);

/**
 * トレンドで見る週間トレンドのページ数。
 * 世界の TV 全体のうち日本のアニメは 1 ページ 20 件に数件しか無い。
 * 20 ページ（400 件）で日本のアニメが 90 件前後残る（2026-09 実測 94 件）
 */
const TRENDING_SCAN_PAGES = 20;

/** アニメーション（TMDb ジャンル ID） */
const ANIMATION_GENRE_ID = 16;

type TMDbPageFetcher = (page: number) => Promise<TMDbSearchResponse<TMDbAnime>>;

/**
 * 1 ページの組み方。
 * - device: TMDb 1 ページをデバイス別件数で切る
 * - window: 先頭から (page-1)*70 件目からの 70 件を、かかる TMDb ページから切り出す
 * - scan:   先頭 N ページを全部見て条件で絞り、絞った一覧を 70 件ずつ区切る
 */
type PagingMode =
  | { kind: "device" }
  | { kind: "window" }
  | { kind: "scan"; pages: number; keep: (anime: TMDbAnime) => boolean };

interface BrowseCategoryConfig {
  title: string;
  fetcher: TMDbPageFetcher;
  paging: PagingMode;
}

function isJapaneseAnime(anime: TMDbAnime): boolean {
  // 「アニメ **または** 日本」だと日本の実写ドラマや海外のアニメまで混ざる
  return (
    anime.genre_ids.includes(ANIMATION_GENRE_ID) &&
    anime.origin_country.includes("JP")
  );
}

const BROWSE_CATEGORIES = {
  popular: {
    title: "🔥 今期人気アニメ",
    fetcher: (page: number) => getPopularAnime(page),
    paging: { kind: "device" },
  },
  trending: {
    title: "📈 今週のトレンド",
    fetcher: (page: number) => getTrendingAnime(page),
    paging: { kind: "scan", pages: TRENDING_SCAN_PAGES, keep: isJapaneseAnime },
  },
  new: {
    title: "🆕 新着アニメ",
    fetcher: (page: number) => getNewAnime(page),
    paging: { kind: "window" },
  },
} as const satisfies Record<string, BrowseCategoryConfig>;

export type BrowseCategory = keyof typeof BROWSE_CATEGORIES;

/** URL の category をホワイトリスト照合する（`in` はプロトタイプの constructor 等も通すので使わない） */
export function isBrowseCategory(raw: string): raw is BrowseCategory {
  return Object.prototype.hasOwnProperty.call(BROWSE_CATEGORIES, raw);
}

export function browseCategoryTitle(category: BrowseCategory): string {
  return BROWSE_CATEGORIES[category].title;
}

export interface BrowseCategoryPage {
  /** 実際に表示したページ番号（総件数より先の要求は最終ページに寄せる） */
  page: number;
  results: TMDbAnime[];
  totalPages: number;
  totalResults: number;
}

/**
 * page ページ目（1 始まり）を取る。
 *
 * @param deviceLimit device モードのカテゴリの 1 ページの件数（`itemsPerPage()`）
 */
export async function loadBrowseCategory(
  category: BrowseCategory,
  page: number,
  deviceLimit: number,
): Promise<BrowseCategoryPage> {
  const config: BrowseCategoryConfig = BROWSE_CATEGORIES[category];
  const paging = config.paging;

  if (paging.kind === "scan") {
    return loadScannedPage(config.fetcher, page, paging.pages, paging.keep);
  }
  if (paging.kind === "window") {
    const first = await loadWindowPage(config.fetcher, page);
    // 総件数より先を求められたら、実際の最終ページを取り直す（空のグリッドを出さない）
    if (first.results.length === 0 && first.page > first.totalPages) {
      return loadWindowPage(config.fetcher, first.totalPages);
    }
    return first;
  }

  const data = await config.fetcher(page);
  return {
    page,
    results: data.results.slice(0, deviceLimit),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  };
}

/** 全部 reject なら throw、そうでなければ成功したものだけ（位置付き）返す */
async function fetchPages(
  fetcher: TMDbPageFetcher,
  pages: number[],
): Promise<Array<{ page: number; data: TMDbSearchResponse<TMDbAnime> }>> {
  const settled = await Promise.allSettled(pages.map((p) => fetcher(p)));
  if (pages.length > 0 && settled.every((r) => r.status === "rejected")) {
    throw new Error("TMDb から一覧を取得できませんでした");
  }
  const ok: Array<{ page: number; data: TMDbSearchResponse<TMDbAnime> }> = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") ok.push({ page: pages[i], data: r.value });
  });
  return ok;
}

/**
 * 「先頭から (page-1)*70 件目からの 70 件」を、その範囲にかかる TMDb のページ
 * （4 ページ）を並列で取って切り出す。TMDb のページ境界と揃わなくても、
 * 各作品を通し番号で窓に当てるので前後のページで抜けも重複も出ない
 * （TMDb 側で順位が入れ替わった場合を除く）
 */
async function loadWindowPage(
  fetcher: TMDbPageFetcher,
  requestedPage: number,
): Promise<BrowseCategoryPage> {
  // parsePageParam は TMDb の 500 ページまで通すが、70 件単位では 143 ページで尽きる
  const page = Math.max(1, Math.min(requestedPage, MAX_WIDE_PAGE));
  const start = (page - 1) * WIDE_PAGE_SIZE;
  const end = start + WIDE_PAGE_SIZE;
  const firstTmdbPage = Math.floor(start / TMDB_PAGE_SIZE) + 1;
  const lastTmdbPage = Math.min(Math.ceil(end / TMDB_PAGE_SIZE), TMDB_MAX_PAGE);

  const tmdbPages: number[] = [];
  for (let p = firstTmdbPage; p <= lastTmdbPage; p++) tmdbPages.push(p);

  const fetched = await fetchPages(fetcher, tmdbPages);

  // 途中のページが落ちてもその 20 件分が欠けるだけで、後ろがずれて前に詰まらない
  const seen = new Set<number>();
  const results: TMDbAnime[] = [];
  let totalResults = 0;
  for (const { page: tmdbPage, data } of fetched) {
    totalResults = Math.max(totalResults, data.total_results);
    const base = (tmdbPage - 1) * TMDB_PAGE_SIZE;
    data.results.forEach((anime, j) => {
      const index = base + j;
      if (index < start || index >= end) return;
      // 人気順のページングは境界で順位が入れ替わり、同じ作品が 2 ページに出ることがある
      if (seen.has(anime.id)) return;
      seen.add(anime.id);
      results.push(anime);
    });
  }

  // TMDb は 500 ページ（= 10000 件）より先を返さない
  const reachable = Math.min(totalResults, TMDB_MAX_PAGE * TMDB_PAGE_SIZE);
  return {
    page,
    results,
    totalPages: Math.max(1, Math.ceil(reachable / WIDE_PAGE_SIZE)),
    totalResults,
  };
}

/**
 * 先頭 scanPages ページを並列で取り、keep で絞った一覧を 70 件ずつ区切る。
 * 絞った後の件数でページを数えるので、範囲外は最終ページに寄せられる
 */
async function loadScannedPage(
  fetcher: TMDbPageFetcher,
  requestedPage: number,
  scanPages: number,
  keep: (anime: TMDbAnime) => boolean,
): Promise<BrowseCategoryPage> {
  const pages = Array.from({ length: scanPages }, (_, i) => i + 1);
  const fetched = await fetchPages(fetcher, pages);

  const seen = new Set<number>();
  const pool: TMDbAnime[] = [];
  for (const { data } of fetched) {
    for (const anime of data.results) {
      if (!keep(anime) || seen.has(anime.id)) continue;
      seen.add(anime.id);
      pool.push(anime);
    }
  }

  const totalPages = Math.max(1, Math.ceil(pool.length / WIDE_PAGE_SIZE));
  const page = Math.max(1, Math.min(requestedPage, totalPages));
  const start = (page - 1) * WIDE_PAGE_SIZE;
  return {
    page,
    results: pool.slice(start, start + WIDE_PAGE_SIZE),
    totalPages,
    totalResults: pool.length,
  };
}
