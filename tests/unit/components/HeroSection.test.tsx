import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import HeroSection from "@/components/HeroSection";
import type { HeroItem } from "@/components/HeroSection";

/**
 * トップのカルーセルの契約。
 *
 * キービジュアルは 16:9 の backdrop なので、箱の縦横比が合わないまま
 * `object-cover` を使うと上下が切れる。「全部表示する」が要件なので、
 * 前景は切らずに収め、余る領域は同じ画像のブラーで埋める。
 */

const ITEMS: HeroItem[] = [
  {
    id: 1,
    title: "作品A",
    overview: "あらすじA",
    backdropPath: "/a.jpg",
    year: "2026",
    href: "/anime/1",
  },
  {
    id: 2,
    title: "作品B",
    overview: "あらすじB",
    backdropPath: "/b.jpg",
    year: "2025",
    href: "/anime/2",
  },
];

afterEach(() => {
  cleanup();
});

describe("HeroSection", () => {
  it("スライド内に ANIFLIX の文字を出さない", () => {
    // ロゴはヘッダーにある。スライドに重ねる意味がない
    render(<HeroSection items={ITEMS} />);

    expect(screen.queryByText("ANIFLIX")).not.toBeInTheDocument();
  });

  it("キービジュアルを object-cover で切らない", () => {
    render(<HeroSection items={ITEMS} />);

    const visual = screen.getByAltText("作品A");

    expect(visual.className).toContain("object-contain");
    expect(visual.className).not.toContain("object-cover");
  });

  it("余る領域を同じ画像のブラーで埋める（黒帯を作らない）", () => {
    const { container } = render(<HeroSection items={ITEMS} />);

    const fills = container.querySelectorAll(
      '[aria-hidden="true"][class*="blur"]',
    );

    expect(fills.length).toBeGreaterThan(0);
  });

  it("左右の切り替えボタンに名前が付いている", () => {
    render(<HeroSection items={ITEMS} />);

    expect(
      screen.getByRole("button", { name: "前のスライド" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "次のスライド" }),
    ).toBeInTheDocument();
  });

  it("切り替えボタンは常に見えている（ホバーしないと消えない）", () => {
    // opacity-0 のままだと利用者はボタンの存在に気付けない
    render(<HeroSection items={ITEMS} />);

    const next = screen.getByRole("button", { name: "次のスライド" });

    expect(next.className).not.toContain("opacity-0");
  });

  it("lg 未満では切り替えボタンを縦中央に置かない（タイトル・あらすじに被る）", () => {
    // 375px / 768px では本文ブロックが縦中央まで伸びており、中央の矢印が
    // タイトルの先頭・末尾の文字を隠していた。lg 未満は CTA 行の高さに下ろす
    render(<HeroSection items={ITEMS} />);

    for (const name of ["前のスライド", "次のスライド"]) {
      const classes = screen
        .getByRole("button", { name })
        .className.split(/\s+/);

      expect(classes).not.toContain("top-1/2");
      expect(classes).toContain("lg:top-1/2");
    }
  });

  it("次のスライドへ切り替えられる", () => {
    render(<HeroSection items={ITEMS} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "作品A",
    );

    fireEvent.click(screen.getByRole("button", { name: "次のスライド" }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "作品B",
    );
  });

  it("前のスライドへ戻ると末尾へ回る", () => {
    render(<HeroSection items={ITEMS} />);

    fireEvent.click(screen.getByRole("button", { name: "前のスライド" }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "作品B",
    );
  });

  it("スライドを直接選ぶドットを名前付きで並べる", () => {
    render(<HeroSection items={ITEMS} />);

    expect(
      screen.getByRole("button", { name: "2 枚目のスライドへ" }),
    ).toBeInTheDocument();
  });

  it("スライドが 1 件なら切り替え UI を出さない", () => {
    render(<HeroSection items={[ITEMS[0]]} />);

    expect(
      screen.queryByRole("button", { name: "次のスライド" }),
    ).not.toBeInTheDocument();
  });
});
