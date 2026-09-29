import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import AnimeHeroTrailer from "@/components/AnimeHeroTrailer";

/**
 * アニメ詳細ページ上部の背景動画（#78）。
 *
 * 箱が `h-[55vw] max-h-[70vh]` で 16:9 と一致せず、iframe を cover で敷いていたため
 * 動画の上下が切れていた。箱を 16:9 にし、上限（70vh）が効いて横長になった分は
 * iframe を高さ基準で収め、余りを同じ画像のブラーで埋める（#74 と同じ手）。
 */

const PROPS = {
  trailerKey: "abc123",
  backdropUrl: "https://image.tmdb.org/t/p/original/b.jpg",
  title: "作品A",
};

afterEach(() => {
  cleanup();
});

function box(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement; // ルート要素は常に div
}

describe("AnimeHeroTrailer", () => {
  it("箱は 16:9（幅から決まる固定の vw 高さを使わない）", () => {
    const { container } = render(<AnimeHeroTrailer {...PROPS} />);

    const classes = box(container).className.split(/\s+/);
    expect(classes).toContain("aspect-video");
    expect(classes).not.toContain("h-[55vw]");
  });

  it("動画は cover で敷かず、箱の高さに合わせて収める", () => {
    render(<AnimeHeroTrailer {...PROPS} />);

    const iframe = screen.getByTitle("作品A トレーラー");
    // min-width/min-height 100% は「はみ出して切る」指定
    expect(iframe.style.minWidth).toBe("");
    expect(iframe.style.minHeight).toBe("");
    const classes = iframe.className.split(/\s+/);
    expect(classes).toContain("h-full");
    expect(classes).toContain("aspect-video");
    expect(classes).toContain("max-w-full");
  });

  it("余りは同じ画像のブラーで埋める（黒帯を作らない）", () => {
    const { container } = render(<AnimeHeroTrailer {...PROPS} />);

    const fill = container.querySelector<HTMLImageElement>(
      'img[aria-hidden="true"]',
    );
    expect(fill).not.toBeNull();
    expect(decodeURIComponent(fill?.getAttribute("src") ?? "")).toContain(
      "/b.jpg",
    );
    expect(fill?.className).toContain("blur-2xl");
    expect(fill?.className).toContain("object-cover");
  });

  it("前景の画像も切らずに収める", () => {
    render(<AnimeHeroTrailer {...PROPS} />);

    const visual = screen.getByAltText("作品A");
    expect(visual.className).toContain("object-contain");
    expect(visual.className).not.toContain("object-cover");
  });

  it("下端のグラデーションは下側だけ（動画全体を暗く沈めない）", () => {
    const { container } = render(<AnimeHeroTrailer {...PROPS} />);

    const bottomFades = [
      ...container.querySelectorAll<HTMLElement>('[class*="bg-gradient-to-t"]'),
    ];
    expect(bottomFades.length).toBeGreaterThan(0);
    for (const fade of bottomFades) {
      const classes = fade.className.split(/\s+/);
      expect(classes).not.toContain("inset-0");
      expect(classes).toContain("bottom-0");
    }
  });

  it("ミュート切り替えは維持", () => {
    render(<AnimeHeroTrailer {...PROPS} />);

    expect(
      screen.getByRole("button", { name: "ミュートを解除" }),
    ).toBeInTheDocument();
  });
});
