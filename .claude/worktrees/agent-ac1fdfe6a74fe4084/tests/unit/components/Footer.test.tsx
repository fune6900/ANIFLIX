import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Footer from "@/components/Footer";

/**
 * フッターの内容契約。
 *
 * `next/navigation` の `usePathname` をモックするのは、フッターが
 * 「認証画面では出さない」判定にだけ使っているため。ルーター本体は
 * 検証対象ではなく、Vitest 環境では App Router のコンテキストが無い。
 */

let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

/** 機能していなかった Netflix 模倣のプレースホルダー項目 */
const PLACEHOLDER_ITEMS = [
  "音声説明",
  "ヘルプセンター",
  "ギフトカード",
  "メディアセンター",
  "投資家向け情報",
  "採用情報",
  "利用規約",
  "プライバシー",
  "法的事項",
  "Cookie設定",
  "会社概要",
  "お問い合わせ",
  "サービスコード",
];

beforeEach(() => {
  pathname = "/";
});

afterEach(() => {
  cleanup();
});

describe("Footer", () => {
  it("プレースホルダーのメニュー項目を表示しない", () => {
    render(<Footer />);

    for (const item of PLACEHOLDER_ITEMS) {
      expect(screen.queryByText(item), item).not.toBeInTheDocument();
    }
  });

  it("リンク先が # のダミーリンクを持たない", () => {
    const { container } = render(<Footer />);

    expect(container.querySelectorAll('a[href="#"]')).toHaveLength(0);
  });

  it("コピーライトを表示する", () => {
    render(<Footer />);

    expect(screen.getByText(/ANIFLIX/)).toBeInTheDocument();
  });

  it("TMDb の帰属表示を出す", () => {
    // TMDb の利用規約が API 利用者に求めているもの
    render(<Footer />);

    expect(screen.getByText(/TMDB/i)).toBeInTheDocument();
    expect(screen.getByText(/承認|認証/)).toBeInTheDocument();
  });

  it("認証画面ではフッターごと表示しない", () => {
    pathname = "/login";
    const { container } = render(<Footer />);

    expect(container).toBeEmptyDOMElement();
  });

  it("認証エラー画面でも表示しない", () => {
    pathname = "/login/error";
    const { container } = render(<Footer />);

    expect(container).toBeEmptyDOMElement();
  });

  it("通常のページでは表示する", () => {
    pathname = "/browse/airing";
    const { container } = render(<Footer />);

    expect(container).not.toBeEmptyDOMElement();
  });
});
