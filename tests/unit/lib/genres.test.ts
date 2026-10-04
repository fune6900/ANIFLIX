import { describe, it, expect } from "vitest";
import { ANIME_GENRES, findGenre, genreKeywordIds } from "@/lib/genres";

/**
 * キーワード由来のジャンルは TMDb のキーワード ID を固定値で持つ（#99）。
 *
 * 名前で検索して先頭ヒットを使う方式は、先頭に別物が来ると静かに 0 件になる
 * （2026-10-04 実測: "mecha" の先頭は 0 件の「mecha!」(384065)、"horror" の先頭は
 * 0 件の「b-horror」(342626)）。
 */

function genre(id: number) {
  const g = findGenre(id);
  if (!g) throw new Error(`unknown genre ${id}`);
  return g;
}

const keywordGenres = ANIME_GENRES.filter((g) => g.filterType === "keyword");

describe("genreKeywordIds", () => {
  it("キーワード由来のジャンルはすべて 1 件以上の ID を持ち、重複しない", () => {
    expect(keywordGenres).toHaveLength(10);
    for (const g of keywordGenres) {
      const ids = genreKeywordIds(g);
      expect(ids.length, g.name).toBeGreaterThan(0);
      expect(new Set(ids).size, g.name).toBe(ids.length);
      for (const id of ids) expect(Number.isInteger(id) && id > 0).toBe(true);
    }
  });

  it("TMDb ジャンルのジャンルは空", () => {
    expect(genreKeywordIds(genre(35))).toEqual([]);
  });

  it.each([
    ["メカ・ロボット", 9002, 10046, 384065],
    ["ホラー", 9005, 315058, 342626],
  ])(
    "%s は実際に作品の付いたキーワード（%i → %i）を使い、名前検索の先頭ヒット（%i）は使わない",
    (_name, genreId, wanted, wrongFirstHit) => {
      const ids = genreKeywordIds(genre(genreId));
      expect(ids).toContain(wanted);
      expect(ids).not.toContain(wrongFirstHit);
    },
  );

  it.each([
    ["異世界転生", 9001, [237451, 213756, 227624, 33465]],
    ["メカ・ロボット", 9002, [10046, 10891]],
    ["スポーツ", 9004, [6075, 1480, 6496, 5605, 13042, 1488]],
    ["日常", 9006, [9914, 291483]],
    ["歴史・時代劇", 9008, [15126, 190446, 194424, 230462]],
    ["アイドル", 9009, [287664, 251523]],
    ["料理・グルメ", 9010, [1918, 209125]],
  ])("%s は同義のキーワードも含める", (_name, genreId, ids) => {
    expect(genreKeywordIds(genre(genreId))).toEqual(
      expect.arrayContaining(ids),
    );
  });
});
