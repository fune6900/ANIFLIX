import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import SearchResults from "@/components/SearchResults";
import { SEARCH_CATEGORIES, searchResultsHref } from "@/lib/search-results";

/**
 * 4 部門（アニメ / アニメ映画 / 声優 / キャラ）共通の検索結果画面（#101）。
 * 見出し・部門タブ・カードグリッド・ページ送りをこの 1 つで受け持つ。
 */

interface Item {
  id: number;
  name: string;
}

const ITEMS: Item[] = [
  { id: 1, name: "作品A" },
  { id: 2, name: "作品B" },
];

function renderResults(
  overrides: Partial<Parameters<typeof SearchResults<Item>>[0]> = {},
) {
  return render(
    <SearchResults<Item>
      category="anime"
      query="進撃"
      items={ITEMS}
      itemKey={(item) => item.id}
      renderItem={(item) => <a href={`/anime/${item.id}`}>{item.name}</a>}
      currentPage={1}
      totalPages={1}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("SearchResults", () => {
  it("見出しは「「キーワード」の検索結果」", () => {
    renderResults();

    expect(
      screen.getByRole("heading", { level: 1, name: "「進撃」の検索結果" }),
    ).toBeInTheDocument();
  });

  it("部門タブを 4 つ出し、キーワードを保ったまま部門を切り替える", () => {
    renderResults({ category: "movies" });

    const tabs = within(screen.getByRole("navigation", { name: "検索部門" }))
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));

    expect(tabs).toEqual(
      SEARCH_CATEGORIES.map((c) => searchResultsHref(c.slug, "進撃")),
    );
  });

  it("表示中の部門のタブに aria-current を付ける", () => {
    renderResults({ category: "voice-actors" });

    const nav = screen.getByRole("navigation", { name: "検索部門" });
    const current = within(nav)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page");

    expect(current).toHaveLength(1);
    expect(current[0].getAttribute("href")).toBe(
      searchResultsHref("voice-actors", "進撃"),
    );
  });

  it("カードをグリッドに並べる", () => {
    renderResults();

    const grid = screen.getByRole("list", { name: "検索結果" });
    expect(within(grid).getAllByRole("listitem")).toHaveLength(2);
    expect(within(grid).getByText("作品A")).toBeInTheDocument();
  });

  it("グリッドは 1920px 超で auto-fill に切り替える（ウルトラワイド対応）", () => {
    renderResults();

    const grid = screen.getByRole("list", { name: "検索結果" });
    expect(grid.className).toContain("3xl:grid-cols-[repeat(auto-fill,");
  });

  it("件数を出す", () => {
    renderResults({ totalResults: 1234 });

    expect(screen.getByText(/1,234件/)).toBeInTheDocument();
  });

  it("ページ送りはキーワードと部門を保ったまま page を変える", () => {
    renderResults({ currentPage: 2, totalPages: 5 });

    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toContain(searchResultsHref("anime", "進撃", 3));
    expect(hrefs).toContain(searchResultsHref("anime", "進撃", 1));
  });

  it("1 ページしか無ければページ送りを出さない", () => {
    renderResults({ totalPages: 1 });

    expect(screen.queryByText("次へ →")).toBeNull();
  });

  it("結果が 0 件なら見つからなかったと伝える", () => {
    renderResults({ items: [] });

    expect(
      screen.getByText("「進撃」に一致するアニメは見つかりませんでした"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "検索結果" })).toBeNull();
  });

  it("絞り込みでこのページが 0 件でも、続きのページがあればページ送りを出す", () => {
    // 声優は TMDb の 1 ページを日本の声優だけに絞るため、途中のページが空になり得る
    renderResults({ items: [], currentPage: 1, totalPages: 3 });

    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toContain(searchResultsHref("anime", "進撃", 2));
    expect(screen.queryByText(/見つかりませんでした/)).toBeNull();
    expect(screen.getByText(/このページには/)).toBeInTheDocument();
  });

  it("エラーがあれば 0 件表示ではなくエラーを出す", () => {
    renderResults({ items: [], error: "検索中にエラーが発生しました" });

    expect(
      screen.getByText("検索中にエラーが発生しました"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/見つかりませんでした/)).toBeNull();
  });

  it("キーワードが無ければヘッダーの検索へ誘導する（入力欄は置かない）", () => {
    renderResults({ query: "", items: [] });

    expect(screen.getByText(/ヘッダーの検索/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByText(/「」/)).toBeNull();
  });
});
