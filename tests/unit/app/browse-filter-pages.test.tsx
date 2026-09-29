import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { TMDbAnime, TMDbWatchProvidersResponse } from "@/types/tmdb";

/**
 * 一覧ページへのフィルターの組み込み（#77）。
 *
 * 代表としてスタジオ（ページ送りあり）と放送中（全件 1 ページ）を描画して確かめる。
 * `@/lib/tmdb` / `@/lib/seasonal-anime` は自前の lib なのでモックしてよい。
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

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getAnimeByStudio: () => getAnimeByStudio(),
  getAnimeWatchProviders: (id: number) => getAnimeWatchProviders(id),
}));

vi.mock("@/lib/seasonal-anime", () => ({
  entryKey: (e: { anime: TMDbAnime }) => `tv-${e.anime.id}`,
  fetchSeasonalAnime: async () => ({
    entries: WORKS.map((a) => ({ kind: "tv", anime: a })),
  }),
}));

const { default: StudioPage } = await import("@/app/browse/studio/[id]/page");
const { default: AiringPage } = await import("@/app/browse/airing/page");
const { ANIME_STUDIOS } = await import("@/lib/studios");

const STUDIO_ID = ANIME_STUDIOS[0].id;

afterEach(() => {
  cleanup();
  getAnimeWatchProviders.mockClear();
});

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
});
