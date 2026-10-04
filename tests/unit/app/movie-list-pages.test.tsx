import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { TMDbMovie, TMDbWatchProvidersResponse } from "@/types/tmdb";
import type { MovieListPage } from "@/lib/movie-list";
import { ANIME_GENRES } from "@/lib/genres";

/**
 * アニメ映画の「すべて見る」専用ページ（#91）。
 *
 * 取得の組み立ては `tests/unit/lib/movie-list.test.ts` が受け持つ。ここでは
 * フィルター・ページ送り・カードが映画として描かれることを見る。
 * `@/lib/movie-list` / `@/lib/tmdb` は自前の lib なのでモックする。
 * カードは例外 8（testing.md）に従い、実物を包んだスパイで props を捕まえる。
 */

function movie(id: number, genreIds: number[]): TMDbMovie {
  return {
    id,
    title: `映画${id}`,
    original_title: `Movie ${id}`,
    overview: "",
    poster_path: `/p${id}.jpg`,
    backdrop_path: null,
    release_date: "2026-09-01",
    vote_average: 7,
    vote_count: 10,
    genre_ids: genreIds,
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

/** id 1〜3 はコメディ、4〜6 はアクション（映画の 28）。偶数 id だけ Netflix で配信中 */
const WORKS = [1, 2, 3, 4, 5, 6].map((id) =>
  movie(id, id <= 3 ? [16, 35] : [16, 28]),
);

let listFails = false;
/** 指定すると、取得結果をこれに差し替える（空のページの確認用） */
let listOverride: Omit<MovieListPage, "page"> | null = null;
const listPage = vi.fn(async (page: number): Promise<MovieListPage> =>
  listFails
    ? Promise.reject(new Error("TMDb down"))
    : {
        page,
        ...(listOverride ?? { results: WORKS, totalPages: 5, totalResults: 330 }),
      },
);

const loadLatestMovieList = vi.fn((page: number) => listPage(page));
const loadGenreMovieList = vi.fn((_genre: unknown, page: number) =>
  listPage(page),
);

vi.mock("@/lib/movie-list", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/movie-list")>()),
  loadLatestMovieList: (page: number) => loadLatestMovieList(page),
  loadGenreMovieList: (genre: unknown, page: number) =>
    loadGenreMovieList(genre, page),
}));

const getMovieWatchProviders = vi.fn(async (id: number) =>
  providers(id % 2 === 0 ? "Netflix" : "Hulu"),
);

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getMovieWatchProviders: (id: number) => getMovieWatchProviders(id),
}));

// 例外 8: 実物を描いたまま、渡った entry を捕まえる
vi.mock("@/components/SeasonAnimeCard", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/SeasonAnimeCard")>();
  return { default: vi.fn(actual.default) };
});

const { default: SeasonAnimeCard } =
  await import("@/components/SeasonAnimeCard");
const cardSpy = vi.mocked(SeasonAnimeCard);

const { default: LatestPage } = await import("@/app/browse/movies/latest/page");
const { default: GenrePage } =
  await import("@/app/browse/movies/genre/[genreId]/page");

afterEach(() => {
  cleanup();
  cardSpy.mockClear();
  loadLatestMovieList.mockClear();
  loadGenreMovieList.mockClear();
  getMovieWatchProviders.mockClear();
  listFails = false;
  listOverride = null;
});

/** href が prefix で始まるリンク（フィルターを外すのが役目の「絞り込みを解除」は除く） */
function linksStartingWith(prefix: string): string[] {
  return [...document.querySelectorAll<HTMLAnchorElement>("a[href]")]
    .filter((a) => a.textContent !== "絞り込みを解除")
    .map((a) => a.getAttribute("href") ?? "")
    .filter((h) => h.startsWith(prefix));
}

function shownMovieIds(): number[] {
  return [...document.querySelectorAll<HTMLAnchorElement>('a[href^="/movie/"]')]
    .map((a) => Number(a.getAttribute("href")?.split("/")[2]))
    .filter((id, i, arr) => arr.indexOf(id) === i);
}

function cardKinds(): string[] {
  return cardSpy.mock.calls.map(([props]) => props.entry.kind);
}

async function renderLatest(sp: Record<string, string>) {
  render(await LatestPage({ searchParams: Promise.resolve(sp) }));
}

async function renderGenre(genreId: string, sp: Record<string, string>) {
  render(
    await GenrePage({
      params: Promise.resolve({ genreId }),
      searchParams: Promise.resolve(sp),
    }),
  );
}

