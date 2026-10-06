import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import GenreListView from "@/components/GenreListView";
import EraListView from "@/components/EraListView";
import { ANIME_GENRES } from "@/lib/genres";
import { ANIME_ERAS } from "@/lib/eras";
import type { ListMediaType, ListSort } from "@/lib/list-sort";
import type { BrowseFilter } from "@/lib/browse-filter";
import type { SeasonalEntry } from "@/lib/seasonal-anime";

/**
 * ジャンル・年代の一覧のヒーローは、定義の色から `#141414`（ページ背景）へ
 * 溶かす（#116 のレビュー）。
 *
 * 定義の色は `from-* via-* to-*` の 3 段。ヒーロー側で `to-[#141414]` を
 * 後ろに足しても、CSS では `.to-purple-950` が `.to-[#141414]` より後に
 * 出力されるため、クラスの並び順に関係なく定義側の `to-*` が勝つ。
 * ヒーローに載る `to-*` は `to-[#141414]` の 1 つだけであることを固定する。
 */

interface ListViewBaseProps {
  sort: ListSort;
  filter: BrowseFilter;
  entries: SeasonalEntry[];
  fetchedCount: number;
  error: string | null;
  currentPage: number;
  totalPages: number;
  totalResults: number;
}

const BASE: ListViewBaseProps = {
  sort: "year_desc",
  filter: { genreId: null, service: null },
  entries: [],
  fetchedCount: 0,
  error: null,
  currentPage: 1,
  totalPages: 1,
  totalResults: 0,
};

const MEDIA: ListMediaType[] = ["anime", "movie"];

/** ルート直下の最初の要素 = ヒーロー */
function heroClasses(ui: React.ReactElement): string[] {
  const { container } = render(ui);
  const hero = container.firstElementChild?.firstElementChild;
  const classes = (hero?.getAttribute("class") ?? "").split(/\s+/);
  cleanup();
  return classes;
}

function expectFadesToPage(classes: string[], label: string) {
  expect(classes, label).toContain("bg-gradient-to-b");
  expect(
    classes.filter((c) => c.startsWith("to-")),
    label,
  ).toEqual(["to-[#141414]"]);
  // 定義の色の始点は残す
  expect(
    classes.some((c) => c.startsWith("from-")),
    label,
  ).toBe(true);
}

describe("GenreListView のヒーロー", () => {
  it.each(MEDIA)("%s: 全ジャンルで終点は #141414 だけ", (media) => {
    for (const genre of ANIME_GENRES) {
      expectFadesToPage(
        heroClasses(<GenreListView {...BASE} genre={genre} media={media} />),
        genre.name,
      );
    }
  });
});

describe("EraListView のヒーロー", () => {
  it.each(MEDIA)("%s: 全年代で終点は #141414 だけ", (media) => {
    for (const era of ANIME_ERAS) {
      expectFadesToPage(
        heroClasses(<EraListView {...BASE} era={era} media={media} />),
        era.label,
      );
    }
  });
});
