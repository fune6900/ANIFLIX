import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import type {
  AniListPageInfo,
  AniListStaffCharacterEdge,
} from "@/types/anilist";

/**
 * 声優詳細の「演じたキャラクター」（#103）: 1 ページ 24 → 50 件。
 * AniList の perPage 上限は 50。
 * `@/lib/anilist` は自前の lib、`next/navigation` は例外 3 に従いモックする。
 */

interface StaffHit {
  staffId: number;
  staffName: string;
  edges: AniListStaffCharacterEdge[];
  pageInfo: AniListPageInfo;
}

const getAniListStaffCharactersByName = vi.fn(
  async (
    _search: string,
    _page: number,
    _perPage: number,
  ): Promise<StaffHit | null> => null,
);

vi.mock("@/lib/anilist", () => ({
  getAniListStaffCharactersByName: (
    search: string,
    page: number,
    perPage: number,
  ) => getAniListStaffCharactersByName(search, page, perPage),
}));

const redirect = vi.fn((url: string) => {
  // 実物の redirect は NEXT_REDIRECT を throw して描画を打ち切る
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

const { default: VoicedCharacters } =
  await import("@/components/VoicedCharacters");

function edges(count: number): AniListStaffCharacterEdge[] {
  return Array.from({ length: count }, (_, i) => ({
    role: "MAIN",
    node: {
      id: i + 1,
      name: { native: `キャラ${i + 1}`, full: null },
      image: { large: null, medium: null },
    },
    media: [],
  }));
}

/** 120 件 = 50 件ずつ 3 ページ（AniList が perPage=50 で返す形） */
function hit(page: number): StaffHit {
  const total = 120;
  const perPage = 50;
  const lastPage = Math.ceil(total / perPage);
  return {
    staffId: 1,
    staffName: "声優A",
    edges: edges(page < lastPage ? perPage : total - perPage * (lastPage - 1)),
    pageInfo: {
      total,
      currentPage: page,
      lastPage,
      hasNextPage: page < lastPage,
      perPage,
    },
  };
}

const pageUrl = (p: number) => `/voice-actors/9?cpage=${p}#voiced-characters`;

afterEach(() => {
  getAniListStaffCharactersByName.mockReset();
  redirect.mockClear();
});

describe("VoicedCharacters", () => {
  it("既定で 1 ページ 50 件を取る（AniList の perPage 上限）", async () => {
    getAniListStaffCharactersByName.mockImplementation(async (_s, p) => hit(p));

    await VoicedCharacters({ name: "声優A", pageUrl });

    expect(getAniListStaffCharactersByName).toHaveBeenCalledWith(
      "声優A",
      1,
      50,
    );
  });

  it("50 件をそのまま並べ、ページ数は 50 件区切りで出す", async () => {
    getAniListStaffCharactersByName.mockImplementation(async (_s, p) => hit(p));

    const { container } = render(
      await VoicedCharacters({ name: "声優A", pageUrl }),
    );

    expect(container.querySelectorAll('a[href^="/characters/"]')).toHaveLength(
      50,
    );
    expect(container.textContent).toContain("120件");
    expect(container.textContent).toContain("1 / 3 ページ");
  });

  it("ページ送りのリンクはアンカー付きの cpage を指す", async () => {
    getAniListStaffCharactersByName.mockImplementation(async (_s, p) => hit(p));

    const { container } = render(
      await VoicedCharacters({ name: "声優A", currentPage: 2, pageUrl }),
    );

    const hrefs = [...container.querySelectorAll<HTMLAnchorElement>("a[href]")]
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.includes("cpage="));
    expect(hrefs).toContain("/voice-actors/9?cpage=3#voiced-characters");
    expect(hrefs).toContain("/voice-actors/9?cpage=1#voiced-characters");
    expect(container.querySelector("#voiced-characters")).not.toBeNull();
  });

  it("実在しないページを開いたら 50 件区切りの最終ページへ寄せる", async () => {
    getAniListStaffCharactersByName.mockImplementation(async (_s, p) => hit(p));

    await expect(
      VoicedCharacters({ name: "声優A", currentPage: 5, pageUrl }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(
      "/voice-actors/9?cpage=3#voiced-characters",
    );
  });

  it("列数はどの段でも 50 件を割り切る（最終行を欠けさせない）", async () => {
    getAniListStaffCharactersByName.mockImplementation(async (_s, p) => hit(p));

    const { container } = render(
      await VoicedCharacters({ name: "声優A", pageUrl }),
    );

    const grid = container.querySelector<HTMLElement>('[class*="grid-cols-"]');
    const counts = (grid?.className ?? "")
      .split(/\s+/)
      .map((c) => c.match(/(?:^|:)grid-cols-(\d+)$/)?.[1])
      .filter((n): n is string => Boolean(n))
      .map(Number);

    expect(counts.length).toBeGreaterThan(0);
    for (const n of counts) expect(50 % n, `${n} 列`).toBe(0);
  });
});
