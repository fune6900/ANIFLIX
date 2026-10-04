// 一覧ページ（「すべて見る」の飛び先）の共通フィルター

import {
  getAnimeKeywordIds,
  getAnimeWatchProviders,
  getMovieKeywordIds,
  getMovieWatchProviders,
} from "@/lib/tmdb";
import { ANIME_GENRES, genreKeywordIds } from "@/lib/genres";
import { movieGenreIdsFor } from "@/lib/movie-genres";
import type { AnimeGenre } from "@/lib/genres";
import { findStreamingService, streamingServicesIn } from "@/lib/providers";
import type { SeasonalEntry } from "@/lib/seasonal-anime";
import type {
  TMDbAnime,
  TMDbMovie,
  TMDbWatchProvidersResponse,
} from "@/types/tmdb";

/**
 * 選べるジャンル（ANIME_GENRES の全ジャンル）。
 * - TMDb ジャンル: 一覧レスポンスの genre_ids で判定する（追加リクエスト無し）
 * - キーワード由来: 一覧レスポンスに現れないため、作品ごとのキーワード（24h キャッシュ）で判定する
 */
export const FILTER_GENRES: readonly AnimeGenre[] = ANIME_GENRES;

/** 作品ごとの追加取得（配信情報・キーワード）を同時に引く上限（シーズン一覧は 100 件を超える） */
const LOOKUP_CONCURRENCY = 10;

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

/** TMDb ジャンル（genre_ids）で判定する。映画は TV 専用 ID を読み替える */
function hasTmdbGenre(target: FilterTarget, genreId: number): boolean {
  if (target.genreIds.includes(genreId)) return true;
  if (target.kind !== "movie") return false;
  // シーズン一覧に混ざる劇場版は TV 用の ID（10759 等）を持たない
  return movieGenreIdsFor(genreId).some((id) => target.genreIds.includes(id));
}

async function hasKeyword(
  target: FilterTarget,
  wanted: Set<number>,
): Promise<boolean> {
  try {
    const ids =
      target.kind === "movie"
        ? await getMovieKeywordIds(target.id)
        : await getAnimeKeywordIds(target.id);
    return ids.some((id) => wanted.has(id));
  } catch {
    // 取れなかった作品は「不明」として出さない（配信情報と同じ扱い）
    return false;
  }
}

/** 非同期の述語で絞る（並び順を保つ、同時 LOOKUP_CONCURRENCY 件まで） */
async function keepAsync<T>(
  items: T[],
  predicate: (item: T) => Promise<boolean>,
): Promise<T[]> {
  const keep = await mapLimit(items, LOOKUP_CONCURRENCY, predicate);
  return items.filter((_, i) => keep[i]);
}

/**
 * 渡された作品の中だけを絞る。新しく作品を取りに行くことはしない
 * （取得していない作品が条件に合っていても表示しない）。
 * 安い判定から順に通し、落ちた作品には後段の取得をしない
 */
async function applyFilter<T>(
  items: T[],
  filter: BrowseFilter,
  toTarget: (item: T) => FilterTarget | null,
): Promise<T[]> {
  if (!isFilterActive(filter)) return items;

  // TMDb に無い作品（AniList のみ）はジャンルも配信も判定できない
  let pool = items.flatMap((item) => {
    const target = toTarget(item);
    return target ? [{ item, target }] : [];
  });

  const genre = ANIME_GENRES.find((g) => g.id === filter.genreId);
  if (genre?.filterType === "genre") {
    pool = pool.filter((p) => hasTmdbGenre(p.target, genre.id));
  } else if (genre?.filterType === "keyword") {
    // 一覧と同じ固定のキーワード ID（#99）
    const wanted = new Set(genreKeywordIds(genre));
    pool =
      wanted.size === 0
        ? []
        : await keepAsync(pool, (p) => hasKeyword(p.target, wanted));
  }

  const service = filter.service;
  if (service !== null) {
    pool = await keepAsync(pool, (p) => isStreamingOn(p.target, service));
  }
  return pool.map((p) => p.item);
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
