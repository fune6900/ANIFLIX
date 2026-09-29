import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * 関連キャラクターの 1 ページあたりの件数（#78）: 24 → 30。
 * `@/lib/anilist` は自前の lib、`next/navigation` は例外 3 に従いモックする。
 */

const getAniListMediaCharacters = vi.fn(
  async (_mediaId: number, _page: number, _perPage: number) => ({
    edges: [],
    pageInfo: { lastPage: 1, total: 0 },
  }),
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
  getAniListMediaCharacters.mockClear();
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
});
