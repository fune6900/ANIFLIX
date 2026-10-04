// 「すべて見る」一覧の 70 件ページング（アニメ・アニメ映画で共用）

import {
  TMDB_MAX_PAGE,
  TMDB_PAGE_SIZE,
  TMDB_REACHABLE_RESULTS,
} from "@/lib/tmdb";
import { WIDE_PAGE_SIZE } from "@/lib/browse-category";
import type { TMDbSearchResponse } from "@/types/tmdb";

/** 1 ページの件数。TV の新着・トレンド一覧（`/browse/new` など）の 70 件に揃える */
export const LIST_PAGE_SIZE = WIDE_PAGE_SIZE;

/** 1 本の並びに合わせられる一覧の数の上限（境目の探し方が 2 本前提） */
const MAX_MERGED_SOURCES = 2;

/** TMDb の 1 ページ（20 件）を返す一覧 */
export type ListSource<T> = (page: number) => Promise<TMDbSearchResponse<T>>;

export interface ListPage<T> {
  /** 実際に表示したページ番号（総件数より先の要求は最終ページに寄せる） */
  page: number;
  results: T[];
  totalPages: number;
  totalResults: number;
}

export interface ListPageOptions<T> {
  /** 表示する作品か（ポスターの無い作品を落とすなど）。ページの区切りを決めた後に効く */
  keep?: (item: T) => boolean;
  /**
   * 複数の一覧を 1 本に並べる時の順序（負なら a が先）。
   * 各一覧はこの順序で既に並んでいること（TMDb の sort_by と揃える）
   */
  compare?: (a: T, b: T) => number;
}

/**
 * 日付で並べる比較関数。日付の無い作品はどちらの向きでも最後に回す
 * （TMDb は日付で絞った一覧に日付の無い作品を返さないため、保険）
 */
