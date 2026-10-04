import Link from "next/link";
import { withFilter } from "@/lib/browse-filter";
import type { BrowseFilter } from "@/lib/browse-filter";
import { LIST_SORTS, listSortLabel, withSort } from "@/lib/list-sort";
import type { ListMediaType, ListSort } from "@/lib/list-sort";

interface ListSortTabsProps {
  /** そのページ自身のパス（クエリ無し） */
  basePath: string;
  media: ListMediaType;
  sort: ListSort;
  /** 並びを変えても残す絞り込み */
  filter: BrowseFilter;
}

/**
 * 一覧の並び替え（放送年 / 公開年の新しい順・古い順）。
 * JavaScript 無しで動くリンクで、並びを変えたら 1 ページ目に戻る
 */
export default function ListSortTabs({
  basePath,
  media,
  sort,
  filter,
}: ListSortTabsProps) {
  return (
    <nav
      aria-label="並び替え"
      className="flex flex-wrap items-center gap-2 mb-6"
    >
      <span className="text-gray-500 text-sm" aria-hidden="true">
        並び替え:
      </span>
      {LIST_SORTS.map((s) => {
        const active = s === sort;
        return (
          <Link
            key={s}
            href={withFilter(withSort(basePath, s), filter)}
            aria-current={active ? "page" : undefined}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              active
                ? "bg-white text-black"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            {listSortLabel(s, media)}
          </Link>
        );
      })}
    </nav>
  );
}
