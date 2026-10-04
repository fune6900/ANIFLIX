import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { TMDbAnime } from "@/types/tmdb";
import type { CharacterCard, CharacterRow } from "@/types/character-home";
import type { CharacterHome } from "@/lib/character-home";

/**
 * キャラクターページ（`/characters`）をトップ画面・声優ページと同じ構成にする（#104）。
 *
 * 行の中身の組み立ては `tests/unit/lib/character-home.test.ts` が受け持つ。
 * ここでは並び・「すべて見る」の遷移先・名前の表示・空の行を隠すこと・
 * 専用ページ（`/characters/collections/[slug]`）の 404 と全件表示を見る。
 * `@/lib/character-home` / `@/lib/tmdb` は自前の lib なのでモックする。
 * `next/navigation` は例外 3。`notFound()` は本物と同じく throw させる。
 */

class NavigationSignal extends Error {
  constructor(readonly to: string) {
    super(to);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new NavigationSignal(`redirect:${to}`);
  },
  notFound: () => {
    throw new NavigationSignal("not-found");
  },
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/characters",
}));

function card(id: number): CharacterCard {
  return {
    id,
    name: `キャラ${id}`,
    imageUrl: `https://s4.anilist.co/file/anilistcdn/character/large/c${id}.jpg`,
    href: `/characters/${id}`,
    note: `作品${id}`,
  };
}

function row(
  slug: string,
  title: string,
  n: number,
  base: number,
): CharacterRow {
  return {
    slug,
    title,
    cards: Array.from({ length: n }, (_, i) => card(base + i)),
  };
}

function anime(id: number): TMDbAnime {
  return {
    id,
    name: `アニメ${id}`,
    original_name: `Anime ${id}`,
    overview: "あらすじ",
    poster_path: `/p${id}.jpg`,
    backdrop_path: `/b${id}.jpg`,
    first_air_date: "2026-10-01",
    vote_average: 8,
    vote_count: 10,
    genre_ids: [16],
    origin_country: ["JP"],
  };
}

const ROWS: CharacterRow[] = [
  row("airing", "🎬 今期放送中アニメのキャラ", 320, 1),
  row("leads", "⭐ 今期の主人公", 40, 1000),
  row("work-1", "📺 『作品A』のキャラクター", 12, 2000),
  row("franchise-pokemon", "⚡ ポケモンシリーズのキャラ", 60, 3000),
  row("ranking", "🏆 人気キャラランキング", 50, 4000),
  // 取得に失敗した行（空）は出さない
  row("birthdays", "🎂 今日が誕生日のキャラ", 0, 0),
  row("era-1990", "⚡ 90年代の名作キャラ", 30, 5000),
];

const HOME: CharacterHome = {
  hero: [
    { anime: anime(1), mainCharacters: ["猫猫", "壬氏"] },
    { anime: anime(2), mainCharacters: [] },
  ],
  rows: ROWS,
};

const loadCharacterHome = vi.fn(async () => HOME);
const loadCharacterCollection = vi.fn(
  async (slug: string) => ROWS.find((r) => r.slug === slug) ?? null,
);

vi.mock("@/lib/character-home", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/character-home")>();
  return {
    ...actual,
    loadCharacterHome: () => loadCharacterHome(),
    // 定義済みの行はテストデータを返し、それ以外は本物のホワイトリストに通す
    // （未知の slug は取得を伴わずに null を返すので、通信は発生しない）
    loadCharacterCollection: async (slug: string) =>
      (await loadCharacterCollection(slug)) ??
      actual.loadCharacterCollection(slug),
  };
});

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb")>();
  return { ...actual, getAnimeVideos: async () => [] };
});

const { default: CharactersPage } = await import("@/app/characters/page");
const { default: CollectionPage } =
  await import("@/app/characters/collections/[slug]/page");

beforeEach(() => {
  vi.clearAllMocks();
});

function snapshot(el: React.ReactElement): HTMLElement {
  const { container } = render(el);
  const dom = container.cloneNode(true) as HTMLElement; // cloneNode の戻り値は Node 型
  cleanup();
  return dom;
}

function headings(root: HTMLElement): string[] {
  return [...root.querySelectorAll("h2")].map((h) => h.textContent ?? "");
}

function rowOf(root: HTMLElement, title: string): HTMLElement | null {
  const h = [...root.querySelectorAll("h2")].find((x) =>
    (x.textContent ?? "").includes(title),
  );
  return h?.parentElement ?? null;
}

function hrefs(root: ParentNode): string[] {
  return [...root.querySelectorAll<HTMLAnchorElement>("a[href]")].map(
    (a) => a.getAttribute("href") ?? "",
  );
}

function seeAllOf(root: HTMLElement, title: string): string | undefined {
  const h = [...root.querySelectorAll("h2")].find((x) =>
    (x.textContent ?? "").includes(title),
  );
  const a = [...(h?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])].find(
    (x) => /すべて見る/.test(x.textContent ?? ""),
  );
  return a?.getAttribute("href") ?? undefined;
}

async function renderHome(): Promise<HTMLElement> {
  return snapshot(await CharactersPage());
}

