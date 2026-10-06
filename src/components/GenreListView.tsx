import Link from "next/link";
import MediaTypeTabs from "@/components/MediaTypeTabs";
import ListSortTabs from "@/components/ListSortTabs";
import BrowseListBody from "@/components/BrowseListBody";
import { gradientStart } from "@/lib/gradient";
import { ANIME_GENRES } from "@/lib/genres";
import type { AnimeGenre } from "@/lib/genres";
import { genreListHref } from "@/lib/genre-list";
import type { BrowseFilter } from "@/lib/browse-filter";
import type { ListMediaType, ListSort } from "@/lib/list-sort";
import type { SeasonalEntry } from "@/lib/seasonal-anime";

interface GenreListViewProps {
  genre: AnimeGenre;
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

/**
 * ジャンルの一覧（#99）の画面。アニメ（/browse/genre/[id]）とアニメ映画
 * （/browse/movies/genre/[id]）で共用し、上のタブで相互に切り替える
 */
export default function GenreListView({
  genre,
  media,
  sort,
  filter,
  entries,
  fetchedCount,
  error,
  currentPage,
  totalPages,
  totalResults,
}: GenreListViewProps) {
  const back = BACK_LINKS[media];

  return (
    <div className="min-h-screen bg-[#141414]">
      <div
        className={`relative bg-gradient-to-b ${gradientStart(genre.color)} to-[#141414] pt-24 pb-12`}
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(ellipse at 30% 50%, white 0%, transparent 60%)`,
          }}
        />
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
          <div className="flex items-end gap-4">
            <span className="text-5xl md:text-6xl select-none">
              {genre.emoji}
            </span>
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">ジャンル</p>
              <h1 className="text-white text-3xl md:text-4xl font-black">
                {genre.name}
              </h1>
              {totalResults > 0 && (
                <p className="text-gray-400 text-sm mt-1">
                  {totalResults.toLocaleString()}件
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="site-container pb-20">
        <div className="mt-6">
          <MediaTypeTabs
            genreId={genre.id}
            current={media}
            sort={sort}
            filter={filter}
          />
        </div>

        {/* 他のジャンルへ（同じ種類・同じ並びのまま） */}
        <div className="flex gap-2 flex-wrap mb-8">
          {ANIME_GENRES.filter((g) => g.id !== genre.id).map((g) => (
            <Link
              key={g.id}
              href={genreListHref(media, g.id, sort)}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-full transition"
            >
              <span>{g.emoji}</span>
              {g.name}
            </Link>
          ))}
        </div>

        <ListSortTabs
          basePath={genreListHref(media, genre.id)}
          media={media}
          sort={sort}
          filter={filter}
        />

        <BrowseListBody
          basePath={genreListHref(media, genre.id)}
          filter={filter}
          showGenre={false}
          sort={sort}
          entries={entries}
          fetchedCount={fetchedCount}
          error={error}
          currentPage={currentPage}
          totalPages={totalPages}
        />
      </div>
    </div>
  );
}
