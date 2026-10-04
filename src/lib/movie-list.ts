// アニメ映画の「すべて見る」専用ページ（/browse/movies/latest・/browse/movies/genre/[genreId]）の取得

import {
  TMDB_MAX_PAGE,
  getAnimeMovieByKeywords,
  getAnimeMoviesByGenre,
  getLatestAnimeMovies,
} from "@/lib/tmdb";
import { WIDE_PAGE_SIZE } from "@/lib/browse-category";
import { movieGenreIdsFor } from "@/lib/movie-genres";
import type { AnimeGenre } from "@/lib/genres";
import type { TMDbMovie, TMDbSearchResponse } from "@/types/tmdb";

/** 1 ページの件数。TV の新着・トレンド一覧（`/browse/new` など）の 70 件に揃える */
export const MOVIE_LIST_PAGE_SIZE = WIDE_PAGE_SIZE;

/** TMDb の 1 ページあたりの件数 */
const TMDB_PAGE_SIZE = 20;

/** TMDb が返す最後の件（500 ページ × 20 件） */
const TMDB_REACHABLE = TMDB_MAX_PAGE * TMDB_PAGE_SIZE;

/** 最新作の専用ページ */
export const MOVIE_LATEST_LIST_HREF = "/browse/movies/latest";

/** ジャンルの専用ページ */
export function movieGenreListHref(genreId: number): string {
  return `/browse/movies/genre/${genreId}`;
}

/** TMDb の 1 ページ（20 件）を返す一覧 */
export type MovieListSource = (
  page: number,
) => Promise<TMDbSearchResponse<TMDbMovie>>;

export interface MovieListPage {
  /** 実際に表示したページ番号（総件数より先の要求は最終ページに寄せる） */
  page: number;
  results: TMDbMovie[];
  totalPages: number;
  totalResults: number;
}

export interface MovieListOptions {
  /** 表示する作品か（最新作はポスターの無い作品を落とす） */
  keep?: (movie: TMDbMovie) => boolean;
}

/** 全一覧の先頭 k 件のうち、各一覧から何件取ったか（交互に 1 件ずつ並べた時） */
function takenCounts(totals: readonly number[], k: number): number[] {
  const sum = totals.reduce((a, b) => a + b, 0);
  const target = Math.max(0, Math.min(k, sum));
  const takenAt = (rounds: number) =>
    totals.reduce((n, t) => n + Math.min(t, rounds), 0);

  // 全一覧から rounds 件ずつ取り切っても target を超えない最大の rounds
  let lo = 0;
  let hi = Math.max(0, ...totals);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (takenAt(mid) <= target) lo = mid;
    else hi = mid - 1;
  }

  // 残りは、まだ残っている一覧から先頭順に 1 件ずつ
  let rest = target - takenAt(lo);
  return totals.map((t) => {
    const base = Math.min(t, lo);
    if (t > lo && rest > 0) {
      rest--;
      return base + 1;
    }
    return base;
  });
}

/**
 * 重ならない複数の一覧を「先頭から 1 件ずつ交互に」（A0 B0 A1 B1 …、尽きた一覧は飛ばす）
 * 並べた全体の [start, end) が、各一覧のどの範囲 [from, to) に当たるか。
 *
 * 各一覧の件数さえ分かれば、前のページを取らずにどのページでも範囲が決まる。
 * 範囲はページ間で隙間なく続くので、全ページを通して抜けも重複も出ない
 */
export function interleavedRanges(
  totals: readonly number[],
  start: number,
  end: number,
): Array<[number, number]> {
  const from = takenCounts(totals, start);
  const to = takenCounts(totals, end);
  return totals.map((_, i) => [from[i], to[i]]);
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}

/**
 * page ページ目（1 始まり、70 件）を取る。
 *
 * - 一覧が 1 つ: 並び順のまま 70 件ずつ区切る（TV の新着一覧と同じ窓の切り方）
 * - 一覧が複数（ジャンルの読み替え先の合併）: 一覧どうしは重ならないこと（`without_genres`
 *   で割っておく）。交互に並べた全体を 70 件ずつ区切り、ページの中は人気順に並べ直す
 *
 * 各一覧の総件数を知るために 1 ページ目を先に取る（30 分キャッシュ）。
 * 途中のページが落ちてもその 20 件が欠けるだけで、後ろが前へずれない。
 * すべての取得が落ちた時だけ throw する
 */
