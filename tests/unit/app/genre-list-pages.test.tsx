import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type {
  TMDbAnime,
  TMDbMovie,
  TMDbWatchProvidersResponse,
} from "@/types/tmdb";
import type { ListPage } from "@/lib/list-page";
import { ANIME_GENRES } from "@/lib/genres";

/**
 * ジャンルの一覧（#99）。アニメ（/browse/genre/[id]）とアニメ映画
 * （/browse/movies/genre/[id]）は同じ作りで、相互に切り替えられる。
 *
 * 取得の組み立ては `tests/unit/lib/genre-list.test.ts` が受け持つ。
 * `@/lib/genre-list` / `@/lib/tmdb` / `@/lib/request-device` は自前の lib なのでモックする。
 */

function anime(id: number): TMDbAnime {
  return {
    id,
    name: `作品${id}`,
    original_name: `Work ${id}`,
    overview: "",
    poster_path: `/p${id}.jpg`,
    backdrop_path: null,
    first_air_date: "2026-01-01",
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
    release_date: "2026-01-01",
    vote_average: 7,
    vote_count: 0,
    genre_ids: [16, id <= 3 ? 35 : 28],
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
    totalResults: 330,
  };
}

const loadGenreAnimeList = vi.fn(
  async (_g: unknown, page: number, _sort: string) => listOf(anime, page),
);
const loadGenreMovieList = vi.fn(
  async (_g: unknown, page: number, _sort: string) => listOf(movie, page),
);

vi.mock("@/lib/genre-list", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/genre-list")>()),
  loadGenreAnimeList: (g: unknown, p: number, s: string) =>
    loadGenreAnimeList(g, p, s),
  loadGenreMovieList: (g: unknown, p: number, s: string) =>
    loadGenreMovieList(g, p, s),
}));

/** 偶数 id だけ Netflix で配信中 */
const getAnimeWatchProviders = vi.fn(async (id: number) =>
  providers(id % 2 === 0 ? "Netflix" : "Hulu"),
);
const getMovieWatchProviders = vi.fn(async (id: number) =>
  providers(id % 2 === 0 ? "Netflix" : "Hulu"),
);

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getAnimeWatchProviders: (id: number) => getAnimeWatchProviders(id),
  getMovieWatchProviders: (id: number) => getMovieWatchProviders(id),
}));

// 旧実装はここで 10/16/20 件に切っていた。読まれても 10 を返して切り捨てを炙り出す
vi.mock("@/lib/request-device", () => ({
  requestItemsPerPage: async () => 10,
}));

const { default: AnimeGenrePage } =
  await import("@/app/browse/genre/[genreId]/page");
const { default: MovieGenrePage } =
  await import("@/app/browse/movies/genre/[genreId]/page");

afterEach(() => {
  cleanup();
  loadGenreAnimeList.mockClear();
  loadGenreMovieList.mockClear();
  getAnimeWatchProviders.mockClear();
  getMovieWatchProviders.mockClear();
  listFails = false;
  pageSize = IDS.length;
});

const MEDIA = [
  {
    label: "アニメ",
    base: "/browse/genre",
    other: "/browse/movies/genre",
    Page: AnimeGenrePage,
    load: loadGenreAnimeList,
    cardPrefix: "/anime/",
    providers: getAnimeWatchProviders,
  },
  {
    label: "アニメ映画",
    base: "/browse/movies/genre",
    other: "/browse/genre",
    Page: MovieGenrePage,
    load: loadGenreMovieList,
    cardPrefix: "/movie/",
    providers: getMovieWatchProviders,
  },
] as const;

type Media = (typeof MEDIA)[number];

