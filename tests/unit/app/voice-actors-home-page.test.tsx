import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { TMDbAnime } from "@/types/tmdb";
import type { VoiceActorCard, VoiceActorRow } from "@/types/voice-actor-home";
import type { VoiceActorHome } from "@/lib/voice-actor-home";

/**
 * 声優ページ（`/voice-actors`）をトップ画面・アニメ映画画面と同じ構成にする（#102）。
 *
 * 行の中身の組み立ては `tests/unit/lib/voice-actor-home.test.ts` が受け持つ。
 * ここでは並び・「すべて見る」の遷移先・名前の表示・空の行を隠すこと・
 * 専用ページ（`/voice-actors/collections/[slug]`）の 404 と全件表示を見る。
 * `@/lib/voice-actor-home` / `@/lib/tmdb` は自前の lib なのでモックする。
 * `next/navigation` は例外 3。`redirect()` / `notFound()` は本物と同じく throw させる。
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
  usePathname: () => "/voice-actors",
}));

function card(id: number, anilist = false): VoiceActorCard {
  return {
    id,
    name: `声優${id}`,
    imageUrl: anilist
      ? `https://s4.anilist.co/file/anilistcdn/staff/large/n${id}.jpg`
      : `https://image.tmdb.org/t/p/w342/v${id}.jpg`,
    href: anilist
      ? `/voice-actors/resolve?name=${encodeURIComponent(`声優${id}`)}`
      : `/voice-actors/${id}`,
    note: `役: キャラ${id}`,
  };
}

function row(
  slug: string,
  title: string,
  n: number,
  base: number,
): VoiceActorRow {
  return {
    slug,
    title,
    cards: Array.from({ length: n }, (_, i) =>
      card(base + i, slug !== "airing"),
    ),
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

const ROWS: VoiceActorRow[] = [
  row("airing", "🎙️ 今期放送中アニメの声優", 120, 1),
  row("leads", "⭐ 今期の主演声優", 40, 1000),
  row("work-1", "📺 『作品A』の声優", 12, 2000),
  row("franchise-pokemon", "⚡ ポケモンシリーズの声優", 60, 3000),
  row("ranking", "🏆 人気声優ランキング", 50, 4000),
  // 取得に失敗した行（空）は出さない
  row("birthdays", "🎂 今日が誕生日の声優", 0, 0),
  row("legends", "👑 レジェンド声優", 30, 5000),
];

const HOME: VoiceActorHome = {
  hero: [
    { anime: anime(1), leadVoiceActors: ["主演1", "主演2"] },
    { anime: anime(2), leadVoiceActors: [] },
  ],
  rows: ROWS,
};

const loadVoiceActorHome = vi.fn(async () => HOME);
const loadVoiceActorCollection = vi.fn(
  async (slug: string) => ROWS.find((r) => r.slug === slug) ?? null,
);

vi.mock("@/lib/voice-actor-home", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/voice-actor-home")>();
  return {
    ...actual,
    loadVoiceActorHome: () => loadVoiceActorHome(),
    // 定義済みの行はテストデータを返し、それ以外は本物のホワイトリストに通す
    // （未知の slug は取得を伴わずに null を返すので、通信は発生しない）
    loadVoiceActorCollection: async (slug: string) =>
      (await loadVoiceActorCollection(slug)) ??
      actual.loadVoiceActorCollection(slug),
  };
});

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb")>();
  return { ...actual, getAnimeVideos: async () => [] };
});

const { default: VoiceActorsPage } = await import("@/app/voice-actors/page");
const { default: CollectionPage } =
  await import("@/app/voice-actors/collections/[slug]/page");

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
  return snapshot(await VoiceActorsPage({ searchParams: Promise.resolve({}) }));
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

describe("/voice-actors: Hero + 特集の行", () => {
  it("キーワード検索を持たない（検索はヘッダーに一本化）", async () => {
    const dom = await renderHome();

    expect(dom.querySelector("input")).toBeNull();
    expect(dom.querySelector("form")).toBeNull();
  });

  it("?q= は声優の検索結果へ送る（#101 の redirect を維持）", async () => {
    expect(
      await signalOf(() =>
        VoiceActorsPage({ searchParams: Promise.resolve({ q: "花江" }) }),
      ),
    ).toBe(`redirect:/search/voice-actors?q=${encodeURIComponent("花江")}`);
  });

  it("Hero は今期人気作品のキービジュアルと主演声優", async () => {
    const dom = await renderHome();

    expect(dom.querySelector("section h1")?.textContent).toBe("アニメ1");
    expect(dom.textContent).toContain("主演1");
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
    expect(all.some((h) => h.includes("今日が誕生日の声優"))).toBe(false);
  });

  it("各行は全件を並べる（切り詰めない）", async () => {
    const dom = await renderHome();

    const airing = rowOf(dom, "今期放送中アニメの声優");
    expect(
      hrefs(airing ?? dom).filter((h) => /^\/voice-actors\/\d+$/.test(h)),
    ).toHaveLength(120);
    const franchise = rowOf(dom, "ポケモンシリーズの声優");
    expect(
      hrefs(franchise ?? dom).filter((h) =>
        h.startsWith("/voice-actors/resolve?name="),
      ),
    ).toHaveLength(60);
  });

  it("各行の「すべて見る」は専用ページへ", async () => {
    const dom = await renderHome();

    for (const r of ROWS.filter((x) => x.cards.length > 0)) {
      expect(seeAllOf(dom, r.title), r.title).toBe(
        `/voice-actors/collections/${r.slug}`,
      );
    }
  });

  it("声優の写真の中に名前を出す", async () => {
    const dom = await renderHome();
    const img = dom.querySelector('img[alt="声優4000"]');

    // テストでは next.config の unoptimized が効かず /_next/image?url= に包まれる
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "url=https://s4.anilist.co/file/anilistcdn/staff/large/n4000.jpg&",
    );
    expect(img?.parentElement?.textContent).toContain("声優4000");
  });
});

describe("/voice-actors/collections/[slug]", () => {
  it("行の全件をグリッドで出す", async () => {
    const dom = await renderCollection("franchise-pokemon");

    expect(dom.querySelector("h1")?.textContent).toContain(
      "ポケモンシリーズの声優",
    );
    expect(
      hrefs(dom).filter((h) => h.startsWith("/voice-actors/resolve?name=")),
    ).toHaveLength(60);
    expect(loadVoiceActorCollection).toHaveBeenCalledWith("franchise-pokemon");
  });

  it("名前と役を写真の中に出す", async () => {
    const dom = await renderCollection("leads");
    const img = dom.querySelector('img[alt="声優1000"]');

    expect(img?.parentElement?.textContent).toContain("声優1000");
    expect(img?.parentElement?.textContent).toContain("役: キャラ1000");
  });

  it("グリッドは声優一覧の段組み（1920px 超は minmax(170px) の auto-fill）", async () => {
    const dom = await renderCollection("airing");
    const grid = dom.querySelector(".grid");

    expect(grid?.className).toContain(
      "3xl:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]",
    );
    expect(grid?.className).toContain("grid-cols-3");
    expect(grid?.className).toContain("2xl:grid-cols-8");
  });

  it("声優ページへ戻るリンクを持つ", async () => {
    expect(hrefs(await renderCollection("airing"))).toContain("/voice-actors");
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
      "今日が誕生日の声優",
    );
    expect(dom.textContent).toContain("見つかりませんでした");
  });
});
