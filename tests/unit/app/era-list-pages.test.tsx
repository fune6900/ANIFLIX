import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type {
  TMDbAnime,
  TMDbMovie,
  TMDbWatchProvidersResponse,
} from "@/types/tmdb";
import type { ListPage } from "@/lib/list-page";
import { ANIME_ERAS } from "@/lib/eras";

/**
 * 年代の一覧（#100）。アニメ（/browse/era/[decade]）とアニメ映画
 * （/browse/movies/era/[decade]）は同じ作りで、相互に切り替えられる。
 *
 * 取得の組み立ては `tests/unit/lib/era-list.test.ts` が受け持つ。
 * `@/lib/era-list` / `@/lib/tmdb` / `@/lib/request-device` は自前の lib なのでモックする。
 */

function anime(id: number): TMDbAnime {
  return {
    id,
    name: `作品${id}`,
    original_name: `Work ${id}`,
    overview: "",
    poster_path: `/p${id}.jpg`,
    backdrop_path: null,
    first_air_date: "1995-01-01",
    vote_average: 7,
    vote_count: 0,
    genre_ids: [16, id <= 3 ? 35 : 18],
    origin_country: ["JP"],
  };
}

function movie(id: number): TMDbMovie {
  return {
    id,
    title: `映画${id}`,
    original_title: `Movie ${id}`,
    overview: "",
    poster_path: `/p${id}.jpg`,
    backdrop_path: null,
    release_date: "1995-01-01",
    vote_average: 7,
    vote_count: 0,
    genre_ids: [16, id <= 3 ? 35 : 18],
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

const IDS = [1, 2, 3, 4, 5, 6];
let listFails = false;
/** 1 ページの作品数を差し替える（端末別の切り捨てが無いことの確認用） */
let pageSize = IDS.length;

function listOf<T>(make: (id: number) => T, page: number): ListPage<T> {
  if (listFails) throw new Error("TMDb down");
  return {
    page,
    results: Array.from({ length: pageSize }, (_, i) => make(i + 1)),
    totalPages: 5,
    totalResults: 682,
  };
}

const loadEraAnimeList = vi.fn(
  async (_e: unknown, page: number, _sort: string) => listOf(anime, page),
);
const loadEraMovieList = vi.fn(
  async (_e: unknown, page: number, _sort: string) => listOf(movie, page),
);

vi.mock("@/lib/era-list", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/era-list")>()),
  loadEraAnimeList: (e: unknown, p: number, s: string) =>
    loadEraAnimeList(e, p, s),
  loadEraMovieList: (e: unknown, p: number, s: string) =>
    loadEraMovieList(e, p, s),
}));

/** 偶数 id だけ Netflix で配信中 */
const getAnimeWatchProviders = vi.fn(async (id: number) =>
  providers(id % 2 === 0 ? "Netflix" : "Hulu"),
);
const getMovieWatchProviders = vi.fn(async (id: number) =>
  providers(id % 2 === 0 ? "Netflix" : "Hulu"),
);
/** 旧実装のタイトル検索。呼ばれたら q= を読んでいる */
const searchTVByPage = vi.fn();

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getAnimeWatchProviders: (id: number) => getAnimeWatchProviders(id),
  getMovieWatchProviders: (id: number) => getMovieWatchProviders(id),
  searchTVByPage: (...a: unknown[]) => searchTVByPage(...a),
}));

// 旧実装はここで 10/16/20 件に切っていた。読まれても 10 を返して切り捨てを炙り出す
vi.mock("@/lib/request-device", () => ({
  requestItemsPerPage: async () => 10,
}));

const { default: AnimeEraPage } =
  await import("@/app/browse/era/[decade]/page");
const { default: MovieEraPage } =
  await import("@/app/browse/movies/era/[decade]/page");

afterEach(() => {
  cleanup();
  loadEraAnimeList.mockClear();
  loadEraMovieList.mockClear();
  getAnimeWatchProviders.mockClear();
  getMovieWatchProviders.mockClear();
  searchTVByPage.mockClear();
  listFails = false;
  pageSize = IDS.length;
});

const MEDIA = [
  {
    label: "アニメ",
    base: "/browse/era",
    other: "/browse/movies/era",
    Page: AnimeEraPage,
    load: loadEraAnimeList,
    cardPrefix: "/anime/",
    providers: getAnimeWatchProviders,
  },
  {
    label: "アニメ映画",
    base: "/browse/movies/era",
    other: "/browse/era",
    Page: MovieEraPage,
    load: loadEraMovieList,
    cardPrefix: "/movie/",
    providers: getMovieWatchProviders,
  },
] as const;

