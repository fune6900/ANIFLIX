import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * `/browse/movies` はクエリが無いとアニメ映画のホーム（#90）を出す。
 * 検索画面へ飛ぶタブは、キーワードが空でも検索画面として開く URL を組むこと。
 * `next/navigation` をモックする理由は例外 3（ルーター本体は検証対象外）。
 */

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const MovieSearchModeTabs = (await import("@/components/MovieSearchModeTabs"))
  .default;
const SearchModeTabs = (await import("@/components/SearchModeTabs")).default;

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe("アニメ映画検索のタブ", () => {
  it("キーワード未入力でキーワード検索へ切り替えても検索画面に留まる", () => {
    render(
      <MovieSearchModeTabs
        currentMode="filter"
        query=""
        genreId=""
        sort="popularity.desc"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /キーワード検索/ }));

    expect(push).toHaveBeenCalledWith("/browse/movies?mode=keyword");
  });

  it("キーワードは引き継ぐ", () => {
    render(
      <MovieSearchModeTabs
        currentMode="filter"
        query="君の名は"
        genreId=""
        sort="popularity.desc"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /キーワード検索/ }));

    const url = new URL(String(push.mock.calls[0][0]), "http://localhost");
    expect(url.searchParams.get("q")).toBe("君の名は");
    expect(url.searchParams.get("mode")).toBe("keyword");
  });
});

describe("アニメ検索のタブ", () => {
  it("アニメ映画検索へはキーワード未入力でも検索画面として飛ぶ", () => {
    render(
      <SearchModeTabs
        currentMode="keyword"
        query=""
        genreId=""
        season=""
        sort="popularity.desc"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /アニメ映画検索/ }));

    expect(push).toHaveBeenCalledWith("/browse/movies?mode=keyword");
  });
});
