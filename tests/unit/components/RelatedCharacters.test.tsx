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

/** 実在するページ数と件数（AniList の申告とは別に数えたもの） */
const getAniListMediaCharacterCount = vi.fn(
  async (
    _mediaId: number,
    _perPage: number,
  ): Promise<{ lastPage: number; total: number }> => ({
    lastPage: 0,
    total: 0,
  }),
);

vi.mock("@/lib/anilist", () => ({
  searchAniListMedia: async () => [{ id: 77, popularity: 1 }],
  getAniListMediaCharacters: (mediaId: number, page: number, perPage: number) =>
    getAniListMediaCharacters(mediaId, page, perPage),
  getAniListMediaCharacterCount: (mediaId: number, perPage: number) =>
    getAniListMediaCharacterCount(mediaId, perPage),
}));

const redirect = vi.fn((url: string) => {
  // 実物の redirect は NEXT_REDIRECT を throw して描画を打ち切る
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

const { default: RelatedCharacters } = await import(
  "@/components/RelatedCharacters"
);

afterEach(() => {
  getAniListMediaCharacterCount.mockReset();
  redirect.mockClear();
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
    getAniListMediaCharacterCount.mockResolvedValue({ lastPage: 1, total: 1 });

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

  describe("ページ数は実在するページだけ（#86）", () => {
    /** 30 件ぶんのキャラ（id は 1 から） */
    function fullPage(): AniListRelatedCharacterEdge[] {
      return Array.from({ length: 30 }, (_, i) => ({
        role: "SUPPORTING",
        node: {
          id: i + 1,
          name: { native: `キャラ${i + 1}`, full: null },
          image: { large: null, medium: null },
        },
      }));
    }

    /** AniList が実態と違う pageInfo を申告する（実測: 500 件・20 ページ / 実際 100 件・4 ページ） */
    function lyingAniList() {
      getAniListMediaCharacters.mockImplementation(async () => ({
        edges: fullPage(),
        pageInfo: { lastPage: 20, total: 500 },
      }));
    }

    async function renderAt(page: number) {
      return render(
        await RelatedCharacters({
          title: "作品A",
          originalTitle: null,
          mediaType: "ANIME",
          currentPage: page,
          pageUrl: (p: number) => `/anime/1?cpage=${p}`,
        }),
      );
    }

    function pageNumbersLinked(container: HTMLElement): number[] {
      return [...container.querySelectorAll<HTMLAnchorElement>("a[href]")]
        .map((a) => a.getAttribute("href")?.match(/cpage=(\d+)/)?.[1])
        .filter((n): n is string => Boolean(n))
        .map(Number);
    }

    it("申告ではなく実在するページ数でページ送りを出し、件数も実数を出す", async () => {
      lyingAniList();
      getAniListMediaCharacterCount.mockResolvedValue({
        lastPage: 4,
        total: 100,
      });

      const { container } = await renderAt(1);

      expect(Math.max(...pageNumbersLinked(container))).toBe(4);
      expect(container.textContent).toContain("100件");
      expect(container.textContent).toContain("1 / 4 ページ");
      expect(container.textContent).not.toContain("500件");
      expect(getAniListMediaCharacterCount).toHaveBeenCalledWith(77, 30);
    });

    it("実在しないページを開いたら実在する最終ページへ寄せる", async () => {
      lyingAniList();
      getAniListMediaCharacterCount.mockResolvedValue({
        lastPage: 4,
        total: 100,
      });

      await expect(renderAt(6)).rejects.toThrow("NEXT_REDIRECT");
      expect(redirect).toHaveBeenCalledWith("/anime/1?cpage=4");
    });

    it("数えるのに失敗しても申告値は使わず、次のページがあるかだけで出す", async () => {
      lyingAniList();
      getAniListMediaCharacterCount.mockRejectedValue(new Error("AniList down"));

      const { container } = await renderAt(2);

      // 今のページが満杯なら次はある、とだけ判断する（3 ページ目まで）
      expect(Math.max(...pageNumbersLinked(container))).toBe(3);
      expect(container.textContent).not.toContain("500件");
      expect(container.textContent).not.toContain("/ 20 ページ");
    });
  });
});