export async function loadMovieListPage(
  sources: readonly MovieListSource[],
  requestedPage: number,
  options: MovieListOptions = {},
): Promise<MovieListPage> {
  const cache = sources.map(
    () => new Map<number, Promise<TMDbSearchResponse<TMDbMovie>>>(),
  );
  const fetchPage = (i: number, page: number) => {
    let p = cache[i].get(page);
    if (!p) {
      p = sources[i](page);
      cache[i].set(page, p);
    }
    return p;
  };

  const firsts = await Promise.allSettled(
    sources.map((_, i) => fetchPage(i, 1)),
  );
  if (firsts.every((r) => r.status === "rejected")) {
    throw new Error("TMDb から一覧を取得できませんでした");
  }
  // 1 ページ目が落ちた一覧は件数が分からないので 0 件として扱う（他の一覧は出す）
  const totals = firsts.map((r) =>
    r.status === "fulfilled"
      ? Math.min(Math.max(0, r.value.total_results), TMDB_REACHABLE)
      : 0,
  );
  const totalResults = totals.reduce((a, b) => a + b, 0);
  const totalPages = Math.max(
    1,
    Math.ceil(totalResults / MOVIE_LIST_PAGE_SIZE),
  );
  const page = Math.max(1, Math.min(requestedPage, totalPages));
  const start = (page - 1) * MOVIE_LIST_PAGE_SIZE;
  const ranges = interleavedRanges(totals, start, start + MOVIE_LIST_PAGE_SIZE);

  const perSource = await Promise.all(
    ranges.map(async ([from, to], i) => {
      if (to <= from) return { requested: 0, failed: 0, items: [] };
      const pages = range(
        Math.floor(from / TMDB_PAGE_SIZE) + 1,
        Math.min(Math.ceil(to / TMDB_PAGE_SIZE), TMDB_MAX_PAGE),
      );
      const settled = await Promise.allSettled(
        pages.map((p) => fetchPage(i, p)),
      );
      const items: TMDbMovie[] = [];
      settled.forEach((r, j) => {
        if (r.status !== "fulfilled") return;
        const base = (pages[j] - 1) * TMDB_PAGE_SIZE;
        r.value.results.forEach((movie, n) => {
          const index = base + n;
          if (index >= from && index < to) items.push(movie);
        });
      });
      const failed = settled.filter((r) => r.status === "rejected").length;
      return { requested: pages.length, failed, items };
    }),
  );

  const requested = perSource.reduce((n, s) => n + s.requested, 0);
  const failed = perSource.reduce((n, s) => n + s.failed, 0);
  if (requested > 0 && failed === requested) {
    throw new Error("TMDb から一覧を取得できませんでした");
  }

  // 人気順のページングは境界で順位が入れ替わり、同じ作品が 2 回来ることがある
  const seen = new Set<number>();
  const merged = perSource
    .flatMap((s) => s.items)
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

  // 合併はページの中を人気順に。1 つの一覧は並び（最新作なら公開日順）を崩さない
  const ordered =
    sources.length > 1
      ? [...merged].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      : merged;

  const keep = options.keep;
  return {
    page,
    results: keep ? ordered.filter(keep) : ordered,
    totalPages,
    totalResults,
  };
}

/**
 * 最新作: ホームの「最新作」行と同じ取得（日本時間の今日以前に公開・公開日の新しい順）。
 * 行と同じくポスターの無い作品を落とすので、行の 20 件はこの一覧の先頭と一致する
 */
export function loadLatestMovieList(page: number): Promise<MovieListPage> {
  return loadMovieListPage([(p) => getLatestAnimeMovies(p)], page, {
    keep: (m) => Boolean(m.poster_path),
  });
}

/**
 * ジャンルの一覧のソース。ホームのジャンル行と同じ意味にする。
 * - キーワード由来: キーワード（追加キーワード込み）の OR
 * - TMDb ジャンル: 映画のジャンルに読み替え、読み替え先が複数なら合併
 *   （28 ∪ 12 を「28」と「12 から 28 を除いた残り」に割る。`with_genres` は AND と OR を混ぜられない）
 */
export function genreMovieSources(genre: AnimeGenre): MovieListSource[] {
  if (genre.filterType === "keyword" && genre.keyword) {
    const keywords = [genre.keyword, ...(genre.extraKeywords ?? [])];
    return [(p) => getAnimeMovieByKeywords(keywords, p)];
  }
  const ids = movieGenreIdsFor(genre.id);
  return ids.map(
    (id, i) => (p: number) => getAnimeMoviesByGenre(id, p, ids.slice(0, i)),
  );
}

/** ジャンルの専用ページ。`genre` は `findGenre()` で照合済みのものだけを渡す */
export function loadGenreMovieList(
  genre: AnimeGenre,
  page: number,
): Promise<MovieListPage> {
  return loadMovieListPage(genreMovieSources(genre), page);
}
