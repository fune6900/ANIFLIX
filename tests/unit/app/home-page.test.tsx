import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { TMDbAnime } from "@/types/tmdb";
import { ANIME_GENRES } from "@/lib/genres";

/**
 * ホームの「探す」3 セクション（シーズン / 年代 / ジャンル）の契約（#75）。
 *
 * 3 つとも「見出し + 一覧へ → + ピル列 + 行」の同じ形に揃え、各行の
 * 「すべて見る」はその粒度の専用ページへ飛ばす。
 * `@/lib/tmdb` / `@/lib/seasonal-anime` / `@/lib/seasonal-cast` は自前の lib なのでモックする。
 */

function anime(id: number): TMDbAnime {
  return {
    id,
    name: `作品${id}`,
    original_name: `Work ${id}`,
    overview: "あらすじ",
    poster_path: `/p${id}.jpg`,
    backdrop_path: `/b${id}.jpg`,
    first_air_date: "2020-01-01",
    vote_average: 7,
    vote_count: 10,
    genre_ids: [16],
    origin_country: ["JP"],
  };
}

function page(start: number) {
  return {
    page: 1,
    total_pages: 10,
    total_results: 200,
    results: Array.from({ length: 20 }, (_, i) => anime(start + i)),
  };
}

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb")>();
  return {
    ...actual,
    getNewAnime: () => Promise.resolve(page(1000)),
    getJapaneseTrendingAnime: () => Promise.resolve(page(2000)),
    getAnimeVideos: () => Promise.resolve([]),
    getAnimeByGenre: (_id: number, p: number) => Promise.resolve(page(p * 100)),
    getAnimeByKeywords: (_k: string[], p: number) =>
      Promise.resolve(page(p * 100)),
    getAnimeByEra: (_d: number, p: number) => Promise.resolve(page(p * 100)),
  };
});

vi.mock("@/lib/seasonal-anime", () => ({
  fetchSeasonalAnime: (_y: number, _s: string, opts: { limit: number }) =>
    Promise.resolve({
      items: Array.from({ length: opts.limit }, (_, i) => anime(5000 + i)),
    }),
}));

vi.mock("@/lib/seasonal-cast", () => ({
  aggregateSeasonalCast: () => Promise.resolve([]),
}));

const { default: Home } = await import("@/app/page");

beforeAll(() => {
  // 2026 夏クール。直近 4 シーズン = 2026 夏・春・冬 / 2025 秋
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T12:00:00+09:00"));
});

afterAll(() => {
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
});

async function renderHome() {
  render(await Home());
}

function allLinkHrefs(): string[] {
  return screen
    .getAllByRole("link", { name: /すべて見る/ })
    .map((a) => a.getAttribute("href") ?? "");
}

describe("ホーム: 探すセクション", () => {
  it("シーズン・年代・ジャンルそれぞれに「一覧へ →」がある", async () => {
    await renderHome();

    const hrefs = screen
      .getAllByRole("link", { name: /一覧へ/ })
      .map((a) => a.getAttribute("href"));

    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/browse/seasons",
        "/browse/eras",
        "/browse/genres",
      ]),
    );
  });

  it("直近 4 シーズンの行があり、各シーズンの専用ページへ飛ぶ", async () => {
    await renderHome();

    expect(allLinkHrefs()).toEqual(
      expect.arrayContaining([
        "/browse/season/2026/summer",
        "/browse/season/2026/spring",
        "/browse/season/2026/winter",
        "/browse/season/2025/fall",
      ]),
    );
  });

  it("直近 3 年代の行があり、各年代の専用ページへ飛ぶ", async () => {
    await renderHome();

    const hrefs = allLinkHrefs();

    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/browse/era/2020",
        "/browse/era/2010",
        "/browse/era/2000",
      ]),
    );
    expect(hrefs).not.toContain("/browse/era/1990");
  });

  it("ジャンルもピル列を持ち、全ジャンルへのリンクが並ぶ", async () => {
    await renderHome();

    for (const genre of ANIME_GENRES) {
      const pill = screen
        .getAllByRole("link", { name: new RegExp(genre.name) })
        .find(
          (a) =>
            a.getAttribute("href") === `/browse/genre/${genre.id}` &&
            !/すべて見る/.test(a.textContent ?? ""),
        );

      expect(pill, genre.name).toBeDefined();
    }
  });

  it("ジャンル・年代・シーズンの行は 30 件並ぶ", async () => {
    await renderHome();

    for (const href of [
      `/browse/genre/${ANIME_GENRES[0].id}`,
      "/browse/era/2020",
      "/browse/season/2026/spring",
    ]) {
      const more = screen
        .getAllByRole("link", { name: /すべて見る/ })
        .find((a) => a.getAttribute("href") === href);
      const row = more?.closest("h2")?.parentElement;

      expect(row, href).toBeTruthy();
      const cards = within(row as HTMLElement)
        .getAllByRole("link")
        .filter((a) => a.getAttribute("href")?.startsWith("/anime/"));
      expect(cards, href).toHaveLength(30);
    }
  });
});
