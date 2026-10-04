import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * ヘッダーの内容契約。
 *
 * `next/navigation` をモックする理由は `Footer.test.tsx` と同じ
 * （「認証画面では出さない」判定にだけ使っており、ルーター本体は検証対象外）。
 *
 * `@/app/actions/auth` は Server Action で、辿ると `@/auth` = next-auth 本体に
 * 届く。Vitest 環境では解決できず、ログアウトの配線自体は
 * `tests/unit/app/actions/auth.test.ts` が受け持っている。
 */

let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("@/app/actions/auth", () => ({
  signOutAction: vi.fn(),
}));

const Navbar = (await import("@/components/Navbar")).default;

/** ヘッダーに必ず並ぶナビゲーション項目 */
const NAV_ITEMS = [
  "ホーム",
  "アニメ映画",
  "放送中",
  "シーズン",
  "ジャンル",
  "年代",
  "声優",
  "キャラ",
  "診断",
];

/**
 * ナビゲーションの遷移先と並び順。PC ナビとモバイルメニューで同じ並びにする。
 * 文言ではなく遷移先で照合する（表示名の変更に引きずられないため）
 */
const NAV_HREFS = [
  "/",
  "/browse/movies",
  "/browse/airing",
  "/browse/seasons",
  "/browse/genres",
  "/browse/eras",
  "/voice-actors",
  "/characters",
  "/diagnosis",
];

/** 「アニメ」= キーワード検索への近道。ナビからは外した（ISSUE #88） */
const REMOVED_ANIME_HREF = `/search?q=${encodeURIComponent("アニメ")}`;

function hrefsOf(root: Element): string[] {
  return Array.from(root.querySelectorAll("a")).map(
    (a) => a.getAttribute("href") ?? "",
  );
}

function isAnimeSearchHref(href: string): boolean {
  return href === REMOVED_ANIME_HREF || href === "/search?q=アニメ";
}

function openMobileMenu(): Element {
  const toggle = screen.getByRole("button", { name: "ブラウズ" });
  fireEvent.click(toggle);
  const menu = toggle.parentElement;
  if (!menu) throw new Error("モバイルメニューの親要素が無い");
  return menu;
}

beforeEach(() => {
  pathname = "/";
});

afterEach(() => {
  cleanup();
});

describe("Navbar", () => {
  it("押しても何も起きない通知ボタンを置かない", () => {
    // Netflix 模倣のプレースホルダー。遷移先も onClick も無い飾りだった
    render(<Navbar />);

    expect(screen.queryByLabelText("通知")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "通知" }),
    ).not.toBeInTheDocument();
  });

  it("検索とログアウトは残す", () => {
    render(<Navbar />);

    expect(screen.getByLabelText("検索を開く")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ログアウト" }),
    ).toBeInTheDocument();
  });

  it("主要なナビゲーション項目を表示する", () => {
    render(<Navbar />);

    for (const item of NAV_ITEMS) {
      expect(screen.getAllByText(item).length, item).toBeGreaterThan(0);
    }
  });

  it("PC のナビに「アニメ」を置かず、他の項目の並びは保つ", () => {
    render(<Navbar />);

    const nav = screen.getByRole("navigation");
    const hrefs = hrefsOf(nav);

    expect(hrefs.some(isAnimeSearchHref)).toBe(false);
    expect(hrefs).toEqual(NAV_HREFS);
  });

  it("モバイルメニューに「アニメ」を置かず、他の項目の並びは保つ", () => {
    render(<Navbar />);

    const hrefs = hrefsOf(openMobileMenu());

    expect(hrefs.some(isAnimeSearchHref)).toBe(false);
    expect(hrefs).toEqual(NAV_HREFS);
  });

  it("ヘッダーのどこにも「アニメ」のリンクを出さない", () => {
    render(<Navbar />);
    openMobileMenu();

    expect(screen.queryAllByRole("link", { name: "アニメ" })).toHaveLength(0);
  });

  it("映画の項目は「アニメ映画」と呼ぶ（PC・モバイルとも）", () => {
    // アニメ映画専用の画面（#90）。「映画」だと実写も扱うように読める
    render(<Navbar />);
    openMobileMenu();

    const links = screen.getAllByRole("link", { name: "アニメ映画" });
    expect(links).toHaveLength(2);
    for (const a of links) {
      expect(a).toHaveAttribute("href", "/browse/movies");
    }
    expect(screen.queryByText("映画")).not.toBeInTheDocument();
  });

  it("認証画面ではヘッダーごと表示しない", () => {
    pathname = "/login";
    const { container } = render(<Navbar />);

    expect(container).toBeEmptyDOMElement();
  });
});
