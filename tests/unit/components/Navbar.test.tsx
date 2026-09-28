import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

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
  "アニメ",
  "映画",
  "放送中",
  "シーズン",
  "ジャンル",
  "年代",
  "声優",
  "キャラ",
  "診断",
];

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

  it("認証画面ではヘッダーごと表示しない", () => {
    pathname = "/login";
    const { container } = render(<Navbar />);

    expect(container).toBeEmptyDOMElement();
  });
});
