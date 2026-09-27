import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * ウルトラワイド（2560px 超）でのレイアウト契約。
 *
 * ソースを読んで静的に検査する。列数やガターは CSS の適用結果にしか現れず
 * jsdom では測れないため、「どのクラスを使うか」の側を実行可能な契約として
 * 固定する。狙いは 2 つ:
 *
 * 1. `max-w-[1920px]` の再導入を弾く（1920px 超で左右に死んだ余白が出る）
 * 2. 横幅の定義を `globals.css` の `.site-container` 1 箇所に集約し続ける
 *    （32 箇所に散っていた梯子を直書きに戻させない）
 */

// vitest はリポジトリのルートで走る（jsdom 環境では import.meta.url が file: にならない）
const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** 旧来の固定上限。これが残っていると 1920px より広い画面が埋まらない */
const FIXED_CAP = "max-w-[1920px]";

/** 各ページが直書きしていた生のガター梯子 */
const RAW_GUTTER = "px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20";

function collectFiles(dir: string, ext: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(path, ext);
    return entry.name.endsWith(ext) ? [path] : [];
  });
}

const TSX_FILES = collectFiles(SRC, ".tsx").map((path) => ({
  path: path.slice(ROOT.length),
  source: readFileSync(path, "utf8"),
}));

const GLOBALS_CSS = readFileSync(join(SRC, "app", "globals.css"), "utf8");
const TAILWIND_CONFIG = readFileSync(join(ROOT, "tailwind.config.ts"), "utf8");

/** className に渡る文字列リテラル（改行を挟んでいても 1 つとして拾う） */
function classStrings(source: string): string[] {
  return [...source.matchAll(/"([^"]*)"|`([^`]*)`/g)].map(
    (match) => match[1] ?? match[2] ?? "",
  );
}

describe("ウルトラワイド用ブレークポイント", () => {
  it("tailwind に 3xl / 4xl / 5xl が揃っている", () => {
    expect(TAILWIND_CONFIG).toContain('"3xl": "1920px"');
    expect(TAILWIND_CONFIG).toContain('"4xl": "2560px"');
    expect(TAILWIND_CONFIG).toContain('"5xl": "3200px"');
  });
});

describe(".site-container", () => {
  it("globals.css で定義されている", () => {
    expect(GLOBALS_CSS).toMatch(/\.site-container\s*\{/);
  });

  it("横幅の上限を持たない", () => {
    // 上限を付けた瞬間にウルトラワイドの左右へ死んだ余白が戻る
    const block = GLOBALS_CSS.match(/\.site-container\s*\{[^}]*\}/)?.[0] ?? "";

    expect(block).not.toContain("max-w-");
  });

  it("2560px / 3200px 用のガターを持つ", () => {
    const block = GLOBALS_CSS.match(/\.site-container\s*\{[^}]*\}/)?.[0] ?? "";

    expect(block).toContain("4xl:px-");
    expect(block).toContain("5xl:px-");
  });
});

describe("固定上限の排除", () => {
  it("どの tsx にも max-w-[1920px] が残っていない", () => {
    const offenders = TSX_FILES.filter((file) =>
      file.source.includes(FIXED_CAP),
    ).map((file) => file.path);

    expect(offenders).toEqual([]);
  });

  it("どの tsx も生のガター梯子を直書きしていない", () => {
    const offenders = TSX_FILES.filter((file) =>
      file.source.includes(RAW_GUTTER),
    ).map((file) => file.path);

    expect(offenders).toEqual([]);
  });
});

describe("グリッドの列数", () => {
  it("lg 以降まで列を刻むグリッドは 1920px 超の段も持つ", () => {
    // 2xl:grid-cols-5 で頭打ちのままだと、3440px ではカード 1 枚が 2 倍近くに膨らむ。
    // 列数指定（grid-cols-5）だけでなく、任意値のトラック（grid-cols-[320px_1fr]）も
    // 対象にする。`1fr` は上限が無く、上限撤去後は画面幅なりに伸び続ける
    const offenders: string[] = [];

    for (const file of TSX_FILES) {
      for (const classes of classStrings(file.source)) {
        const laddersUp = /(?:lg|xl|2xl):grid-cols-[\d[]/.test(classes);
        // 段は 3xl（= 伸び始める位置）から置く。4xl だけ残す形は
        // 1921〜2559px が無防備になり、2560px で列幅が逆に縮む
        const hasUltrawide = classes.includes("3xl:grid-cols-");
        if (laddersUp && !hasUltrawide) {
          offenders.push(`${file.path}: ${classes.slice(0, 80)}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
