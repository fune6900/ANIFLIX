import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { TMDbMovie } from "@/types/tmdb";
import { ANIME_GENRES } from "@/lib/genres";
import { ANIME_STUDIOS } from "@/lib/studios";
import type { AnimeMovieHome } from "@/lib/movie-home-rows";
import type { ContentRowItem } from "@/components/ContentRow";

/**
 * アニメ映画画面（`/browse/movies`）をトップ画面と同じ構成にする（#90）。
 *
 * 行の中身の組み立ては `tests/unit/lib/movie-home-rows.test.ts` が受け持つ。
 * ここでは並び順・遷移先・カルーセルと、ページ内に検索を持たないこと（#101）を見る。
 * `@/lib/movie-home-rows` / `@/lib/tmdb` は自前の lib なのでモックする。
 */

function movie(id: number): TMDbMovie {
  return {
    id,
    title: `映画${id}`,
    original_title: `Movie ${id}`,
    overview: "あらすじ",
    poster_path: `/p${id}.jpg`,
    backdrop_path: `/b${id}.jpg`,
    release_date: "2026-09-01",
    vote_average: 7.5,
    vote_count: 100,
    genre_ids: [16],
  };
}

function list(base: number, n: number): TMDbMovie[] {
  return Array.from({ length: n }, (_, i) => movie(base + i));
}

const HOME: AnimeMovieHome = {
  hero: list(1, 6),
  latest: list(1, 20),
  japanTop10: list(100, 10),
  worldTop10: list(200, 10),
  upcoming: list(300, 5),
  topRated: list(400, 30),
  studios: ANIME_STUDIOS.map((studio, i) => ({
    studio,
    movies: list(1000 + i * 100, 20),
  })),
  theatrical: list(500, 30),
  genres: ANIME_GENRES.map((genre, i) => ({
    genre,
    movies: list(5000 + i * 100, 30),
  })),
};

vi.mock("@/lib/movie-home-rows", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/movie-home-rows")>();
  return { ...actual, loadAnimeMovieHome: async () => HOME };
});

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb")>();
  return {
    ...actual,
    getMovieVideos: async () => [],
  };
});

// 例外 8: 実物を描いたまま、行に渡った items を捕まえる（#96 のレビューで残った穴）
vi.mock("@/components/ContentRow", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/ContentRow")>();
  return { ...actual, default: vi.fn(actual.default) };
});

// HeroSection 等のクライアントコンポーネントが useRouter を使う（例外 3）
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/browse/movies",
}));

const { default: MoviesPage } = await import("@/app/browse/movies/page");
const { default: ContentRow } = await import("@/components/ContentRow");
const rowSpy = vi.mocked(ContentRow);

type Params = Record<string, string>;

async function renderPage(params: Params = {}): Promise<HTMLElement> {
  const { container } = render(
    await MoviesPage({ searchParams: Promise.resolve(params) }),
  );
  const dom = container.cloneNode(true) as HTMLElement; // cloneNode の戻り値は Node 型
  cleanup();
  return dom;
}

function headings(root: HTMLElement): string[] {
  return [...root.querySelectorAll("h2")].map((h) => h.textContent ?? "");
}