export function byDate<T>(
  dateOf: (item: T) => string | undefined,
  order: "desc" | "asc",
): (a: T, b: T) => number {
  return (a, b) => {
    const da = dateOf(a) ?? "";
    const db = dateOf(b) ?? "";
    if (da === db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    const asc = da < db ? -1 : 1;
    return order === "asc" ? asc : -asc;
  };
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}

/** 一覧ごとの TMDb ページを 1 回の表示の中で使い回す */
function pageCache<T>(sources: readonly ListSource<T>[]) {
  const cache = sources.map(
    () => new Map<number, Promise<TMDbSearchResponse<T>>>(),
  );
  return (i: number, page: number) => {
    let p = cache[i].get(page);
    if (!p) {
      p = sources[i](page);
      cache[i].set(page, p);
    }
    return p;
  };
}

/**
 * 2 本の並び A・B を 1 本に合わせた時、先頭 k 件のうち A から何件取るか。
 * 同順位は A を先にする。二分探索なので、深いページでも前のページを全部は読まない
 * （1 回の探索で各一覧 log2(総件数) 件ほどを見る）
 */
async function splitAt<T>(
  k: number,
  totals: readonly [number, number],
  itemAt: (source: 0 | 1, index: number) => Promise<T>,
  compare: (a: T, b: T) => number,
): Promise<number> {
  const [nA, nB] = totals;
  let lo = Math.max(0, k - nB);
  let hi = Math.min(k, nA);
  while (lo < hi) {
    // a = A から取る件数の候補。A[a] が B[k-a-1] より先に来るなら a は小さすぎる
    const a = Math.floor((lo + hi) / 2);
    const b = k - a;
    if (compare(await itemAt(0, a), await itemAt(1, b - 1)) <= 0) {
      lo = a + 1;
    } else {
      hi = a;
    }
  }
  return lo;
}

/**
 * page ページ目（1 始まり、70 件）を取る。
 *
 * - 一覧が 1 つ: 並び順のまま 70 件ずつ区切る
 * - 一覧が 2 つ（ジャンルの読み替え先の合併）: 一覧どうしは重ならないこと（`without_genres`
 *   で割っておく）。`compare` の順に 1 本へ合わせた全体を 70 件ずつ区切る。ページの境目は
 *   二分探索で求めるので、全ページを通して並びが崩れず、抜けも重複も出ない
 *
 * 各一覧の総件数を知るために 1 ページ目を先に取る（30 分キャッシュ）。
 * 途中のページが落ちてもその 20 件が欠けるだけで、後ろが前へずれない。
 * ただし合併の境目を探す途中で落ちたら、境目が決まらないので throw する。
 * すべての取得が落ちた時も throw する
 */
export async function loadListPage<T extends { id: number }>(
  sources: readonly ListSource<T>[],
  requestedPage: number,
  options: ListPageOptions<T> = {},
): Promise<ListPage<T>> {
  const { compare, keep } = options;
  if (sources.length > 1 && !compare) {
    throw new Error("複数の一覧を合わせるには並び順（compare）が要る");
  }
  if (sources.length > MAX_MERGED_SOURCES) {
    throw new Error(`合わせられる一覧は ${MAX_MERGED_SOURCES} つまで`);
  }

  const fetchPage = pageCache(sources);
  const firsts = await Promise.allSettled(
    sources.map((_, i) => fetchPage(i, 1)),
  );
  if (firsts.every((r) => r.status === "rejected")) {
    throw new Error("TMDb から一覧を取得できませんでした");
  }
  // 1 ページ目が落ちた一覧は件数が分からないので 0 件として扱う（他の一覧は出す）
  const totals = firsts.map((r) =>
    r.status === "fulfilled"
      ? Math.min(Math.max(0, r.value.total_results), TMDB_REACHABLE_RESULTS)
      : 0,
  );
  const totalResults = totals.reduce((a, b) => a + b, 0);
  const totalPages = Math.max(1, Math.ceil(totalResults / LIST_PAGE_SIZE));
  const page = Math.max(1, Math.min(requestedPage, totalPages));
  const start = (page - 1) * LIST_PAGE_SIZE;
  const end = Math.min(start + LIST_PAGE_SIZE, totalResults);

  // 各一覧のどの範囲 [from, to) がこのページに入るか
  let ranges: Array<[number, number]>;
  if (sources.length === 2 && compare) {
    const pair: readonly [number, number] = [totals[0], totals[1]];
    const itemAt = async (source: 0 | 1, index: number): Promise<T> => {
      const res = await fetchPage(
        source,
        Math.floor(index / TMDB_PAGE_SIZE) + 1,
      );
      const item = res.results[index % TMDB_PAGE_SIZE];
      if (!item) throw new Error("TMDb の一覧が総件数より短い");
      return item;
    };
    const aStart = await splitAt(start, pair, itemAt, compare);
    const aEnd = await splitAt(end, pair, itemAt, compare);
    ranges = [
      [aStart, aEnd],
      [start - aStart, end - aEnd],
    ];
  } else {
    ranges = totals.map(() => [start, end]);
  }

  const perSource = await Promise.all(
    ranges.map(async ([from, to], i) => {
      if (to <= from) return { requested: 0, failed: 0, items: [] as T[] };
      const pages = range(
        Math.floor(from / TMDB_PAGE_SIZE) + 1,
        Math.min(Math.ceil(to / TMDB_PAGE_SIZE), TMDB_MAX_PAGE),
      );
      const settled = await Promise.allSettled(
        pages.map((p) => fetchPage(i, p)),
      );
      const items: T[] = [];
      settled.forEach((r, j) => {
        if (r.status !== "fulfilled") return;
        const base = (pages[j] - 1) * TMDB_PAGE_SIZE;
        r.value.results.forEach((item, n) => {
          const index = base + n;
          if (index >= from && index < to) items.push(item);
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

  // 範囲はそれぞれ compare の順に並んでいるので、合わせても 1 本の並びになる
  const merged =
    perSource.length > 1 && compare
      ? mergeSorted(
          perSource.map((s) => s.items),
          compare,
        )
      : perSource.flatMap((s) => s.items);

  // TMDb のページングは境界で順位が入れ替わり、同じ作品が 2 回来ることがある
  const seen = new Set<number>();
  const unique = merged.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return {
    page,
    results: keep ? unique.filter(keep) : unique,
    totalPages,
    totalResults,
  };
}

/** 並んだ配列どうしを 1 本にする（同順位は前の配列を先に） */
function mergeSorted<T>(lists: T[][], compare: (a: T, b: T) => number): T[] {
  const [a = [], b = []] = lists;
  const out: T[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (compare(a[i], b[j]) <= 0) out.push(a[i++]);
    else out.push(b[j++]);
  }
  return [...out, ...a.slice(i), ...b.slice(j)];
}
