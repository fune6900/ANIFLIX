import { describe, it, expect } from "vitest";
import { ANIME_STUDIOS, findStudio } from "@/lib/studios";
import tailwindConfig from "../../../tailwind.config";

/**
 * 制作会社の定義（#116）。
 *
 * TMDb の company id は名前検索の先頭ヒットが別会社・子会社であることが多い
 * （"Trigger" の先頭は 0 件の 265915、"Shaft" には同名の空エントリ 274368 がある）。
 * 2026-10-07 に `/discover/tv?with_companies=ID&with_genres=16&with_origin_country=JP`
 * の件数で実在を確かめた id を固定する。
 *
 * #116 以前の定義は 12 社中 11 社が別会社の id を指しており（2452 = UK Film Council、
 * 122822 = Fountain Film Company など）、スタジオ別一覧は静かに 0 件になっていた。
 */

const VERIFIED: ReadonlyArray<readonly [string, number]> = [
  ["スタジオジブリ", 10342],
  ["東映アニメーション", 5542],
  ["Production I.G", 529],
  ["MADHOUSE", 3464],
  ["京都アニメーション", 5438],
  ["A-1 Pictures", 13113],
  ["サンライズ", 3153],
  ["WIT STUDIO", 31058],
  ["MAPPA", 21444],
  ["ボンズ", 2849],
  ["ufotable", 5887],
  ["TMS Entertainment", 7164],
  ["CloverWorks", 121589],
  ["シャフト", 6689],
  ["TRIGGER", 50908],
  ["P.A.WORKS", 20867],
  ["サイエンスSARU", 99494],
  ["STUDIO 4℃", 10868],
  ["J.C.STAFF", 11884],
  ["動画工房", 41996],
  ["Lerche", 42811],
  ["david production", 45188],
  ["シンエイ動画", 5141],
  ["ぴえろ", 3234],
  ["OLM", 5372],
  ["コミックス・ウェーブ・フィルム", 3756],
];

/** #116 以前に定義されていた、アニメと無関係な会社の id */
const WRONG_IDS = [
  2452, 2505, 7378, 10048, 6594, 2881, 76043, 122822, 37301, 44820, 858,
];

const GRADIENT = /^from-[a-z]+-\d{3} via-[a-z]+-\d{3} to-[a-z]+-\d{3}$/;

describe("ANIME_STUDIOS", () => {
  it("実測で確かめた 26 社を、この順で持つ", () => {
    expect(ANIME_STUDIOS.map((s) => [s.name, s.id])).toEqual(VERIFIED);
  });

  it("アニメと無関係な会社の id を持たない", () => {
    const ids = ANIME_STUDIOS.map((s) => s.id);
    for (const wrong of WRONG_IDS)
      expect(ids, String(wrong)).not.toContain(wrong);
  });

  it("id と名前は重複しない", () => {
    const ids = ANIME_STUDIOS.map((s) => s.id);
    const names = ANIME_STUDIOS.map((s) => s.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("全社が正の整数 id と空でない名前・絵文字・代表作を持つ", () => {
    for (const s of ANIME_STUDIOS) {
      expect(Number.isInteger(s.id) && s.id > 0, s.name).toBe(true);
      expect(s.name.trim(), String(s.id)).not.toBe("");
      expect(s.emoji.trim(), s.name).not.toBe("");
      expect(s.description.trim(), s.name).not.toBe("");
    }
  });

  it("代表作は読点区切りで 2 作", () => {
    for (const s of ANIME_STUDIOS) {
      expect(s.description.split("、"), s.name).toHaveLength(2);
    }
  });

  it("全社がジャンル・年代と同じ形のグラデーション色を持ち、色は重複しない", () => {
    for (const s of ANIME_STUDIOS) {
      expect(s.color, s.name).toMatch(GRADIENT);
    }
    const colors = ANIME_STUDIOS.map((s) => s.color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe("findStudio", () => {
  it("id から定義を引く", () => {
    expect(findStudio(21444)?.name).toBe("MAPPA");
  });

  it("未定義の id は undefined", () => {
    expect(findStudio(122822)).toBeUndefined();
  });
});

describe("Tailwind の走査対象", () => {
  it("src/lib を含む（定義ファイルに書いた色クラスが CSS に出力されるように）", () => {
    // Config["content"] は配列 or オブジェクト。このリポジトリは配列で書いている
    const content = tailwindConfig.content;
    const globs = Array.isArray(content) ? content : content.files;
    expect(
      globs.some((g) => typeof g === "string" && g.startsWith("./src/lib/")),
    ).toBe(true);
  });
});
