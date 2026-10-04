import Link from "next/link";
import { genreListHref } from "@/lib/genre-list";
import type { ListMediaType, ListSort } from "@/lib/list-sort";

interface MediaTypeTabsProps {
  genreId: number;
  /** 表示中の一覧 */
  current: ListMediaType;
  /** 切り替え先にも引き継ぐ並び替え */
  sort: ListSort;
}

const TABS: ReadonlyArray<{ media: ListMediaType; label: string }> = [
  { media: "anime", label: "アニメ" },
  { media: "movie", label: "アニメ映画" },
];

/**
 * ジャンルの一覧のアニメ ⇄ アニメ映画の切り替え（#99）。
 * 同じジャンル ID の一覧へのリンクで、並び替えだけを引き継ぐ
 * （ページ番号は件数が違うので引き継がない。配信の絞り込みはページ内の作品にしか効かない）
 */
export default function MediaTypeTabs({
  genreId,
  current,
  sort,
}: MediaTypeTabsProps) {
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
            href={genreListHref(media, genreId, sort)}
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
