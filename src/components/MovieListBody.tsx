import SeasonAnimeCard from "@/components/SeasonAnimeCard";
import BrowseFilterForm from "@/components/BrowseFilterForm";
import BrowseFilterEmpty from "@/components/BrowseFilterEmpty";
import Pagination from "@/components/Pagination";
import { entryKey } from "@/lib/seasonal-anime";
import type { SeasonalEntry } from "@/lib/seasonal-anime";
import { isFilterActive, withFilter } from "@/lib/browse-filter";
import type { BrowseFilter } from "@/lib/browse-filter";

interface MovieListBodyProps {
  /** そのページ自身のパス（フィルターの送信先・ページ送りの起点） */
  basePath: string;
  filter: BrowseFilter;
  /** ジャンル選択を出すか（ジャンルの専用ページは false） */
  showGenre: boolean;
  /** 絞り込み後の作品（`toMovieEntry()` を通したもの） */
  entries: SeasonalEntry[];
  /** そのページで取得した作品数（絞り込み前） */
  fetchedCount: number;
  error: string | null;
  currentPage: number;
  totalPages: number;
}

/**
 * アニメ映画の「すべて見る」専用ページの本体（フィルター・グリッド・ページ送り）。
 * 見出しは各ページが持つ
 */
export default function MovieListBody({
  basePath,
  filter,
  showGenre,
  entries,
  fetchedCount,
  error,
  currentPage,
  totalPages,
}: MovieListBodyProps) {
  return (
    <>
      <BrowseFilterForm
        action={basePath}
        filter={filter}
        showGenre={showGenre}
        // 取得に失敗したときは「0 件中 0 件」を出さない
        fetchedCount={error ? undefined : fetchedCount}
        shownCount={error ? undefined : entries.length}
      />

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded mb-8">
          {error}
        </div>
      )}

      {!error &&
        entries.length === 0 &&
        isFilterActive(filter) &&
        fetchedCount > 0 && <BrowseFilterEmpty />}

      {!error && fetchedCount === 0 && (
        <p className="text-gray-500 text-lg text-center py-24">
          作品が見つかりませんでした
        </p>
      )}

      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 md:gap-4 xl:gap-5">
          {entries.map((entry) => (
            <SeasonAnimeCard key={entryKey(entry)} entry={entry} />
          ))}
        </div>
      )}

      {!error && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageUrl={(p) => withFilter(`${basePath}?page=${p}`, filter)}
          className="mt-12"
        />
      )}
    </>
  );
}
