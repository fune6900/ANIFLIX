import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type {
  AniListCharacterDetail,
  AniListCharacterDetailMediaEdge,
  AniListPageInfo,
  AniListRelatedCharacterEdge,
} from "@/types/anilist";

/**
 * キャラクター詳細（#105）: 出演作品は 1 ページ 30 件でページ送り（`?wpage` + `#works`）、
 * 関連キャラクターは 1 ページ 50 件（`?cpage` + `#related-characters`）。
 * 2 つのページ送りは URL の中で共存する（片方を送っても、もう片方の位置を保つ）。
 *
 * `@/lib/anilist` / `@/lib/annict` / `@/lib/translate` は自前の lib なのでモックする。
 * `next/navigation` は例外 3 に従いモックする。
 */

const CHARACTER_ID = 1;
const TOP_MEDIA_ID = 77;

function workEdge(id: number): AniListCharacterDetailMediaEdge {
  return {
    characterRole: "MAIN",
    node: {
      id,
      idMal: null,
      title: { native: `作品${id}`, romaji: null, english: null },
      coverImage: { large: null, extraLarge: null },
      seasonYear: 2020,
      countryOfOrigin: "JP",
    },
    voiceActors: [],
  };
}

function relatedEdge(id: number): AniListRelatedCharacterEdge {
  return {
    role: "SUPPORTING",
    node: {
      id,
      name: { full: null, native: `キャラ${id}` },
      image: { large: null, medium: null },
    },
  };
}

function pageInfo(lastPage: number, total: number): AniListPageInfo {
  return { total, currentPage: 1, lastPage, hasNextPage: false, perPage: 0 };
}

const DETAIL: AniListCharacterDetail = {
  id: CHARACTER_ID,
  name: { full: "Hero", native: "主人公", alternative: [] },
  image: { large: null, medium: null },
  description: null,
  age: null,
  gender: null,
  bloodType: null,
  dateOfBirth: null,
  siteUrl: null,
  favourites: null,
  media: { edges: [workEdge(TOP_MEDIA_ID)] },
};

interface Paged<E> {
  edges: E[];
  pageInfo: AniListPageInfo;
}
interface Counted {
  lastPage: number;
  total: number;
}
interface Hint {
  reportedLastPage: number;
  firstPageCount: number;
}

const getAniListCharacter = vi.fn(
  async (_id: number): Promise<AniListCharacterDetail | null> => DETAIL,
);
const getAniListCharacterMedia = vi.fn(
  async (
    _id: number,
    _page: number,
    _perPage: number,
  ): Promise<Paged<AniListCharacterDetailMediaEdge>> => ({
    edges: Array.from({ length: 30 }, (_, i) => workEdge(100 + i)),
    pageInfo: pageInfo(9, 270),
  }),
);
const getAniListCharacterMediaCount = vi.fn(
  async (_id: number, _perPage: number, _hint?: Hint): Promise<Counted> => ({
    lastPage: 3,
    total: 75,
  }),
);
const getAniListMediaCharacters = vi.fn(
  async (
    _mediaId: number,
    _page: number,
    _perPage: number,
  ): Promise<Paged<AniListRelatedCharacterEdge>> => ({
    edges: Array.from({ length: 50 }, (_, i) => relatedEdge(1000 + i)),
    pageInfo: pageInfo(20, 1000),
  }),
);
const getAniListMediaCharacterCount = vi.fn(
  async (
    _mediaId: number,
    _perPage: number,
    _hint?: Hint,
  ): Promise<Counted> => ({
    lastPage: 4,
    total: 180,
  }),
);

vi.mock("@/lib/anilist", () => ({
  getAniListCharacter: (id: number) => getAniListCharacter(id),
  getAniListCharacterMedia: (id: number, page: number, perPage: number) =>
    getAniListCharacterMedia(id, page, perPage),
  getAniListCharacterMediaCount: (id: number, perPage: number, hint?: Hint) =>
    getAniListCharacterMediaCount(id, perPage, hint),
  getAniListMediaCharacters: (mediaId: number, page: number, perPage: number) =>
    getAniListMediaCharacters(mediaId, page, perPage),
  getAniListMediaCharacterCount: (
    mediaId: number,
    perPage: number,
    hint?: Hint,
  ) => getAniListMediaCharacterCount(mediaId, perPage, hint),
}));

vi.mock("@/lib/annict", () => ({
  searchAnnictCharacterByName: async () => null,
}));

vi.mock("@/lib/translate", () => ({
  translateManyToJa: async (texts: string[]) => texts,
}));

const redirect = vi.fn((url: string) => {
  // 実物の redirect は NEXT_REDIRECT を throw して描画を打ち切る
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  notFound: () => notFound(),
}));

const { default: CharacterDetailPage } =
  await import("@/app/characters/[id]/page");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderPage(sp: Record<string, string> = {}) {
  render(
    await CharacterDetailPage({
      params: Promise.resolve({ id: String(CHARACTER_ID) }),
      searchParams: Promise.resolve(sp),
    }),
  );
}

/** セクション内のページ送りリンク（作品・キャラのカードは除く） */
function pagingLinks(sectionId: string): string[] {
  const section = document.getElementById(sectionId);
  return [...(section?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])]
    .map((a) => a.getAttribute("href") ?? "")
    .filter((h) => h.startsWith(`/characters/${CHARACTER_ID}`));
}

function shownWorkIds(): number[] {
  const section = document.getElementById("works");
  return [
    ...(section?.querySelectorAll<HTMLAnchorElement>(
      'a[href^="/works/resolve"]',
    ) ?? []),
  ].map((a) =>
    Number(new URL(a.href, "http://x").searchParams.get("aniListId")),
  );
}