async function renderPage(
  m: Media,
  genreId: string,
  sp: Record<string, string>,
) {
  render(
    await m.Page({
      params: Promise.resolve({ genreId }),
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

function pageLinks(m: Media, genreId: number): string[] {
  return linksStartingWith(`${m.base}/${genreId}?`).filter((h) =>
    h.includes("page="),
  );
}

describe.each(MEDIA)("ジャンルの一覧（$label）", (m) => {
  it("見出しにジャンル名と件数を出す", async () => {
    await renderPage(m, "35", {});

    expect(document.querySelector("h1")?.textContent).toContain("コメディ");
    expect(document.body.textContent).toContain("330件");
    expect(m.load.mock.calls[0][0]).toMatchObject({ id: 35 });
  });

  it("1 ページの作品を端末別の件数で切り捨てない（70 件のまま出す）", async () => {
    pageSize = 70;
    await renderPage(m, "35", {});

    expect(shownIds(m.cardPrefix)).toHaveLength(70);
  });

  it("ページ番号と並び替えを検証して取得に渡す（初期値は新しい順）", async () => {
    await renderPage(m, "35", {});
    expect(m.load).toHaveBeenLastCalledWith(expect.anything(), 1, "year_desc");

    await renderPage(m, "35", { page: "3", sort: "year_asc" });
    expect(m.load).toHaveBeenLastCalledWith(expect.anything(), 3, "year_asc");

    await renderPage(m, "35", { page: "99999", sort: "popularity.desc" });
    expect(m.load).toHaveBeenLastCalledWith(
      expect.anything(),
      500,
      "year_desc",
    );
  });

  it("アニメ ⇄ アニメ映画の切り替え: 同じジャンル ID の一覧へ、並び替えと配信サービスを引き継いでリンクする", async () => {
    await renderPage(m, "9002", {
      sort: "year_asc",
      page: "4",
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
      `${m.other}/9002?sort=year_asc&service=netflix`,
    );
  });

  it("並び替えのリンク: 現在の並びを示し、配信サービスの絞り込みを残して 1 ページ目に戻る", async () => {
    await renderPage(m, "35", { service: "netflix", page: "3" });

    const sorts = screen.getByRole("navigation", { name: "並び替え" });
    const links = [...sorts.querySelectorAll("a")];
    expect(links.map((a) => a.textContent)).toEqual([
      expect.stringContaining("新しい順"),
      expect.stringContaining("古い順"),
    ]);
    expect(links[0].getAttribute("aria-current")).toBe("page");
    expect(links[0].getAttribute("href")).toBe(`${m.base}/35?service=netflix`);
    expect(links[1].getAttribute("href")).toBe(
      `${m.base}/35?sort=year_asc&service=netflix`,
    );
  });

  it("フィルター: ジャンル選択は出さず配信サービスだけ。並び替えは隠しフィールドで引き継ぐ", async () => {
    await renderPage(m, "35", { sort: "year_asc" });

    const form = screen.getByRole("search");
    expect(form.getAttribute("action")).toBe(`${m.base}/35`);
    expect(form.querySelector('[name="genre"]')).toBeNull();
    expect(form.querySelector('select[name="service"]')).not.toBeNull();
    expect(
      form.querySelector<HTMLInputElement>('input[type="hidden"][name="sort"]')
        ?.value,
    ).toBe("year_asc");
  });

  it("並び替えが初期値なら隠しフィールドを付けない", async () => {
    await renderPage(m, "35", {});

    expect(
      screen.getByRole("search").querySelector('input[name="sort"]'),
    ).toBeNull();
  });

  it("配信サービスはそのページで取得済みの作品の中だけで絞る", async () => {
    await renderPage(m, "35", { service: "netflix" });

    expect(shownIds(m.cardPrefix)).toEqual([2, 4, 6]);
    expect(document.body.textContent).toContain("6 件中 3 件を表示中");
    expect(m.load).toHaveBeenCalledTimes(1);
  });

  it("URL の genre= は読まない（#87）", async () => {
    await renderPage(m, "10759", { genre: "35" });

    expect(shownIds(m.cardPrefix)).toEqual(IDS);
    expect(m.providers).not.toHaveBeenCalled();
  });

  it("ページ送りのリンクに並び替えと配信サービスを引き継ぎ、genre= は付けない", async () => {
    await renderPage(m, "35", {
      page: "2",
      sort: "year_asc",
      service: "netflix",
      genre: "18",
    });

    const links = pageLinks(m, 35);
    expect(links.length).toBeGreaterThan(0);
    for (const href of links) {
      expect(href).toContain("sort=year_asc");
      expect(href).toContain("service=netflix");
      expect(href).not.toContain("genre=");
    }
  });

  it("他のジャンルへのリンクは同じ種類（アニメ / 映画）の一覧へ、並び替えを引き継ぐ", async () => {
    await renderPage(m, "35", { sort: "year_asc" });

    const links = linksStartingWith(`${m.base}/`);
    for (const g of ANIME_GENRES.filter((g) => g.id !== 35)) {
      expect(links).toContain(`${m.base}/${g.id}?sort=year_asc`);
    }
  });

  it("取得に失敗したらエラーを出す（ページは落とさない）", async () => {
    listFails = true;
    await renderPage(m, "35", {});

    expect(document.body.textContent).toContain("データの取得に失敗しました");
  });

  it("定義に無いジャンル ID は 404", async () => {
    await expect(renderPage(m, "12345", {})).rejects.toThrow();
    await expect(renderPage(m, "abc", {})).rejects.toThrow();
    expect(m.load).not.toHaveBeenCalled();
  });
});
