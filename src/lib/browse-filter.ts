// 一覧ページ（「すべて見る」の飛び先）の共通フィルター

import { getAnimeWatchProviders, getMovieWatchProviders } from "@/lib/tmdb";
import { ANIME_GENRES } from "@/lib/genres";
import type { AnimeGenre } from "@/lib/genres";
import { findStreamingService, streamingServicesIn } from "@/lib/providers";
import type { SeasonalEntry } from "@/lib/seasonal-anime";
import type {
  TMDbAnime,
  TMDbMovie,
  TMDbWatchProvidersResponse,
} from "@/types/tmdb";

/**
 * 選べるジャンル。一覧レスポンスの genre_ids で判定できる TMDb ジャンルだけ。
 * キーワード由来のジャンル（9001〜）は一覧レスポンスに現れず、
 * 作品ごとに追加リクエストしないと判定できないため選択肢に出さない
 */
export const FILTER_GENRES: readonly AnimeGenre[] = ANIME_GENRES.filter(
  (g) => g.filterType === "genre",
);

/** 配信情報を同時に引く上限（シーズン一覧は 1 ページで 100 件を超える） */
const PROVIDER_CONCURRENCY = 10;

export interface BrowseFilter {
  genreId: number | null;
  /** `STREAMING_SERVICES` の slug */
  service: string | null;
}

export interface BrowseFilterParams {
  genre?: string | string[];
  service?: string | string[];
}

function first(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}

/** URL クエリをホワイトリスト照合する。選択肢に無い値は「絞らない」として捨てる */
export function parseBrowseFilter(sp: BrowseFilterParams): BrowseFilter {
  const genreRaw = first(sp.genre);
  const genreNum = /^\d{1,6}$/.test(genreRaw) ? Number(genreRaw) : NaN;
  const genre = FILTER_GENRES.find((g) => g.id === genreNum);

  const service = findStreamingService(first(sp.service));

  return {
    genreId: genre?.id ?? null,
    service: service?.slug ?? null,
  };
}

export function isFilterActive(filter: BrowseFilter): boolean {
  return filter.genreId !== null || filter.service !== null;
}

/** リンクにフィルターのクエリを足す（ページ送りで条件が消えないように） */
export function withFilter(href: string, filter: BrowseFilter): string {
  const params = new URLSearchParams();
  if (filter.genreId !== null) params.set("genre", String(filter.genreId));
  if (filter.service !== null) params.set("service", filter.service);
  const query = params.toString();
  if (!query) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${query}`;
}

/** 判定に必要な形。TMDb に無い作品（AniList のみ）は null */
interface FilterTarget {
  kind: "tv" | "movie";
  id: number;
  genreIds: number[];
}

/** 並び順を保ったまま、同時 limit 件までで非同期の述語を評価する */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

async function isStreamingOn(
  target: FilterTarget,
  service: string,
): Promise<boolean> {
  try {
    const res: TMDbWatchProvidersResponse =
      target.kind === "movie"
        ? await getMovieWatchProviders(target.id)
        : await getAnimeWatchProviders(target.id);
    return streamingServicesIn(res).has(service);
  } catch {
    // 取れなかった作品は「不明」。配信中と断定できないので出さないが、ページは落とさない
    return false;
  }
}

/**
 * 渡された作品の中だけを絞る。新しく作品を取りに行くことはしない
 * （取得していない作品が条件に合っていても表示しない）
 */
async function applyFilter<T>(
  items: T[],
  filter: BrowseFilter,
  toTarget: (item: T) => FilterTarget | null,
): Promise<T[]> {
  if (!isFilterActive(filter)) return items;

  // ジャンルは一覧データだけで判定できる。先に落として配信情報の取得を減らす
  const byGenre = items.filter((item) => {
    const target = toTarget(item);
    if (!target) return false;
    return filter.genreId === null || target.genreIds.includes(filter.genreId);
  });

  const service = filter.service;
  if (service === null) return byGenre;

  const keep = await mapLimit(byGenre, PROVIDER_CONCURRENCY, (item) => {
    const target = toTarget(item);
    return target ? isStreamingOn(target, service) : Promise.resolve(false);
  });
  return byGenre.filter((_, i) => keep[i]);
}

export function filterAnime(
  items: TMDbAnime[],
  filter: BrowseFilter,
): Promise<TMDbAnime[]> {
  return applyFilter(items, filter, (a) => ({
    kind: "tv",
    id: a.id,
    genreIds: a.genre_ids ?? [],
  }));
}

function movieTarget(m: TMDbMovie): FilterTarget {
  return { kind: "movie", id: m.id, genreIds: m.genre_ids ?? [] };
}

export function filterEntries(
  entries: SeasonalEntry[],
  filter: BrowseFilter,
): Promise<SeasonalEntry[]> {
  return applyFilter(entries, filter, (e) => {
    if (e.kind === "tv") {
      return { kind: "tv", id: e.anime.id, genreIds: e.anime.genre_ids ?? [] };
    }
    if (e.kind === "movie") return movieTarget(e.movie);
    // TMDb に無い作品はジャンルも配信も判定できない
    return null;
  });
}
