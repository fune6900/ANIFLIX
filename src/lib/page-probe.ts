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
