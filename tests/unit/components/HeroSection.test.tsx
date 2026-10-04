import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
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

const AUTOPLAY_MS = 6000;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function heading() {
  return screen.getByRole("heading", { level: 1 });
}

describe("HeroSection", () => {
  it("スライド内に ANIFLIX の文字を出さない", () => {
    // ロゴはヘッダーにある。スライドに重ねる意味がない
    render(<HeroSection items={ITEMS} />);

    expect(screen.queryByText("ANIFLIX")).not.toBeInTheDocument();
  });

  it("キービジュアルを object-cover で切らない（全スライド）", () => {
    render(<HeroSection items={ITEMS} />);

    for (const item of ITEMS) {
      const visual = screen.getByAltText(item.title);

      expect(visual.className).toContain("object-contain");
      expect(visual.className).not.toContain("object-cover");
    }
  });

  it("余る領域を同じ画像のブラーで埋める（黒帯を作らない）", () => {
    // 背面が単色だとウルトラワイドで左右が黒帯に戻る（#72 の再発）。
    // 各スライドの背面が「そのスライドの画像」を cover で敷いていることを固定する
    const { container } = render(<HeroSection items={ITEMS} />);

    const fills = [
      ...container.querySelectorAll<HTMLImageElement>(
        'img[aria-hidden="true"]',
      ),
    ];

    expect(fills).toHaveLength(ITEMS.length);
    ITEMS.forEach((item, i) => {
      const fill = fills[i];

      expect(decodeURIComponent(fill.getAttribute("src") ?? "")).toContain(
        item.backdropPath,
      );
      expect(fill.className).toContain("object-cover");
      expect(fill.className).toContain("blur-2xl");
    });
  });

  it("前景のキービジュアルは固定ヘッダーの下から始まる（#98）", () => {
    // ヘッダー（Navbar）は fixed top-0 で py-4 + ロゴ行。
    // mobile: 16 + 32(text-2xl の行高) + 16 = 64px / md 以上: 16 + 36(text-3xl) + 16 = 68px
    render(<HeroSection items={ITEMS} />);

    for (const item of ITEMS) {
      const layer = screen.getByAltText(item.title).parentElement;
      expect(layer).not.toBeNull();
      const classes = (layer?.className ?? "").split(/\s+/);

      expect(classes).not.toContain("inset-0");
      expect(classes).toContain("top-16");
      expect(classes).toContain("md:top-[68px]");
      expect(classes).toContain("bottom-0");
      expect(classes).toContain("inset-x-0");
    }
  });

  it("ブラーの塗りはヘッダーの裏まで全面に敷いたまま（#98）", () => {
    // 前景だけを下げる。塗りまで下げるとヘッダーの裏に黒帯が出る
    const { container } = render(<HeroSection items={ITEMS} />);

    for (const fill of container.querySelectorAll<HTMLImageElement>(
      'img[aria-hidden="true"]',
    )) {
      const classes = (fill.parentElement?.className ?? "").split(/\s+/);
      expect(classes).toContain("inset-0");
      expect(classes).not.toContain("top-16");
    }
  });

  it("文字ブロックの位置は前景の移動に引きずられない（#98）", () => {
    render(<HeroSection items={ITEMS} />);

    const classes = (heading().parentElement?.className ?? "").split(/\s+/);
    expect(classes).toContain("bottom-[24%]");
    expect(classes).toContain("md:bottom-[28%]");
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

  it("ドットを押すとそのスライドへ切り替わり、現在位置を示す", () => {
    render(<HeroSection items={ITEMS} />);
    const first = screen.getByRole("button", { name: "1 枚目のスライドへ" });
    const second = screen.getByRole("button", { name: "2 枚目のスライドへ" });
    expect(first).toHaveAttribute("aria-current", "true");

    fireEvent.click(second);

    expect(heading()).toHaveTextContent("作品B");
    expect(second).toHaveAttribute("aria-current", "true");
    expect(first).toHaveAttribute("aria-current", "false");
  });

  it("ドットは下の段に隠れない高さに置く", () => {
    // ホームでは直後の段が -mt-16 md:-mt-24（64 / 96px）でヒーローに重なる。
    // bottom-6（24px）だとドットがカード画像の下に潜り、見えず押せなかった
    render(<HeroSection items={ITEMS} />);

    const dots = screen.getByRole("button", {
      name: "1 枚目のスライドへ",
    }).parentElement;
    const classes = dots?.className.split(/\s+/) ?? [];

    expect(classes).not.toContain("bottom-6");
    expect(classes).toContain("bottom-[4.5rem]");
    expect(classes).toContain("md:bottom-[6.5rem]");
  });

  it("6 秒ごとに次のスライドへ自動で送る", () => {
    vi.useFakeTimers();
    render(<HeroSection items={ITEMS} />);

    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_MS - 1);
    });
    expect(heading()).toHaveTextContent("作品A");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(heading()).toHaveTextContent("作品B");

    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_MS);
    });
    expect(heading()).toHaveTextContent("作品A");
  });

  it("トレーラーを開いている間は自動送りを止め、閉じると再開する", () => {
    vi.useFakeTimers();
    const items = ITEMS.map((it) => ({ ...it, trailerKey: `key${it.id}` }));
    render(<HeroSection items={items} />);

    fireEvent.click(screen.getByRole("button", { name: /再生/ }));
    expect(document.querySelector("iframe")?.getAttribute("src")).toContain(
      "key1",
    );

    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_MS * 3);
    });
    expect(heading()).toHaveTextContent("作品A");

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(document.querySelector("iframe")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_MS);
    });
    expect(heading()).toHaveTextContent("作品B");
  });

  it("Escape でトレーラーを閉じる", () => {
    const items = ITEMS.map((it) => ({ ...it, trailerKey: `key${it.id}` }));
    render(<HeroSection items={items} />);
    fireEvent.click(screen.getByRole("button", { name: /再生/ }));
    expect(document.querySelector("iframe")).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(document.querySelector("iframe")).toBeNull();
  });

  it("スライドが 1 件なら切り替え UI を出さない", () => {
    render(<HeroSection items={[ITEMS[0]]} />);

    expect(
      screen.queryByRole("button", { name: "次のスライド" }),
    ).not.toBeInTheDocument();
  });
});
