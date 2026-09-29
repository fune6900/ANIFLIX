// `/browse/[category]`（人気 / トレンド / 新着）の取得

import {
  TMDB_MAX_PAGE,
  getJapaneseTrendingAnime,
  getNewAnime,
  getPopularAnime,
} from "@/lib/tmdb";
import type { TMDbAnime, TMDbSearchResponse } from "@/types/tmdb";

/** トレンド・新着の 1 ページあたりの件数（デバイス別件数より優先する） */
export const WIDE_PAGE_SIZE = 70;

/** TMDb の 1 ページあたりの件数 */
const TMDB_PAGE_SIZE = 20;

/** TMDb が返す最後の件（500 ページ × 20 件）まで届く wide ページ数 */
const MAX_WIDE_PAGE = Math.ceil((TMDB_MAX_PAGE * TMDB_PAGE_SIZE) / WIDE_PAGE_SIZE);

type TMDbPageFetcher = (page: number) => Promise<TMDbSearchResponse<TMDbAnime>>;

interface BrowseCategoryConfig {
  title: string;
  fetcher: TMDbPageFetcher;
  /** true なら WIDE_PAGE_SIZE 件、false ならデバイス別件数で 1 ページを組む */
  wide: boolean;
}

/**
 * トレンドはホームの「今週のトレンド」と同じ取得元（日本のアニメに絞った discover）。
 * 以前は世界のトレンド（/trending/tv/week）を後から日本作品で絞っており、
 * 1 ページ 20 件のうち数件しか残らなかった
 */
const BROWSE_CATEGORIES = {
  popular: {
    title: "🔥 今期人気アニメ",
    fetcher: (page: number) => getPopularAnime(page),
    wide: false,
  },
  trending: {
    title: "📈 今週のトレンド",
    fetcher: (page: number) => getJapaneseTrendingAnime(page),
    wide: true,
  },
  new: {
    title: "🆕 新着アニメ",
    fetcher: (page: number) => getNewAnime(page),
    wide: true,
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
  /** 実際に表示したページ番号（範囲外の要求は上限に丸める） */
  page: number;
  results: TMDbAnime[];
  totalPages: number;
  totalResults: number;
}

/**
 * page ページ目（1 始まり）を取る。
 *
 * wide なカテゴリは「先頭から (page-1)*70 件目からの 70 件」を、その範囲に
 * かかる TMDb のページ（4 ページ）を並列で取って切り出す。TMDb のページ境界と
 * 揃わなくても、前後のページで作品が抜けたり重複したりしない。
 *
 * @param deviceLimit wide でないカテゴリの 1 ページの件数（`itemsPerPage()`）
 */
export async function loadBrowseCategory(
  category: BrowseCategory,
  page: number,
  deviceLimit: number,
): Promise<BrowseCategoryPage> {
  const config = BROWSE_CATEGORIES[category];

  if (!config.wide) {
    const data = await config.fetcher(page);
    return {
      page,
      results: data.results.slice(0, deviceLimit),
      totalPages: data.total_pages,
      totalResults: data.total_results,
    };
  }

  return loadWidePage(config.fetcher, page);
}

async function loadWidePage(
  fetcher: TMDbPageFetcher,
  requestedPage: number,
): Promise<BrowseCategoryPage> {
  // parsePageParam は TMDb の 500 ページまで通すが、70 件単位では 143 ページで尽きる
  const page = Math.min(requestedPage, MAX_WIDE_PAGE);
  const start = (page - 1) * WIDE_PAGE_SIZE;
  const end = start + WIDE_PAGE_SIZE;
  const firstTmdbPage = Math.floor(start / TMDB_PAGE_SIZE) + 1;
  const lastTmdbPage = Math.min(Math.ceil(end / TMDB_PAGE_SIZE), TMDB_MAX_PAGE);

  const tmdbPages: number[] = [];
  for (let p = firstTmdbPage; p <= lastTmdbPage; p++) tmdbPages.push(p);

  const settled = await Promise.allSettled(tmdbPages.map((p) => fetcher(p)));
  if (tmdbPages.length > 0 && settled.every((r) => r.status === "rejected")) {
    throw new Error("TMDb から一覧を取得できませんでした");
  }

  // 各作品を通し番号（TMDb のページ × 20 + ページ内の位置）で窓に当てる。
  // 途中のページが落ちてもその 20 件分が欠けるだけで、後ろがずれて前に詰まらない
  const seen = new Set<number>();
  const results: TMDbAnime[] = [];
  let totalResults = 0;
  settled.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    totalResults = Math.max(totalResults, r.value.total_results);
    const base = (tmdbPages[i] - 1) * TMDB_PAGE_SIZE;
    r.value.results.forEach((anime, j) => {
      const index = base + j;
      if (index < start || index >= end) return;
      // 人気順のページングは境界で順位が入れ替わり、同じ作品が 2 ページに出ることがある
      if (seen.has(anime.id)) return;
      seen.add(anime.id);
      results.push(anime);
    });
  });

  // TMDb は 500 ページ（= 10000 件）より先を返さない
  const reachable = Math.min(totalResults, TMDB_MAX_PAGE * TMDB_PAGE_SIZE);
  return {
    page,
    results,
    totalPages: Math.max(1, Math.ceil(reachable / WIDE_PAGE_SIZE)),
    totalResults,
  };
}