type Media = (typeof MEDIA)[number];

async function renderPage(
  m: Media,
  decade: string,
  sp: Record<string, string>,
) {
  render(
    await m.Page({
      params: Promise.resolve({ decade }),
      searchParams: Promise.resolve(sp),
    }),
  );
}

/** href が prefix で始まるリンク（フィルターを外すのが役目の「絞り込みを解除」は除く） */
function linksStartingWith(prefix: string): string[] {
  return [...document.querySelectorAll<HTMLAnchorElement>("a[href]")]
    .filter((a) => a.textContent !== "絞り込みを解除")
    .map((a) => a.getAttribute("href") ?? "")
    .filter((h) => h.startsWith(prefix));
}

function shownIds(prefix: string): number[] {
  return [
    ...document.querySelectorAll<HTMLAnchorElement>(`a[href^="${prefix}"]`),
  ]
    .map((a) => Number(a.getAttribute("href")?.split("/")[2]))
    .filter((id, i, arr) => arr.indexOf(id) === i);
}

function pageLinks(m: Media, decade: number): string[] {
  return linksStartingWith(`${m.base}/${decade}?`).filter((h) =>
    h.includes("page="),
  );
}

describe.each(MEDIA)("年代の一覧（$label）", (m) => {
  it("見出しに年代と件数を出す", async () => {
    await renderPage(m, "1990", {});

    expect(document.querySelector("h1")?.textContent).toContain("1990年代");
    expect(document.body.textContent).toContain("682件");
    expect(m.load.mock.calls[0][0]).toMatchObject({ decade: 1990 });
  });

  it("1 ページの作品を端末別の件数で切り捨てない（70 件のまま出す）", async () => {
    pageSize = 70;
    await renderPage(m, "1990", {});

    expect(shownIds(m.cardPrefix)).toHaveLength(70);
  });

  it("ページ番号と並び替えを検証して取得に渡す（初期値は新しい順・人気順は無い）", async () => {
    await renderPage(m, "1990", {});
    expect(m.load).toHaveBeenLastCalledWith(expect.anything(), 1, "year_desc");

    await renderPage(m, "1990", { page: "3", sort: "year_asc" });
    expect(m.load).toHaveBeenLastCalledWith(expect.anything(), 3, "year_asc");

    // 旧実装の値（popular / date）も TMDb の sort_by も受け付けない
    for (const sort of ["popular", "date", "popularity.desc"]) {
      await renderPage(m, "1990", { page: "99999", sort });
      expect(m.load).toHaveBeenLastCalledWith(
        expect.anything(),
        500,
        "year_desc",
      );
    }
  });

  it("タイトル検索ボックスは無く、q= は読まない", async () => {
    await renderPage(m, "1990", { q: "作品" });

    expect(document.querySelector('input[name="q"]')).toBeNull();
    expect(screen.queryByRole("link", { name: "クリア" })).toBeNull();
    expect(searchTVByPage).not.toHaveBeenCalled();
    expect(m.load).toHaveBeenCalledTimes(1);
    expect(shownIds(m.cardPrefix)).toEqual(IDS);
    expect(linksStartingWith(`${m.base}/`).some((h) => h.includes("q="))).toBe(
      false,
    );
  });

  it("人気順の並び替えは出さない", async () => {
    await renderPage(m, "1990", {});

    expect(document.body.textContent).not.toContain("人気順");
  });

  it("アニメ ⇄ アニメ映画の切り替え: 同じ年代の一覧へ、並び替えと絞り込みを引き継いでリンクする", async () => {
    await renderPage(m, "1980", {
      sort: "year_asc",
      page: "4",
      genre: "35",
      service: "netflix",
    });

    const tabs = screen.getByRole("navigation", { name: "作品の種類" });
    const current = tabs.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe(m.label);
    const otherLink = [...tabs.querySelectorAll("a")].find(
      (a) => a.getAttribute("aria-current") !== "page",
    );
    // ページ番号は引き継がない（件数が違うので同じページは別物）
    expect(otherLink?.getAttribute("href")).toBe(
      `${m.other}/1980?sort=year_asc&genre=35&service=netflix`,
    );
  });

  it("並び替えのリンク: 現在の並びを示し、絞り込みを残して 1 ページ目に戻る", async () => {
    await renderPage(m, "1990", { genre: "35", service: "netflix", page: "3" });

    const sorts = screen.getByRole("navigation", { name: "並び替え" });
    const links = [...sorts.querySelectorAll("a")];
    expect(links.map((a) => a.textContent)).toEqual([
      expect.stringContaining("新しい順"),
      expect.stringContaining("古い順"),
    ]);
    expect(links[0].getAttribute("aria-current")).toBe("page");
    expect(links[0].getAttribute("href")).toBe(
      `${m.base}/1990?genre=35&service=netflix`,
    );
    expect(links[1].getAttribute("href")).toBe(
      `${m.base}/1990?sort=year_asc&genre=35&service=netflix`,
    );
  });

  it("フィルター: ジャンルと配信サービスを選べる。並び替えは隠しフィールドで引き継ぐ", async () => {
    await renderPage(m, "1990", { sort: "year_asc" });

    const form = screen.getByRole("search");
    expect(form.getAttribute("action")).toBe(`${m.base}/1990`);
    expect(form.querySelector('select[name="genre"]')).not.toBeNull();
    expect(form.querySelector('select[name="service"]')).not.toBeNull();
    expect(
      form.querySelector<HTMLInputElement>('input[type="hidden"][name="sort"]')
        ?.value,
    ).toBe("year_asc");
  });

  it("並び替えが初期値なら隠しフィールドを付けない", async () => {
    await renderPage(m, "1990", {});

    expect(
      screen.getByRole("search").querySelector('input[name="sort"]'),
    ).toBeNull();
  });

  it("ジャンル・配信サービスはそのページで取得済みの作品の中だけで絞る", async () => {
    await renderPage(m, "1990", { genre: "35", service: "netflix" });

    // コメディ（1〜3）かつ Netflix（偶数）= 2 だけ
    expect(shownIds(m.cardPrefix)).toEqual([2]);
    expect(document.body.textContent).toContain("6 件中 1 件を表示中");
    expect(m.load).toHaveBeenCalledTimes(1);
  });

  it("ジャンルだけでも絞れる", async () => {
    await renderPage(m, "1990", { genre: "18" });

    expect(shownIds(m.cardPrefix)).toEqual([4, 5, 6]);
    expect(m.providers).not.toHaveBeenCalled();
  });

  it("選択肢に無い絞り込みの値は無視して全件出す", async () => {
    await renderPage(m, "1990", { genre: "<script>", service: "crunchyroll" });

    expect(shownIds(m.cardPrefix)).toEqual(IDS);
    expect(m.providers).not.toHaveBeenCalled();
  });

  it("ページ送りのリンクに並び替えと絞り込みを引き継ぐ", async () => {
    await renderPage(m, "1990", {
      page: "2",
      sort: "year_asc",
      genre: "18",
      service: "netflix",
    });

    const links = pageLinks(m, 1990);
    expect(links.length).toBeGreaterThan(0);
    for (const href of links) {
      expect(href).toContain("sort=year_asc");
      expect(href).toContain("genre=18");
      expect(href).toContain("service=netflix");
    }
  });

  it("他の年代へのリンクは同じ種類（アニメ / 映画）の一覧へ、並び替えを引き継ぐ", async () => {
    await renderPage(m, "1990", { sort: "year_asc" });

    const links = linksStartingWith(`${m.base}/`);
    for (const e of ANIME_ERAS.filter((e) => e.decade !== 1990)) {
      expect(links).toContain(`${m.base}/${e.decade}?sort=year_asc`);
    }
  });

  it("取得に失敗したらエラーを出す（ページは落とさない）", async () => {
    listFails = true;
    await renderPage(m, "1990", {});

    expect(document.body.textContent).toContain("データの取得に失敗しました");
    expect(document.body.textContent).not.toMatch(/件中/);
  });

  it("定義に無い年代は 404", async () => {
    await expect(renderPage(m, "1950", {})).rejects.toThrow();
    await expect(renderPage(m, "1995", {})).rejects.toThrow();
    await expect(renderPage(m, "abc", {})).rejects.toThrow();
    await expect(renderPage(m, "1990abc", {})).rejects.toThrow();
    expect(m.load).not.toHaveBeenCalled();
  });
});
