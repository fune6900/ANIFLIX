import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 詳細ページ（アニメ / 映画。どちらも AnimeHeroTrailer を使う）の本文とヒーローの重なり（#78）。
 *
 * 本文が `-mt-32 md:-mt-48`（128 / 192px）でヒーローに重なり、背景動画の下端が
 * 隠れていた。重なりはヒーロー下端のグラデーション（下 1/4）の中に収める。
 * ページ全体の描画は TMDb / AniList の取得が多く重いので、クラス指定を契約として固定する
 */

// vitest はリポジトリのルートで走る（jsdom 環境では import.meta.url が file: にならない）
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** 本文ラッパー（ヒーロー直後の relative -mt-*）のクラス */
function contentWrapperClasses(SOURCE: string): string[] {
  const m = SOURCE.match(/<AnimeHeroTrailer[\s\S]*?\/>\s*[\s\S]*?<div className="([^"]*relative[^"]*)"/);
  return (m?.[1] ?? "").split(/\s+/);
}

/** `-mt-N` / `md:-mt-N` の N（Tailwind の 1 = 4px） */
function overlapPx(classes: string[], prefix: string): number {
  const c = classes.find((x) => x.startsWith(`${prefix}-mt-`));
  return c ? Number(c.slice(`${prefix}-mt-`.length)) * 4 : 0;
}

describe.each([
  ["アニメ詳細", "src/app/anime/[id]/page.tsx"],
  ["映画詳細", "src/app/movie/[id]/page.tsx"],
])("%s: 本文とヒーローの重なり", (_name, path) => {
  const classes = contentWrapperClasses(source(path));

  it("本文ラッパーを特定できる", () => {
    expect(classes).toContain("relative");
  });

  it("モバイルは 32px 以下（16:9 の 375px 幅でヒーロー 211px、グラデーションは下 1/4 = 52px）", () => {
    expect(overlapPx(classes, "")).toBeLessThanOrEqual(32);
  });

  it("md 以上は 48px 以下（768px 幅でヒーロー 432px、グラデーションは下 1/4 = 108px）", () => {
    const md = overlapPx(classes, "md:") || overlapPx(classes, "");
    expect(md).toBeLessThanOrEqual(48);
  });
});
