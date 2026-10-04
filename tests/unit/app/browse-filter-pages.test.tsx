import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { TMDbAnime, TMDbWatchProvidersResponse } from "@/types/tmdb";

/**
 * 一覧ページへのフィルターの組み込み（#77）。
 *
 * 6 ファイル（popular / trending / new は [category] の 1 ファイル）を描画し、
 * 絞り込みとリンクへの引き継ぎを確かめる。
 * `@/lib/tmdb` / `@/lib/seasonal-anime` / `@/lib/request-device` は自前の lib なのでモックしてよい
 * （request-device は next/headers を読むだけの薄い層）。
 */

function anime(id: number, genreIds: number[]): TMDbAnime {
  return {
    id,
    name: `作品${id}`,
    original_name: `Work ${id}`,
    overview: "",
    poster_path: `/p${id}.jpg`,
    backdrop_path: null,
    first_air_date: "2026-01-01",
    vote_average: 7,
    vote_count: 10,
    genre_ids: genreIds,
    origin_country: ["JP"],
  };
}

function providers(name: string): TMDbWatchProvidersResponse {
  return {
    id: 0,
    results: {
      JP: {
        link: "",
        flatrate: [
          {
            provider_id: 1,
            provider_name: name,
            logo_path: null,
            display_priority: 1,
          },
        ],
      },
    },
  };
}

/** id 1〜3 はコメディ、4〜6 はドラマ。偶数 id だけ Netflix で配信中 */
const WORKS = [1, 2, 3, 4, 5, 6].map((id) =>
  anime(id, id <= 3 ? [16, 35] : [16, 18]),
);

const getAnimeByStudio = vi.fn(async () => ({
  page: 2,
  total_pages: 5,
  total_results: 100,
  results: WORKS,
}));
const getAnimeWatchProviders = vi.fn(async (id: number) =>
  providers(id % 2 === 0 ? "Netflix" : "Hulu"),
);

/** 一覧系の取得関数はどれも同じ 6 件・全 5 ページを返す */
function listPage() {
  return Promise.resolve({
    page: 2,
    total_pages: 5,
    total_results: 100,
    results: WORKS,
  });
}
let listFails = false;
const failableList = () =>
  listFails ? Promise.reject(new Error("TMDb down")) : listPage();

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getAnimeByStudio: () => getAnimeByStudio(),
  getAnimeWatchProviders: (id: number) => getAnimeWatchProviders(id),
  getAnimeByEra: () => failableList(),
  getAnimeByGenre: () => failableList(),
  getPopularAnime: () => failableList(),
  searchTVByPage: () => listPage(),
}));

vi.mock("@/lib/request-device", () => ({
  requestItemsPerPage: async () => 20,
}));

vi.mock("@/lib/seasonal-anime", () => ({
  entryKey: (e: { anime: TMDbAnime }) => `tv-${e.anime.id}`,
  fetchSeasonalAnime: async () => ({
    entries: WORKS.map((a) => ({ kind: "tv", anime: a })),
  }),
}));

const { default: StudioPage } = await import("@/app/browse/studio/[id]/page");
const { default: AiringPage } = await import("@/app/browse/airing/page");
const { default: EraPage } = await import("@/app/browse/era/[decade]/page");
const { default: SeasonPage } = await import(
  "@/app/browse/season/[year]/[season]/page"
);
const { default: GenrePage } = await import(
  "@/app/browse/genre/[genreId]/page"
);
const { default: CategoryPage } = await import(
  "@/app/browse/[category]/page"
);
const { ANIME_STUDIOS } = await import("@/lib/studios");

const STUDIO_ID = ANIME_STUDIOS[0].id;

afterEach(() => {
  cleanup();
  getAnimeWatchProviders.mockClear();
  listFails = false;
});

const FILTER = { genre: "35", service: "netflix" };

/** href が prefix で始まるリンク（フィルターを外すのが役目の「絞り込みを解除」は除く） */
function linksStartingWith(prefix: string): string[] {
  return [...document.querySelectorAll<HTMLAnchorElement>("a[href]")]
    .filter((a) => a.textContent !== "絞り込みを解除")
    .map((a) => a.getAttribute("href") ?? "")
    .filter((h) => h.startsWith(prefix));
}

