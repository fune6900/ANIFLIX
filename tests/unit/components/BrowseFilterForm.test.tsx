import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import BrowseFilterForm from "@/components/BrowseFilterForm";
import { FILTER_GENRES } from "@/lib/browse-filter";
import { STREAMING_SERVICES } from "@/lib/providers";

/**
 * 一覧ページの共通フィルター UI（#77）。
 *
 * JavaScript 無しで動く GET フォーム。送信するとページ番号は付かないので 1 ページ目に戻る。
 * 年代ページの並び順（sort）や絞り込み語（q）のような既存のクエリは hidden で引き継ぐ。
 */

const NO_FILTER = { genreId: null, service: null };

afterEach(() => {
  cleanup();
});

describe("BrowseFilterForm", () => {
  it("現在のパスへ GET で送るフォーム", () => {
    render(<BrowseFilterForm action="/browse/new" filter={NO_FILTER} />);

    const form = screen.getByRole("search");
    expect(form.getAttribute("action")).toBe("/browse/new");
    expect(form.getAttribute("method")).toBe("get");
  });

  it("ジャンルの選択肢は「すべて」+ 判定できるジャンル", () => {
    render(<BrowseFilterForm action="/browse/new" filter={NO_FILTER} />);

    const select = screen.getByRole("combobox", { name: "ジャンル" });
    const options = within(select).getAllByRole("option");

    expect(select.getAttribute("name")).toBe("genre");
    expect(options[0]).toHaveValue("");
    expect(options.slice(1).map((o) => o.getAttribute("value"))).toEqual(
      FILTER_GENRES.map((g) => String(g.id)),
    );
  });

  it("配信サービスの選択肢は「すべて」+ 8 サービス", () => {
    render(<BrowseFilterForm action="/browse/new" filter={NO_FILTER} />);

    const select = screen.getByRole("combobox", { name: "配信サービス" });
    const options = within(select).getAllByRole("option");

    expect(select.getAttribute("name")).toBe("service");
    expect(options.slice(1).map((o) => o.getAttribute("value"))).toEqual(
      STREAMING_SERVICES.map((s) => s.slug),
    );
  });

  it("URL の値を選択済みにする", () => {
    render(
      <BrowseFilterForm
        action="/browse/new"
        filter={{ genreId: 35, service: "netflix" }}
      />,
    );

    expect(screen.getByRole("combobox", { name: "ジャンル" })).toHaveValue(
      "35",
    );
    expect(screen.getByRole("combobox", { name: "配信サービス" })).toHaveValue(
      "netflix",
    );
  });

  it("既存のクエリ（並び順など）を hidden で引き継ぎ、page は送らない", () => {
    const { container } = render(
      <BrowseFilterForm
        action="/browse/era/1990"
        filter={NO_FILTER}
        preserve={{ sort: "date", q: "ガンダム" }}
      />,
    );

    const hidden = [
      ...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]'),
    ].map((i) => [i.name, i.value]);

    expect(hidden).toEqual([
      ["sort", "date"],
      ["q", "ガンダム"],
    ]);
    expect(container.querySelector('[name="page"]')).toBeNull();
  });

  it("絞り込み中は、取得済みの件数と表示中の件数、解除リンクを出す", () => {
    render(
      <BrowseFilterForm
        action="/browse/era/1990"
        filter={{ genreId: 35, service: null }}
        preserve={{ sort: "date" }}
        fetchedCount={70}
        shownCount={12}
      />,
    );

    expect(screen.getByText(/70 件中 12 件/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "絞り込みを解除" }).getAttribute("href"),
    ).toBe("/browse/era/1990?sort=date");
  });

  it("絞り込んでいなければ件数も解除リンクも出さない", () => {
    render(
      <BrowseFilterForm
        action="/browse/new"
        filter={NO_FILTER}
        fetchedCount={70}
        shownCount={70}
      />,
    );

    expect(screen.queryByText(/件中/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "絞り込みを解除" }),
    ).not.toBeInTheDocument();
  });

  it("showGenre={false} ならジャンル選択を出さず、配信サービスは残す（#87）", () => {
    const { container } = render(
      <BrowseFilterForm
        action="/browse/genre/10751"
        filter={NO_FILTER}
        showGenre={false}
      />,
    );

    expect(
      screen.queryByRole("combobox", { name: "ジャンル" }),
    ).not.toBeInTheDocument();
    expect(container.querySelector('[name="genre"]')).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "配信サービス" }),
    ).toBeInTheDocument();
  });

  it("このページで取得した作品の中だけを絞ることを明示する", () => {
    render(<BrowseFilterForm action="/browse/new" filter={NO_FILTER} />);

    expect(screen.getByText(/このページの作品から/)).toBeInTheDocument();
  });
});
