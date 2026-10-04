import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import MediaTypeTabs from "@/components/MediaTypeTabs";
import ListSortTabs from "@/components/ListSortTabs";

/**
 * ジャンルの一覧（#99）の切り替え UI。どちらも JavaScript 無しで動くリンクで、
 * 状態は URL クエリに載る。
 */

afterEach(cleanup);

describe("MediaTypeTabs（アニメ ⇄ アニメ映画）", () => {
  it("同じジャンル ID のアニメ / アニメ映画の一覧へリンクし、表示中の側を示す", () => {
    render(<MediaTypeTabs genreId={9002} current="anime" sort="year_desc" />);

    const nav = screen.getByRole("navigation", { name: "作品の種類" });
    const anime = within(nav).getByRole("link", { name: "アニメ" });
    const movie = within(nav).getByRole("link", { name: "アニメ映画" });
    expect(anime.getAttribute("href")).toBe("/browse/genre/9002");
    expect(anime.getAttribute("aria-current")).toBe("page");
    expect(movie.getAttribute("href")).toBe("/browse/movies/genre/9002");
    expect(movie.hasAttribute("aria-current")).toBe(false);
  });

  it("並び替えを引き継ぐ", () => {
    render(<MediaTypeTabs genreId={35} current="movie" sort="year_asc" />);

    const nav = screen.getByRole("navigation", { name: "作品の種類" });
    expect(
      within(nav).getByRole("link", { name: "アニメ" }).getAttribute("href"),
    ).toBe("/browse/genre/35?sort=year_asc");
    expect(
      within(nav)
        .getByRole("link", { name: "アニメ映画" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});

describe("ListSortTabs（並び替え）", () => {
  it("TV は放送年、映画は公開年の新しい順 / 古い順を出し、現在の並びを示す", () => {
    render(
      <ListSortTabs
        basePath="/browse/genre/35"
        media="anime"
        sort="year_asc"
        filter={{ genreId: null, service: null }}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "並び替え" });
    const desc = within(nav).getByRole("link", { name: "放送年が新しい順" });
    const asc = within(nav).getByRole("link", { name: "放送年が古い順" });
    expect(desc.getAttribute("href")).toBe("/browse/genre/35");
    expect(asc.getAttribute("href")).toBe("/browse/genre/35?sort=year_asc");
    expect(asc.getAttribute("aria-current")).toBe("page");
    expect(desc.hasAttribute("aria-current")).toBe(false);
  });

  it("配信サービスの絞り込みを残す", () => {
    render(
      <ListSortTabs
        basePath="/browse/movies/genre/35"
        media="movie"
        sort="year_desc"
        filter={{ genreId: null, service: "netflix" }}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "並び替え" });
    expect(
      within(nav)
        .getByRole("link", { name: "公開年が古い順" })
        .getAttribute("href"),
    ).toBe("/browse/movies/genre/35?sort=year_asc&service=netflix");
  });
});
