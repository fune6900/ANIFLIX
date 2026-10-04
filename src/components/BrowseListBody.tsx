import SeasonAnimeCard from "@/components/SeasonAnimeCard";
import BrowseFilterForm from "@/components/BrowseFilterForm";
import BrowseFilterEmpty from "@/components/BrowseFilterEmpty";
import Pagination from "@/components/Pagination";
import { entryKey } from "@/lib/seasonal-anime";
import type { SeasonalEntry } from "@/lib/seasonal-anime";
import { isFilterActive, withFilter } from "@/lib/browse-filter";
import type { BrowseFilter } from "@/lib/browse-filter";
import { DEFAULT_LIST_SORT, withSort } from "@/lib/list-sort";
import type { ListSort } from "@/lib/list-sort";

interface BrowseListBodyProps {
  /** そのページ自身のパス（フィルターの送信先・ページ送りの起点） */
  basePath: string;
  filter: BrowseFilter;
  /** ジャンル選択を出すか（ジャンルの専用ページは false） */
  showGenre: boolean;
  /** 並び替え（ある一覧だけ）。フィルターの送信とページ送りで引き継ぐ */
  sort?: ListSort;
  /** 絞り込み後の作品（TV は `{ kind: "tv" }`、映画は `toMovieEntry()` を通したもの） */
  entries: SeasonalEntry[];
  /** そのページで取得した作品数（絞り込み前） */
  fetchedCount: number;
  error: string | null;
  currentPage: number;
  totalPages: number;
  /** グリッドの列の段（省略時は一覧共通の段）。年代の一覧は従来の段を保つ */
  gridClassName?: string;
}

/** 一覧共通のグリッド。1920px 超は auto-fill（ポスター一覧 300px） */
const DEFAULT_GRID_CLASS =
  "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 md:gap-4 xl:gap-5";

/**
 * 70 件ページングの「すべて見る」一覧の本体（フィルター・グリッド・ページ送り）。
 * アニメ映画の一覧（#91）・ジャンルの一覧（#99）・年代の一覧（#100）で共用する。見出しは各ページが持つ
 */
export default function BrowseListBody({
  basePath,
  filter,
  showGenre,
  sort = DEFAULT_LIST_SORT,
  entries,
  fetchedCount,
  error,
  currentPage,
  totalPages,
  gridClassName = DEFAULT_GRID_CLASS,
}: BrowseListBodyProps) {
  // 初期値はクエリに載せない（withSort と同じ）
  const preserve: Record<string, string> =
    sort === DEFAULT_LIST_SORT ? {} : { sort };

  return (
    <>
      <BrowseFilterForm
        action={basePath}
        filter={filter}
        showGenre={showGenre}
        preserve={preserve}
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

      {/* 一覧そのものが空 */}
      {!error && fetchedCount === 0 && totalPages <= 1 && (
        <p className="text-gray-500 text-lg text-center py-24">
          作品が見つかりませんでした
        </p>
      )}

      {/* 一覧には作品があるが、このページは空（最新作がポスターの無い作品を落とした時など） */}
      {!error && fetchedCount === 0 && totalPages > 1 && (
        <p className="text-gray-500 text-center py-20">
          このページに表示できる作品はありません。前後のページを確かめてください
        </p>
      )}

      {entries.length > 0 && (
        <div className={gridClassName}>
          {entries.map((entry) => (
            <SeasonAnimeCard key={entryKey(entry)} entry={entry} />
          ))}
        </div>
      )}

      {!error && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageUrl={(p) =>
            withFilter(withSort(`${basePath}?page=${p}`, sort), filter)
          }
          className="mt-12"
        />
      )}
    </>
  );
}