describe("最新作の専用ページ（/browse/movies/latest）", () => {
  it("見出しと件数を出し、作品を映画の詳細ページへのカードで並べる", async () => {
    await renderLatest({});

    expect(document.querySelector("h1")?.textContent).toContain("最新作");
    expect(document.body.textContent).toContain("330件");
    expect(shownMovieIds()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(linksStartingWith("/anime/")).toEqual([]);
  });

  it("カードに渡す作品はすべて映画として扱う（kind: movie）", async () => {
    await renderLatest({});

    expect(cardKinds()).toHaveLength(6);
    expect(cardKinds().every((k) => k === "movie")).toBe(true);
  });

  it("ジャンルと配信サービスのフィルターを出す", async () => {
    await renderLatest({});

    expect(document.querySelector('select[name="genre"]')).not.toBeNull();
    expect(document.querySelector('select[name="service"]')).not.toBeNull();
    expect(
      document.querySelector("form[role=search]")?.getAttribute("action"),
    ).toBe("/browse/movies/latest");
  });

  it("ページ番号を検証して取得に渡す", async () => {
    await renderLatest({ page: "3" });
    expect(loadLatestMovieList).toHaveBeenLastCalledWith(3);

    await renderLatest({ page: "abc" });
    expect(loadLatestMovieList).toHaveBeenLastCalledWith(1);

    await renderLatest({ page: "99999" });
    expect(loadLatestMovieList).toHaveBeenLastCalledWith(500);
  });

  it("ジャンルで絞る（取得済みの作品の中だけ）", async () => {
    await renderLatest({ genre: "35" });

    expect(shownMovieIds()).toEqual([1, 2, 3]);
    expect(document.body.textContent).toContain("6 件中 3 件を表示中");
  });

  it("TV 専用のジャンル（アクション・冒険）は映画のジャンルに読み替えて絞る", async () => {
    await renderLatest({ genre: "10759" });

    expect(shownMovieIds()).toEqual([4, 5, 6]);
  });

  it("配信サービスで絞る（映画の配信情報を引く）", async () => {
    await renderLatest({ service: "netflix" });

    expect(shownMovieIds()).toEqual([2, 4, 6]);
    expect(getMovieWatchProviders).toHaveBeenCalled();
  });

  it("ホワイトリストに無い値は絞らない", async () => {
    await renderLatest({ genre: "99999", service: "<script>" });

    expect(shownMovieIds()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(getMovieWatchProviders).not.toHaveBeenCalled();
  });

  it("ページ送りのリンクにフィルターを引き継ぐ", async () => {
    await renderLatest({ page: "2", genre: "35", service: "netflix" });

    const pageLinks = linksStartingWith("/browse/movies/latest?page=");
    expect(pageLinks.length).toBeGreaterThan(0);
    for (const href of pageLinks) {
      expect(href).toContain("genre=35");
      expect(href).toContain("service=netflix");
    }
  });

  it("ポスターの無い作品を落としてページが空になったら、前後のページへ案内する（「見つからない」と言わない）", async () => {
    listOverride = { results: [], totalPages: 5, totalResults: 330 };
    await renderLatest({ page: "3" });

    expect(document.body.textContent).not.toContain("作品が見つかりませんでした");
    expect(document.body.textContent).toContain("このページに表示できる作品はありません");
    expect(linksStartingWith("/browse/movies/latest?page=").length).toBeGreaterThan(0);
  });

  it("一覧そのものが空なら「見つからない」と出し、ページ送りを出さない", async () => {
    listOverride = { results: [], totalPages: 1, totalResults: 0 };
    await renderLatest({});

    expect(document.body.textContent).toContain("作品が見つかりませんでした");
    expect(linksStartingWith("/browse/movies/latest?page=")).toEqual([]);
  });

  it("取得に失敗したらエラーを出す（ページは落とさない）", async () => {
    listFails = true;
    await renderLatest({});

    expect(document.body.textContent).toContain("データの取得に失敗しました");
  });
});

describe("ジャンルの専用ページ（/browse/movies/genre/[genreId]）", () => {
  it("見出しにジャンル名を出し、そのジャンルで取得する", async () => {
    await renderGenre("10759", {});

    expect(document.querySelector("h1")?.textContent).toContain(
      "アクション・冒険",
    );
    const [genre] = loadGenreMovieList.mock.calls[0];
    expect(genre).toMatchObject({ id: 10759 });
    expect(shownMovieIds()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("カードに渡す作品はすべて映画として扱う（kind: movie）", async () => {
    await renderGenre("35", {});

    expect(cardKinds()).toHaveLength(6);
    expect(cardKinds().every((k) => k === "movie")).toBe(true);
  });

  it("ジャンル選択を出さず、URL の genre= も読まない（#87 と同じ）", async () => {
    // 35（コメディ）はホワイトリストにある値。読んでしまうと 1〜3 だけに絞られる
    await renderGenre("10759", { genre: "35" });

    expect(document.querySelector('select[name="genre"]')).toBeNull();
    expect(document.querySelector('select[name="service"]')).not.toBeNull();
    expect(shownMovieIds()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(document.body.textContent).not.toContain("件を表示中");
  });

  it("ページ送りのリンクに genre= を引き継がない", async () => {
    await renderGenre("10759", { genre: "35", service: "netflix", page: "2" });

    const pageLinks = linksStartingWith("/browse/movies/genre/10759?page=");
    expect(pageLinks.length).toBeGreaterThan(0);
    for (const href of pageLinks) {
      expect(href).not.toContain("genre=35");
      expect(href).toContain("service=netflix");
    }
  });

  it("配信サービスで絞り、ページ送りに引き継ぐ", async () => {
    await renderGenre("35", { service: "netflix", page: "2" });

    expect(shownMovieIds()).toEqual([2, 4, 6]);
    expect(loadGenreMovieList.mock.calls[0][1]).toBe(2);
    const pageLinks = linksStartingWith("/browse/movies/genre/35?page=");
    expect(pageLinks.length).toBeGreaterThan(0);
    for (const href of pageLinks) expect(href).toContain("service=netflix");
  });

  it("他のジャンルの専用ページへのリンクを出す", async () => {
    await renderGenre("35", {});

    const others = ANIME_GENRES.filter((g) => g.id !== 35).map(
      (g) => `/browse/movies/genre/${g.id}`,
    );
    const links = linksStartingWith("/browse/movies/genre/");
    for (const href of others) expect(links).toContain(href);
  });

  it("定義に無いジャンル ID は 404", async () => {
    await expect(renderGenre("12345", {})).rejects.toThrow();
    await expect(renderGenre("abc", {})).rejects.toThrow();
    expect(loadGenreMovieList).not.toHaveBeenCalled();
  });
});