describe("出演作品（1 ページ 30 件）", () => {
  it("出演作品を 1 ページ 30 件で取り、実在するページ数を数える", async () => {
    await renderPage();

    expect(getAniListCharacterMedia).toHaveBeenCalledWith(CHARACTER_ID, 1, 30);
    // 1 ページ目の取得結果を数え始めのヒントに使い回す
    expect(getAniListCharacterMediaCount).toHaveBeenCalledWith(
      CHARACTER_ID,
      30,
      { reportedLastPage: 9, firstPageCount: 30 },
    );
    expect(shownWorkIds()).toHaveLength(30);
  });

  it("件数とページ位置は AniList の申告ではなく数えた値を出す", async () => {
    await renderPage();

    const heading = document.querySelector("#works h2")?.textContent ?? "";
    expect(heading).toContain("75件");
    expect(document.getElementById("works")?.textContent).toContain(
      "1 / 3 ページ",
    );
  });

  it("wpage で出演作品のページを送る", async () => {
    await renderPage({ wpage: "2" });

    expect(getAniListCharacterMedia).toHaveBeenCalledWith(CHARACTER_ID, 2, 30);
    expect(pagingLinks("works")).toContain(
      `/characters/${CHARACTER_ID}?wpage=3#works`,
    );
  });

  it("不正な wpage は 1 ページ目として扱う", async () => {
    await renderPage({ wpage: "abc" });

    expect(getAniListCharacterMedia).toHaveBeenCalledWith(CHARACTER_ID, 1, 30);
  });

  it("範囲外の wpage は最終ページへ寄せる", async () => {
    await expect(renderPage({ wpage: "9" })).rejects.toThrow(
      `NEXT_REDIRECT:/characters/${CHARACTER_ID}?wpage=3#works`,
    );
  });

  it("件数を数えられず今のページが満杯なら、次のページまで送れる", async () => {
    getAniListCharacterMediaCount.mockRejectedValueOnce(new Error("down"));

    await renderPage({ wpage: "2" });

    expect(pagingLinks("works")).toContain(
      `/characters/${CHARACTER_ID}?wpage=3#works`,
    );
  });

  it("件数を数えられず 2 ページ目以降が空なら 1 ページ目へ戻す", async () => {
    getAniListCharacterMediaCount.mockRejectedValueOnce(new Error("down"));
    getAniListCharacterMedia.mockResolvedValueOnce({
      edges: [],
      pageInfo: pageInfo(9, 270),
    });

    await expect(renderPage({ wpage: "5" })).rejects.toThrow(
      `NEXT_REDIRECT:/characters/${CHARACTER_ID}#works`,
    );
  });

  it("出演作品が無ければその旨を出す", async () => {
    getAniListCharacterMedia.mockResolvedValueOnce({
      edges: [],
      pageInfo: pageInfo(0, 0),
    });
    getAniListCharacterMediaCount.mockResolvedValueOnce({
      lastPage: 0,
      total: 0,
    });

    await renderPage();

    expect(document.getElementById("works")?.textContent).toContain(
      "登録されている出演作はない",
    );
  });
});

describe("関連キャラクター（1 ページ 50 件）", () => {
  it("代表作のキャラを 1 ページ 50 件で取り、実在するページ数を数える", async () => {
    await renderPage();

    expect(getAniListMediaCharacters).toHaveBeenCalledWith(TOP_MEDIA_ID, 1, 50);
    expect(getAniListMediaCharacterCount).toHaveBeenCalledWith(
      TOP_MEDIA_ID,
      50,
      { reportedLastPage: 20, firstPageCount: 50 },
    );
    expect(
      document.getElementById("related-characters")?.textContent,
    ).toContain("1 / 4 ページ");
  });

  it("範囲外の cpage は最終ページへ寄せる", async () => {
    await expect(renderPage({ cpage: "99" })).rejects.toThrow(
      `NEXT_REDIRECT:/characters/${CHARACTER_ID}?cpage=4#related-characters`,
    );
  });
});

describe("2 つのページ送りの共存", () => {
  it("出演作品のページ送りは cpage を保ち、関連キャラのページ送りは wpage を保つ", async () => {
    await renderPage({ wpage: "2", cpage: "3" });

    expect(getAniListCharacterMedia).toHaveBeenCalledWith(CHARACTER_ID, 2, 30);
    expect(getAniListMediaCharacters).toHaveBeenCalledWith(TOP_MEDIA_ID, 3, 50);

    expect(pagingLinks("works")).toContain(
      `/characters/${CHARACTER_ID}?wpage=3&cpage=3#works`,
    );
    // 1 ページ目へ戻るリンクは wpage を落とす
    expect(pagingLinks("works")).toContain(
      `/characters/${CHARACTER_ID}?cpage=3#works`,
    );
    expect(pagingLinks("related-characters")).toContain(
      `/characters/${CHARACTER_ID}?wpage=2&cpage=4#related-characters`,
    );
    expect(pagingLinks("related-characters")).toContain(
      `/characters/${CHARACTER_ID}?wpage=2#related-characters`,
    );
  });

  it("範囲外の cpage を寄せるときも wpage を保つ", async () => {
    await expect(renderPage({ wpage: "2", cpage: "99" })).rejects.toThrow(
      `NEXT_REDIRECT:/characters/${CHARACTER_ID}?wpage=2&cpage=4#related-characters`,
    );
  });

  it("範囲外の wpage を寄せるときも cpage を保つ", async () => {
    await expect(renderPage({ wpage: "9", cpage: "2" })).rejects.toThrow(
      `NEXT_REDIRECT:/characters/${CHARACTER_ID}?wpage=3&cpage=2#works`,
    );
  });
});