function keepsFilter(href: string): boolean {
  return href.includes("genre=35") && href.includes("service=netflix");
}

function shownAnimeIds(): number[] {
  return [...document.querySelectorAll<HTMLAnchorElement>('a[href^="/anime/"]')]
    .map((a) => Number(a.getAttribute("href")?.split("/")[2]))
    .filter((id, i, arr) => arr.indexOf(id) === i);
}

async function renderStudio(sp: Record<string, string>) {
  render(
    await StudioPage({
      params: Promise.resolve({ id: String(STUDIO_ID) }),
      searchParams: Promise.resolve(sp),
    }),
  );
}

describe("スタジオページ", () => {
  it("フィルター UI を出す", async () => {
    await renderStudio({});

    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(shownAnimeIds()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("ジャンルと配信サービスで、取得済みの作品を絞る", async () => {
    await renderStudio({ page: "2", genre: "35", service: "netflix" });

    // コメディ（1〜3）かつ Netflix（偶数）= 2 だけ
    expect(shownAnimeIds()).toEqual([2]);
  });

  it("ページ送りのリンクにフィルターを引き継ぐ", async () => {
    await renderStudio({ page: "2", genre: "35", service: "netflix" });

    const pageLinks = [
      ...document.querySelectorAll<HTMLAnchorElement>(
        `a[href^="/browse/studio/${STUDIO_ID}?page="]`,
      ),
    ].map((a) => a.getAttribute("href"));

    expect(pageLinks.length).toBeGreaterThan(0);
    expect(
      pageLinks.every(
        (h) => h?.includes("genre=35") && h.includes("service=netflix"),
      ),
    ).toBe(true);
  });

  it("選択肢に無い値は無視して全件出す", async () => {
    await renderStudio({ genre: "<script>", service: "crunchyroll" });

    expect(shownAnimeIds()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(getAnimeWatchProviders).not.toHaveBeenCalled();
  });

  it("条件に合う作品が無ければ、そう伝える", async () => {
    await renderStudio({ genre: "35", service: "hulu" });
    // コメディ（1〜3）のうち Hulu は奇数 = 1, 3
    expect(shownAnimeIds()).toEqual([1, 3]);

    cleanup();
    await renderStudio({ genre: "10759" });
    expect(shownAnimeIds()).toEqual([]);
    expect(
      screen.getByText(/条件に合う作品はこのページにありません/),
    ).toBeInTheDocument();
  });
});

describe("放送中ページ", () => {
  it("フィルター UI を出し、取得済みの作品を絞る", async () => {
    render(
      await AiringPage({
        searchParams: Promise.resolve({ service: "netflix" }),
      }),
    );

    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(shownAnimeIds()).toEqual([2, 4, 6]);
  });

  it("作品カードのキービジュアルに「ON AIR」を出さない（#89）", async () => {
    render(await AiringPage({ searchParams: Promise.resolve({}) }));

    const cards = [
      ...document.querySelectorAll<HTMLAnchorElement>('a[href^="/anime/"]'),
    ];
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.some((card) => card.textContent?.includes("ON AIR"))).toBe(
      false,
    );
  });
});

describe("年代ページ", () => {
  async function renderEra(sp: Record<string, string>) {
    render(
      await EraPage({
        params: Promise.resolve({ decade: "2020" }),
        searchParams: Promise.resolve(sp),
      }),
    );
  }

  it("絞り込み、ページ送り・並び替えのリンクにフィルターを引き継ぐ", async () => {
    await renderEra({ ...FILTER, sort: "date", page: "2" });

    expect(shownAnimeIds()).toEqual([2]);
    const pageLinks = linksStartingWith("/browse/era/2020?sort=date&page=");
    expect(pageLinks.length).toBeGreaterThan(0);
    expect(pageLinks.every(keepsFilter)).toBe(true);
    const sortLinks = linksStartingWith("/browse/era/2020?sort=popular");
    expect(sortLinks.length).toBeGreaterThan(0);
    expect(sortLinks.every(keepsFilter)).toBe(true);
  });

  it("フィルターのフォームは並び順を hidden で引き継ぐ", async () => {
    await renderEra({ ...FILTER, sort: "date" });

    const form = screen.getByRole("search");
    const sort = form.querySelector<HTMLInputElement>('input[name="sort"]');
    expect(sort?.value).toBe("date");
  });

  it("タイトル検索の「クリア」でジャンル・配信の絞り込みを外さない", async () => {
    await renderEra({ ...FILTER, q: "作品" });

    const clear = screen.getByRole("link", { name: "クリア" });
    expect(keepsFilter(clear.getAttribute("href") ?? "")).toBe(true);
  });

  it("タイトル検索フォームもジャンル・配信を hidden で送る", async () => {
    await renderEra({ ...FILTER, q: "作品" });

    const q = document.querySelector<HTMLInputElement>('input[name="q"]');
    const form = q?.closest("form");
    expect(form?.querySelector<HTMLInputElement>('input[name="genre"]')?.value).toBe(
      "35",
    );
    expect(
      form?.querySelector<HTMLInputElement>('input[name="service"]')?.value,
    ).toBe("netflix");
  });
});

describe("シーズンページ", () => {
  it("絞り込み、シーズン移動のリンクにフィルターを引き継ぐ", async () => {
    render(
      await SeasonPage({
        params: Promise.resolve({ year: "2026", season: "summer" }),
        searchParams: Promise.resolve(FILTER),
      }),
    );

    expect(shownAnimeIds()).toEqual([2]);
    expect(screen.getByRole("search").getAttribute("action")).toBe(
      "/browse/season/2026/summer",
    );
    const nav = linksStartingWith("/browse/season/");
    expect(nav.length).toBeGreaterThan(0);
    expect(nav.every(keepsFilter)).toBe(true);
  });
});

describe("ジャンルページ", () => {
  async function renderGenre(sp: Record<string, string>) {
    render(
      await GenrePage({
        params: Promise.resolve({ genreId: "10759" }),
        searchParams: Promise.resolve(sp),
      }),
    );
  }

  it("ジャンル選択は出さず、配信サービスの選択は残す（#87）", async () => {
    await renderGenre({});

    const form = screen.getByRole("search");
    expect(form.querySelector('[name="genre"]')).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "配信サービス" }),
    ).toBeInTheDocument();
  });

  it("URL の genre= は無視し、配信サービスだけで絞る（#87）", async () => {
    await renderGenre({ ...FILTER, page: "2" });

    // genre=35（コメディ）は効かない。Netflix（偶数）= 2, 4, 6
    expect(shownAnimeIds()).toEqual([2, 4, 6]);
  });

  it("ページ送りのリンクは配信サービスを引き継ぎ、genre= は付けない（#87）", async () => {
    await renderGenre({ ...FILTER, page: "2" });

    const pageLinks = linksStartingWith("/browse/genre/10759?page=");
    expect(pageLinks.length).toBeGreaterThan(0);
    expect(pageLinks.every((h) => h.includes("service=netflix"))).toBe(true);
    expect(pageLinks.some((h) => h.includes("genre="))).toBe(false);
  });

  it("genre= だけが付いていても絞り込み中として扱わない（#87）", async () => {
    await renderGenre({ genre: "35" });

    expect(shownAnimeIds()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      screen.queryByRole("link", { name: "絞り込みを解除" }),
    ).not.toBeInTheDocument();
    expect(getAnimeWatchProviders).not.toHaveBeenCalled();
  });
});

describe("カテゴリページ（人気）", () => {
  async function renderPopular(sp: Record<string, string>) {
    render(
      await CategoryPage({
        params: Promise.resolve({ category: "popular" }),
        searchParams: Promise.resolve(sp),
      }),
    );
  }

  it("絞り込み、ページ送りのリンクにフィルターを引き継ぐ", async () => {
    await renderPopular({ ...FILTER, page: "2" });

    expect(shownAnimeIds()).toEqual([2]);
    const pageLinks = linksStartingWith("/browse/popular?page=");
    expect(pageLinks.length).toBeGreaterThan(0);
    expect(pageLinks.every(keepsFilter)).toBe(true);
  });

  it("取得に失敗したときは件数（0 件中 0 件）を出さない", async () => {
    listFails = true;

    await renderPopular(FILTER);

    expect(screen.getByText("データの取得に失敗しました")).toBeInTheDocument();
    expect(screen.queryByText(/件中/)).not.toBeInTheDocument();
  });
});

