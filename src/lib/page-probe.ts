// 実在する最終ページを二分探索で求める

export interface ProbedPages {
  /** 中身がある最後のページ（1 始まり）。1 件も無ければ 0 */
  lastPage: number;
  /** 実在する件数 */
  total: number;
}

/**
 * 申告された最終ページ `upper` を上限に、中身がある最後のページを二分探索で求める。
 *
 * AniList のネストした connection（`Media.characters` 等）の pageInfo は実態と食い違う
 * （葬送のフリーレン: 申告 500 件・20 ページ / 実際 100 件・4 ページ。2026-10-04 実測）。
 * 各ページの件数だけを見て本当の終わりを探す。問い合わせは log2(upper) 回程度で済む。
 *
 * 前提: 最終ページより前のページはすべて満杯（perPage 件）で、最終ページ以降は空。
 * つまり「ページ n に中身がある」は n が小さいほど真になる単調な性質を持つ。
 * 途中に空ページが挟まる並びでは二分探索が最終ページを取り違える。
 *
 * @param countOn page ページ目の件数を返す。失敗したら throw してよい（そのまま投げ直す）
 */
export async function probeLastPage(
  upper: number,
  perPage: number,
  countOn: (page: number) => Promise<number>,
): Promise<ProbedPages> {
  const counts = new Map<number, number>();
  const count = async (page: number): Promise<number> => {
    const known = counts.get(page);
    if (known !== undefined) return known;
    const n = await countOn(page);
    counts.set(page, n);
    return n;
  };

  if ((await count(1)) === 0) return { lastPage: 0, total: 0 };

  // lo は中身があると分かっているページ、hi は候補の上限
  let lo = 1;
  let hi = Math.max(1, upper);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if ((await count(mid)) > 0) lo = mid;
    else hi = mid - 1;
  }

  return { lastPage: lo, total: (lo - 1) * perPage + (await count(lo)) };
}

export interface ResolvedPaging {
  /** 送れる最後のページ。数えられたら実在の最終ページ（1 件も無ければ 0） */
  lastPage: number;
  /** 実在する件数。数えられなかったら null（表示しない） */
  total: number | null;
  /** URL のページ番号を寄せる先。寄せる必要が無ければ null */
  redirectTo: number | null;
}

/**
 * 今のページの件数と、数えた結果（数えられなかったら null）から、最終ページと寄せ先を決める。
 *
 * - 数えられた: 範囲外のページ番号は最終ページへ寄せる。1 件も無ければ 1 ページ目へ
 * - 数えられなかった: 今のページが満杯なら次のページがあるかもしれないので 1 つ先まで出す。
 *   ちょうど perPage の倍数だと次は空ページになるが、空ページを開いたら 1 ページ目へ戻すので
 *   行き止まりにはならない。満杯でなければ今のページが最終ページ
 *
 * 1 ページ目からはどこへも寄せない（寄せ先がまた寄せる、のループを作らない）。
 */
export function resolvePaging(
  currentPage: number,
  perPage: number,
  shownCount: number,
  counted: ProbedPages | null,
): ResolvedPaging {
  if (counted) {
    const { lastPage, total } = counted;
    const redirectTo =
      currentPage > 1 && currentPage > lastPage ? Math.max(1, lastPage) : null;
    return { lastPage, total, redirectTo };
  }

  const lastPage = shownCount >= perPage ? currentPage + 1 : currentPage;
  const redirectTo = currentPage > 1 && shownCount === 0 ? 1 : null;
  return { lastPage, total: null, redirectTo };
}
