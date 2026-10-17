import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 詳細ページ（アニメ / 映画。どちらも AnimeHeroTrailer を使う）の本文とヒーローの重なり（#78）。
 *
 * 本文が `-mt-32 md:-mt-48`（128 / 192px）でヒーローに重なり、背景動画の下端が
 * 隠れていた。本文はヒーローの下から始める。
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

/** 負のマージン（どのブレークポイントでも）= ヒーローに重ねる指定 */
function negativeMargins(classes: string[]): string[] {
  return classes.filter((c) => /(^|:)-mt-/.test(c));
}

describe.each([
  ["アニメ詳細", "src/app/anime/[id]/page.tsx"],
  ["映画詳細", "src/app/movie/[id]/page.tsx"],
])("%s: 本文とヒーローの重なり", (_name, path) => {
  const classes = contentWrapperClasses(source(path));

  it("本文ラッパーを特定できる", () => {
    expect(classes).toContain("relative");
  });

  it("本文をヒーローに重ねない（lg 以上も含めて）", () => {
    // 重ねると不透明のポスターと本文が動画の下端を隠す
    expect(negativeMargins(classes)).toEqual([]);
  });
});
