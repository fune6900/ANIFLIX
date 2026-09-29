import Link from "next/link";
import { FILTER_GENRES, isFilterActive } from "@/lib/browse-filter";
import type { BrowseFilter } from "@/lib/browse-filter";
import { STREAMING_SERVICES } from "@/lib/providers";

interface BrowseFilterFormProps {
  /** 送信先（そのページ自身のパス） */
  action: string;
  filter: BrowseFilter;
  /** 引き継ぐ既存のクエリ（年代ページの sort / q など）。page は渡さない = 1 ページ目に戻る */
  preserve?: Record<string, string>;
  /** そのページで取得した作品数（絞り込み前） */
  fetchedCount?: number;
  /** 絞り込み後に表示している作品数 */
  shownCount?: number;
}

/**
 * 一覧ページ（「すべて見る」の飛び先）の共通フィルター。
 * JavaScript 無しで動く GET フォームで、値は URL クエリに載る（lib/browse-filter.ts が検証する）
 */
export default function BrowseFilterForm({
  action,
  filter,
  preserve = {},
  fetchedCount,
  shownCount,
}: BrowseFilterFormProps) {
  const active = isFilterActive(filter);
  const preserveQuery = new URLSearchParams(preserve).toString();
  const clearHref = preserveQuery ? `${action}?${preserveQuery}` : action;

  return (
    <form
      role="search"
      method="get"
      action={action}
      className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-4 md:p-5 mb-8"
    >
      {Object.entries(preserve).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {/* フィールドは auto-fill（auto-fit だとウルトラワイドで select が 1000px を超える） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-[repeat(auto-fill,minmax(500px,1fr))] gap-4 xl:gap-5 items-end">
        <div>
          <label
            htmlFor="browse-filter-genre"
            className="block text-gray-400 text-xs font-semibold mb-1.5 uppercase tracking-wider"
          >
            ジャンル
          </label>
          <select
            id="browse-filter-genre"
            name="genre"
            defaultValue={filter.genreId !== null ? String(filter.genreId) : ""}
            className="w-full bg-[#2a2a2a] border border-gray-600 text-white text-sm rounded px-3 py-2 outline-none focus:border-gray-400 transition"
          >
            <option value="">すべて</option>
            {FILTER_GENRES.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.emoji} {g.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="browse-filter-service"
            className="block text-gray-400 text-xs font-semibold mb-1.5 uppercase tracking-wider"
          >
            配信サービス
          </label>
          <select
            id="browse-filter-service"
            name="service"
            defaultValue={filter.service ?? ""}
            className="w-full bg-[#2a2a2a] border border-gray-600 text-white text-sm rounded px-3 py-2 outline-none focus:border-gray-400 transition"
          >
            <option value="">すべて</option>
            {STREAMING_SERVICES.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="bg-[#E50914] hover:bg-red-700 text-white text-sm font-bold px-5 py-2 rounded transition"
          >
            絞り込む
          </button>
          {active && (
            <Link
              href={clearHref}
              className="text-[#54b9c5] text-sm font-semibold hover:text-white transition"
            >
              絞り込みを解除
            </Link>
          )}
        </div>
      </div>

      <p className="text-gray-500 text-xs mt-3">
        このページの作品から絞り込みます（配信サービスは日本の見放題・無料配信）。
        {active && fetchedCount !== undefined && shownCount !== undefined && (
          <span className="text-gray-300 ml-1">
            {fetchedCount} 件中 {shownCount} 件を表示中
          </span>
        )}
      </p>
    </form>
  );
}
