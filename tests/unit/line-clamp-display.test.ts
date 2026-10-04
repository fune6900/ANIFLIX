import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * `line-clamp-*` の契約（#114）。
 *
 * Tailwind の `line-clamp-N` は `display: -webkit-box` に依存する。同じ要素に
 * `sm:block` のような display 指定が載ると、そのブレークポイントから
 * `-webkit-box` が上書きされ、行数制限が無言で外れる。
 * jsdom にはレイアウトが無いので、ソースのクラス文字列を静的に検査する。
 * 表示の出し分けが必要なら、line-clamp を持つ要素を包むラッパー側で行う。
 */

// vitest はリポジトリのルートで走る（jsdom 環境では import.meta.url が file: にならない）
const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** display を -webkit-box 以外に決める Tailwind ユーティリティ（バリアント付きも含む） */
const DISPLAY_UTILITY =
  /^(?:[\w-]+:)*(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|table|contents|flow-root)$/;

function collectFiles(dir: string, ext: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(path, ext);
    return entry.name.endsWith(ext) ? [path] : [];
  });
}

/** クラス属性・テンプレートリテラルを問わず、line-clamp を含む文字列リテラルを拾う */
function clampClassStrings(source: string): string[] {
  const literals = source.match(/"[^"\n]*"|`[^`]*`|'[^'\n]*'/g) ?? [];
  return literals.filter((lit) => /\bline-clamp-(?:\d+|\[)/.test(lit));
}

const TSX_FILES = collectFiles(SRC, ".tsx").map((path) => ({
  path: path.slice(ROOT.length),
  source: readFileSync(path, "utf8"),
}));

describe("line-clamp と display 指定の同居禁止", () => {
  it("line-clamp を使う箇所が検査対象に含まれている", () => {
    // 走査が空振りしていないことの確認（ゼロ件なら下のテストは何も守らない）
    const total = TSX_FILES.flatMap((f) => clampClassStrings(f.source));
    expect(total.length).toBeGreaterThan(0);
  });

  it.each(TSX_FILES.map((f) => [f.path, f.source] as const))(
    "%s: line-clamp-* と同じ要素に display ユーティリティを載せない",
    (_path, source) => {
      const offenders = clampClassStrings(source).filter((lit) =>
        lit
          .slice(1, -1)
          .split(/\s+/)
          .some((cls) => DISPLAY_UTILITY.test(cls)),
      );
      expect(offenders).toEqual([]);
    },
  );
});