/** 見出し（行タイトル）を含む h2 の位置。無ければ -1 */
function indexOfRow(all: string[], title: string): number {
  return all.findIndex((h) => h.includes(title));
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

describe("アニメ映画画面: トップ画面と同じ構成", () => {
  let dom: HTMLElement = document.createElement("div");
  let rowItems: ContentRowItem[] = [];

  beforeAll(async () => {
    dom = await renderPage();
    // モックの呼び出し記録はテストごとに消えるので、描画した直後に控える
    rowItems = rowSpy.mock.calls.flatMap(([props]) => props.items);
  }, 30_000);

  it("メニューを決められた順に並べる", () => {
    const all = headings(dom);
    const order = [
      "最新作",
      "アニメ映画TOP10（日本）",
      "アニメ映画TOP10（全世界）",
      "近日公開",
      "高評価の名作",
      ANIME_STUDIOS[0].name,
      ANIME_STUDIOS[ANIME_STUDIOS.length - 1].name,
      "TVシリーズの劇場版",
      ANIME_GENRES[0].name,
      ANIME_GENRES[ANIME_GENRES.length - 1].name,
    ];

    const positions = order.map((t) => indexOfRow(all, t));
    for (const [i, p] of positions.entries()) {
      expect(p, order[i]).toBeGreaterThanOrEqual(0);
    }
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("スタジオ・ジャンルは定義の全件ぶん行がある", () => {
    const all = headings(dom);
    for (const s of ANIME_STUDIOS) {
      expect(indexOfRow(all, s.name), s.name).toBeGreaterThanOrEqual(0);
    }
    for (const g of ANIME_GENRES) {
      expect(indexOfRow(all, g.name), g.name).toBeGreaterThanOrEqual(0);
    }
  });

  it("最新作は 20 件、ジャンル行は 30 件、TOP10 は 10 件並ぶ", () => {
    const count = (title: string) =>
      hrefs(rowOf(dom, title) ?? document.createElement("div")).filter((h) =>
        h.startsWith("/movie/"),
      ).length;

    expect(count("最新作")).toBe(20);
    expect(count("アニメ映画TOP10（日本）")).toBe(10);
    expect(count("アニメ映画TOP10（全世界）")).toBe(10);
    expect(count(ANIME_GENRES[0].name)).toBe(30);
  });

  it("カードは映画の詳細ページへ飛ぶ", () => {
    const row = rowOf(dom, "最新作");
    expect(hrefs(row ?? dom)).toContain("/movie/1");
    expect(hrefs(row ?? dom).some((h) => h.startsWith("/anime/"))).toBe(false);
  });

  it("最新作の「すべて見る」は最新作の専用ページへ（#91）", () => {
    expect(seeAllOf(dom, "最新作")).toBe("/browse/movies/latest");
  });

  it("ジャンル別の「すべて見る」は各ジャンルの専用ページへ（#91）", () => {
    for (const g of ANIME_GENRES) {
      expect(seeAllOf(dom, g.name), g.name).toBe(
        `/browse/movies/genre/${g.id}`,
      );
    }
  });

  it("行に渡すカードはすべて映画（mediaType: movie）。TV の動画を引かない", () => {
    expect(rowItems.length).toBeGreaterThan(0);
    expect(rowItems.filter((item) => item.mediaType !== "movie")).toEqual([]);
  });

  it("カルーセルに最新作を流し、左右の切り替えボタンを付ける", () => {
    // HeroSection はクライアントコンポーネント。初期スライド = 最新作の先頭
    expect(dom.querySelector('[aria-label="前のスライド"]')).not.toBeNull();
    expect(dom.querySelector('[aria-label="次のスライド"]')).not.toBeNull();
    expect(dom.textContent).toContain(HOME.hero[0].title);
  });

  it("ページ内に検索への入口を置かない（検索はヘッダーに一本化。#101）", () => {
    expect(hrefs(dom).some((h) => h.startsWith("/browse/movies?"))).toBe(false);
    expect(dom.querySelector("input")).toBeNull();
    expect(dom.textContent).not.toContain("アニメ映画を検索");
  });
});

describe("アニメ映画画面: 検索画面は持たない（#101）", () => {
  const legacyQueries: Params[] = [
    { mode: "keyword" },
    { mode: "filter" },
    { page: "2" },
    { genre: "16", sort: "vote_average.desc" },
  ];

  it.each(legacyQueries)(
    "旧検索画面のクエリ %o でもホームを出す",
    async (params) => {
      const dom = await renderPage(params);

      expect(dom.textContent).toContain("アニメ映画TOP10");
      expect(dom.textContent).not.toContain("アニメ映画を検索");
    },
  );
});
