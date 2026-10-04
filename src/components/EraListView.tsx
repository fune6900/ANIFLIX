import Link from "next/link";
import MediaTypeTabs from "@/components/MediaTypeTabs";
import ListSortTabs from "@/components/ListSortTabs";
import BrowseListBody from "@/components/BrowseListBody";
import { ANIME_ERAS } from "@/lib/eras";
import type { AnimeEra } from "@/lib/eras";
import { eraListHref } from "@/lib/era-list";
import { withFilter } from "@/lib/browse-filter";
import type { BrowseFilter } from "@/lib/browse-filter";
import type { ListMediaType, ListSort } from "@/lib/list-sort";
import type { SeasonalEntry } from "@/lib/seasonal-anime";

interface EraListViewProps {
  era: AnimeEra;
  media: ListMediaType;
  sort: ListSort;
  filter: BrowseFilter;
  /** 絞り込み後の作品 */
  entries: SeasonalEntry[];
  /** そのページで取得した作品数（絞り込み前） */
  fetchedCount: number;
  error: string | null;
  currentPage: number;
  totalPages: number;
  totalResults: number;
}

const BACK_LINKS: Record<ListMediaType, { href: string; label: string }> = {
  anime: { href: "/", label: "ホームに戻る" },
  movie: { href: "/browse/movies", label: "アニメ映画に戻る" },
};

/** 年代の一覧の列の段（作り直し前の年代ページと同じ。1920px 超は auto-fill 300px） */
const ERA_GRID_CLASS =
  "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 md:gap-4 xl:gap-5";

/**
 * 年代の一覧（#100）の画面。アニメ（/browse/era/[decade]）とアニメ映画
 * （/browse/movies/era/[decade]）で共用し、上のタブで相互に切り替える
 */
export default function EraListView({
  era,
  media,
  sort,
  filter,
  entries,
  fetchedCount,
  error,
  currentPage,
  totalPages,
  totalResults,
}: EraListViewProps) {
  const back = BACK_LINKS[media];
  const basePath = eraListHref(media, era.decade);

  return (
    <div className="min-h-screen bg-[#141414]">
      <div
        className={`relative bg-gradient-to-b ${era.color} to-[#141414] pt-24 pb-14 overflow-hidden`}
      >
        {/* 大きな年代テキスト（装飾） */}
        <div className="absolute right-4 md:right-16 top-1/2 -translate-y-1/2 text-white/5 font-black text-[120px] md:text-[180px] leading-none select-none pointer-events-none">
          {era.shortLabel}
        </div>

        <div className="site-container relative">
          <Link
            href={back.href}
            className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-200 transition text-sm mb-6"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {back.label}
          </Link>

          <div className="flex items-end gap-5">
            <span className="text-5xl md:text-6xl select-none">
              {era.emoji}
            </span>
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">年代</p>
              <h1 className="text-white text-3xl md:text-4xl font-black">
                {era.label}
              </h1>
              <p className="text-gray-400 text-sm mt-1">{era.description}</p>
              {totalResults > 0 && (
                <p className="text-gray-500 text-xs mt-1">
                  {totalResults.toLocaleString()}件
                </p>
              )}
            </div>
          </div>

          {/* 他の年代へ（同じ種類・同じ並び・同じ絞り込みのまま。ページ番号は件数が違うので引き継がない） */}
          <div
            className="mt-8 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
            style={{ scrollbarWidth: "none" }}
          >
            {ANIME_ERAS.map((e) => (
              <Link
                key={e.decade}
                href={withFilter(eraListHref(media, e.decade, sort), filter)}
                aria-current={e.decade === era.decade ? "page" : undefined}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                  e.decade === era.decade
                    ? "bg-white text-black"
                    : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white"
                }`}
              >
                {e.shortLabel}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="site-container pb-20">
        <div className="mt-6">
          <MediaTypeTabs
            decade={era.decade}
            current={media}
            sort={sort}
            filter={filter}
          />
        </div>

        <ListSortTabs
          basePath={basePath}
          media={media}
          sort={sort}
          filter={filter}
        />

        <BrowseListBody
          basePath={basePath}
          filter={filter}
          showGenre
          sort={sort}
          entries={entries}
          fetchedCount={fetchedCount}
          error={error}
          currentPage={currentPage}
          totalPages={totalPages}
          gridClassName={ERA_GRID_CLASS}
        />
      </div>
    </div>
  );
}
