import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { AniListRelatedCharacterEdge } from "@/types/anilist";

interface CharactersPage {
  edges: AniListRelatedCharacterEdge[];
  pageInfo: { lastPage: number; total: number };
}

const EMPTY: CharactersPage = { edges: [], pageInfo: { lastPage: 1, total: 0 } };

/**
 * 関連キャラクターの 1 ページあたりの件数（#78）: 24 → 30。
 * `@/lib/anilist` は自前の lib、`next/navigation` は例外 3 に従いモックする。
 */

const getAniListMediaCharacters = vi.fn(
  async (
    _mediaId: number,
    _page: number,
    _perPage: number,
  ): Promise<CharactersPage> => EMPTY,
);

vi.mock("@/lib/anilist", () => ({
  searchAniListMedia: async () => [{ id: 77, popularity: 1 }],
  getAniListMediaCharacters: (mediaId: number, page: number, perPage: number) =>
    getAniListMediaCharacters(mediaId, page, perPage),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const { default: RelatedCharacters } = await import(
  "@/components/RelatedCharacters"
);

afterEach(() => {
  getAniListMediaCharacters.mockReset();
  getAniListMediaCharacters.mockImplementation(async () => EMPTY);
  cleanup();
});

describe("RelatedCharacters", () => {
  it("既定で 1 ページ 30 件を取る", async () => {
    await RelatedCharacters({
      title: "作品A",
      originalTitle: null,
      mediaType: "ANIME",
      pageUrl: (p: number) => `/anime/1?cpage=${p}`,
    });

    expect(getAniListMediaCharacters).toHaveBeenCalledWith(77, 1, 30);
  });

  it("列数はどの段でも 30 件を割り切る（最終行を欠けさせない）", async () => {
    const edge: AniListRelatedCharacterEdge = {
      role: "MAIN",
      node: {
        id: 1,
        name: { native: "キャラ", full: "Chara" },
        image: { large: "https://s4.anilist.co/c.jpg", medium: null },
      },
    };
    getAniListMediaCharacters.mockImplementation(async () => ({
      edges: [edge],
      pageInfo: { lastPage: 1, total: 1 },
    }));

    const { container } = render(
      await RelatedCharacters({
        title: "作品A",
        originalTitle: null,
        mediaType: "ANIME",
        pageUrl: (p: number) => `/anime/1?cpage=${p}`,
      }),
    );

    const grid = container.querySelector<HTMLElement>('[class*="grid-cols-"]');
    const counts = (grid?.className ?? "")
      .split(/\s+/)
      .map((c) => c.match(/(?:^|:)grid-cols-(\d+)$/)?.[1])
      .filter((n): n is string => Boolean(n))
      .map(Number);

    expect(counts.length).toBeGreaterThan(0);
    for (const n of counts) expect(30 % n, `${n} 列`).toBe(0);
  });
});