async function renderCollection(slug: string): Promise<HTMLElement> {
  return snapshot(await CollectionPage({ params: Promise.resolve({ slug }) }));
}

async function signalOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (e) {
    if (e instanceof NavigationSignal) return e.to;
    throw e;
  }
}

describe("/characters: Hero + 特集の行", () => {
  it("キーワード検索を持たない（検索はヘッダーに一本化）", async () => {
    const dom = await renderHome();

    expect(dom.querySelector("input")).toBeNull();
    expect(dom.querySelector("form")).toBeNull();
  });

  it("Hero は今期人気作品のキービジュアルと主要キャラ", async () => {
    const dom = await renderHome();

    expect(dom.querySelector("section h1")?.textContent).toBe("アニメ1");
    // キャラ名に「・」を含むことがある（ロマン・カラックス）ので「、」で区切る
    expect(dom.textContent).toContain("主要キャラ: 猫猫、壬氏");
    expect(hrefs(dom)).toContain("/anime/1");
  });

  it("行は lib の順に並び、空の行は出さない", async () => {
    const all = headings(await renderHome());
    const titles = ROWS.filter((r) => r.cards.length > 0).map((r) => r.title);

    const positions = titles.map((t) => all.findIndex((h) => h.includes(t)));
    for (const [i, p] of positions.entries()) {
      expect(p, titles[i]).toBeGreaterThanOrEqual(0);
    }
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(all.some((h) => h.includes("今日が誕生日のキャラ"))).toBe(false);
  });

  it("各行は全件を並べる（切り詰めない）。カードはキャラ詳細へ", async () => {
    const dom = await renderHome();

    const airing = rowOf(dom, "今期放送中アニメのキャラ");
    expect(
      hrefs(airing ?? dom).filter((h) => /^\/characters\/\d+$/.test(h)),
    ).toHaveLength(320);
    const franchise = rowOf(dom, "ポケモンシリーズのキャラ");
    expect(
      hrefs(franchise ?? dom).filter((h) => /^\/characters\/\d+$/.test(h)),
    ).toHaveLength(60);
  });

  it("各行の「すべて見る」は専用ページへ", async () => {
    const dom = await renderHome();

    for (const r of ROWS.filter((x) => x.cards.length > 0)) {
      expect(seeAllOf(dom, r.title), r.title).toBe(
        `/characters/collections/${r.slug}`,
      );
    }
  });

  it("キャラの画像の中に名前を出す", async () => {
    const dom = await renderHome();
    const img = dom.querySelector('img[alt="キャラ4000"]');

    // テストでは next.config の unoptimized が効かず /_next/image?url= に包まれる
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "url=https://s4.anilist.co/file/anilistcdn/character/large/c4000.jpg&",
    );
    expect(img?.parentElement?.textContent).toContain("キャラ4000");
  });
});

describe("/characters/collections/[slug]", () => {
  it("行の全件をグリッドで出す", async () => {
    const dom = await renderCollection("franchise-pokemon");

    expect(dom.querySelector("h1")?.textContent).toContain(
      "ポケモンシリーズのキャラ",
    );
    expect(
      hrefs(dom).filter((h) => /^\/characters\/\d+$/.test(h)),
    ).toHaveLength(60);
    expect(dom.textContent).toContain("60人");
    expect(loadCharacterCollection).toHaveBeenCalledWith("franchise-pokemon");
  });

  it("名前と一言（作品名など）を画像の中に出す", async () => {
    const dom = await renderCollection("leads");
    const img = dom.querySelector('img[alt="キャラ1000"]');

    expect(img?.parentElement?.textContent).toContain("キャラ1000");
    expect(img?.parentElement?.textContent).toContain("作品1000");
  });

  it("グリッドはキャラ一覧の段組み（1920px 超は minmax(250px) の auto-fill）", async () => {
    const dom = await renderCollection("airing");
    const grid = dom.querySelector(".grid");

    expect(grid?.className).toContain(
      "3xl:grid-cols-[repeat(auto-fill,minmax(250px,1fr))]",
    );
    expect(grid?.className).toContain("grid-cols-2");
    expect(grid?.className).toContain("xl:grid-cols-6");
  });

  it("キャラクターページへ戻るリンクを持つ", async () => {
    expect(hrefs(await renderCollection("airing"))).toContain("/characters");
  });

  it("未知の slug は 404", async () => {
    expect(await signalOf(() => renderCollection("unknown"))).toBe("not-found");
  });

  it("プロトタイプのキー（constructor / __proto__ / toString）も 404", async () => {
    for (const slug of ["constructor", "__proto__", "toString"]) {
      expect(await signalOf(() => renderCollection(slug)), slug).toBe(
        "not-found",
      );
    }
  });

  it("空の行は「見つからない」旨を出す（404 にはしない）", async () => {
    const dom = await renderCollection("birthdays");

    expect(dom.querySelector("h1")?.textContent).toContain(
      "今日が誕生日のキャラ",
    );
    expect(dom.textContent).toContain("見つかりませんでした");
  });
});
