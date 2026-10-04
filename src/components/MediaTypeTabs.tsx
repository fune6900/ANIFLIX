import Link from "next/link";
import { genreListHref } from "@/lib/genre-list";
import { eraListHref } from "@/lib/era-list";
import { withFilter } from "@/lib/browse-filter";
import type { BrowseFilter } from "@/lib/browse-filter";
import type { ListMediaType, ListSort } from "@/lib/list-sort";

interface MediaTypeTabsBaseProps {
  /** 表示中の一覧 */
  current: ListMediaType;
  /** 切り替え先にも引き継ぐ並び替え */
  sort: ListSort;
  /**
   * 切り替え先にも引き継ぐ絞り込み（選択肢はアニメ・映画で共通）。
   * ジャンルの一覧は配信サービスだけ、年代の一覧はジャンルと配信サービスを持つ
   */
  filter: BrowseFilter;
}

/** ジャンルの一覧（#99）: 同じジャンル ID の一覧どうしを切り替える */
interface GenreMediaTypeTabsProps extends MediaTypeTabsBaseProps {
  genreId: number;
  decade?: never;
}

/** 年代の一覧（#100）: 同じ年代の一覧どうしを切り替える */
interface EraMediaTypeTabsProps extends MediaTypeTabsBaseProps {
  decade: number;
  genreId?: never;
}

type MediaTypeTabsProps = GenreMediaTypeTabsProps | EraMediaTypeTabsProps;

const TABS: ReadonlyArray<{ media: ListMediaType; label: string }> = [
  { media: "anime", label: "アニメ" },
  { media: "movie", label: "アニメ映画" },
];

/**
 * 一覧のアニメ ⇄ アニメ映画の切り替え（ジャンル #99 / 年代 #100）。
 * 同じジャンル ID / 年代の一覧へのリンクで、並び替えと絞り込みを引き継ぐ
 * （並び替えのリンクと揃える）。ページ番号は件数が違うので引き継がない
 */
export default function MediaTypeTabs(props: MediaTypeTabsProps) {
  const { current, sort, filter } = props;
  const hrefFor = (media: ListMediaType): string =>
    props.decade !== undefined
      ? eraListHref(media, props.decade, sort)
      : genreListHref(media, props.genreId, sort);

  return (
    <nav
      aria-label="作品の種類"
      className="flex gap-1 mb-6 border-b border-gray-800"
    >
      {TABS.map(({ media, label }) => {
        const active = media === current;
        return (
          <Link
            key={media}
            href={withFilter(hrefFor(media), filter)}
            aria-current={active ? "page" : undefined}
            className={`px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 transition ${
              active
                ? "border-[#E50914] text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
