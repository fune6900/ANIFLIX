// 「すべて見る」一覧の並び替え（ジャンル一覧 #99。年代一覧でも使う）

/** 選べる並び。URL クエリ `sort=` の値そのもの */
export const LIST_SORTS = ["year_desc", "year_asc"] as const;

export type ListSort = (typeof LIST_SORTS)[number];

/** 初期表示は新しい順 */
export const DEFAULT_LIST_SORT: ListSort = "year_desc";

/** 一覧の作品の種類（TV アニメ / アニメ映画） */
export type ListMediaType = "anime" | "movie";

function isListSort(value: string): value is ListSort {
  return (LIST_SORTS as readonly string[]).includes(value);
}

/**
 * URL クエリをホワイトリスト照合する。選択肢に無い値は初期値に戻す。
 * 戻り値だけが TMDb の sort_by（= Data Cache のキー）になる
 */
export function parseListSort(raw: string | string[] | undefined): ListSort {
  const value = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return isListSort(value) ? value : DEFAULT_LIST_SORT;
}

/** TV の sort_by（放送開始日） */
export function tvSortBy(
  sort: ListSort,
): "first_air_date.desc" | "first_air_date.asc" {
  return sort === "year_asc" ? "first_air_date.asc" : "first_air_date.desc";
}

/** 映画の sort_by（公開日） */
export function movieSortBy(
  sort: ListSort,
): "primary_release_date.desc" | "primary_release_date.asc" {
  return sort === "year_asc"
    ? "primary_release_date.asc"
    : "primary_release_date.desc";
}

/** 並び替えの表示名。TV は放送年、映画は公開年 */
export function listSortLabel(sort: ListSort, media: ListMediaType): string {
  const unit = media === "movie" ? "公開年" : "放送年";
  return `${unit}が${sort === "year_asc" ? "古い順" : "新しい順"}`;
}

/** リンクに並び替えを足す。初期値は付けない（URL を短く保つ） */
export function withSort(href: string, sort: ListSort): string {
  if (sort === DEFAULT_LIST_SORT) return href;
  return `${href}${href.includes("?") ? "&" : "?"}sort=${sort}`;
}
