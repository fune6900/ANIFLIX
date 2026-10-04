import { describe, it, expect } from "vitest";
import {
  ANIME_FRANCHISES,
  findFranchise,
  matchesFranchiseTitle,
} from "@/lib/franchises";

/**
 * 定番シリーズの定義（#102）。`/characters`（#104）でも同じ定義を使う。
 */

describe("ANIME_FRANCHISES", () => {
  it("slug は URL に載るので一意かつ kebab-case", () => {
    const slugs = ANIME_FRANCHISES.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("findFranchise は定義に無い slug で null", () => {
    expect(findFranchise("pokemon")?.name).toBe("ポケモン");
    expect(findFranchise("naruto")).toBeNull();
    expect(findFranchise("")).toBeNull();
  });
});

describe("matchesFranchiseTitle", () => {
  const pokemon = findFranchise("pokemon");
  const onePiece = findFranchise("one-piece");

  it("いずれかのタイトルが検索語を含む作品だけを残す（AniList の曖昧検索の混入を落とす）", () => {
    if (!pokemon || !onePiece) throw new Error("franchise missing");

    expect(
      matchesFranchiseTitle(pokemon, {
        native: "ポケットモンスター サン＆ムーン",
        romaji: null,
        english: null,
      }),
    ).toBe(true);
    expect(
      matchesFranchiseTitle(pokemon, {
        native: "デジモンアドベンチャー",
        romaji: "Digimon Adventure",
        english: null,
      }),
    ).toBe(false);
    // 英字は大文字小文字を区別しない
    expect(
      matchesFranchiseTitle(onePiece, {
        native: null,
        romaji: "One Piece",
        english: null,
      }),
    ).toBe(true);
  });
});
