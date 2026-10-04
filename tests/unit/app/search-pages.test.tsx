import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { TMDbAnime, TMDbMovie, TMDbPerson } from "@/types/tmdb";
import type { CharacterSearchResult } from "@/types/anilist";
import { searchResultsHref } from "@/lib/search-results";

/**
 * ヘッダー検索の結果画面 4 部門と、旧 URL の redirect（#101）。
 *
 * `@/lib/anime-search` / `@/lib/tmdb` / `@/lib/anilist` / `@/lib/annict` /
 * `@/lib/seasonal-*` は自前の lib なのでモックする（fetch は素でモックしない）。
 * `next/navigation` は例外 3（App Router のコンテキストに依存するため）。
 * `redirect()` は本物と同じく throw させ、遷移先を捕まえる。
 */

class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

function anime(id: number): TMDbAnime {
  return {
    id,
    name: `アニメ${id}`,
    original_name: `Anime ${id}`,
    overview: "",
    poster_path: `/p${id}.jpg`,
    backdrop_path: `/b${id}.jpg`,
    first_air_date: "2024-04-01",
    vote_average: 8,
    vote_count: 10,
    genre_ids: [16],
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
    backdrop_path: `/b${id}.jpg`,
    release_date: "2024-09-01",
    vote_average: 7.5,
    vote_count: 10,
    genre_ids: [16],
  };
}

function person(id: number, originalName: string): TMDbPerson {
  return {
    id,
    name: `声優${id}`,
    original_name: originalName,
    profile_path: null,
    known_for_department: "Acting",
    popularity: 10,
    known_for: [],
  };
}

const character: CharacterSearchResult = {
  id: 77,
  name: "竈門炭治郎",
  characterImageUrl: null,
  work: { aniListId: 1, title: "鬼滅の刃", posterUrl: null, seasonYear: 2019 },
  voiceActor: { id: 5, name: "花江夏樹" },
};

const searchAnimeKeyword = vi.fn(async (_q: string, _page: number) => ({
  results: [anime(1), anime(2)],
  totalResults: 40,
  totalPages: 2,
}));
const searchMovieKeyword = vi.fn(async (_q: string) => ({
  results: [movie(10)],
  totalResults: 1,
  totalPages: 1,
}));
const searchPerson = vi.fn(async (_q: string, _page: number) => ({
  page: 1,
  total_pages: 3,
  total_results: 60,
  results: [person(100, "はなえなつき"), person(101, "John Smith")],
}));
const searchAniListCharacters = vi.fn(async (_q: string) => [character]);

vi.mock("@/lib/anime-search", () => ({
  searchAnimeKeyword: (q: string, page: number) => searchAnimeKeyword(q, page),
  searchMovieKeyword: (q: string) => searchMovieKeyword(q),
}));

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb")>();
  return {
    ...actual,
    searchPerson: (q: string, page: number) => searchPerson(q, page),
  };
});

vi.mock("@/lib/anilist", () => ({
  searchAniListCharacters: (q: string) => searchAniListCharacters(q),
}));

vi.mock("@/lib/annict", () => ({
  searchAnnictCharacterByName: async () => null,
}));

vi.mock("@/lib/seasonal-anime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seasonal-anime")>();
  return { ...actual, fetchSeasonalAnime: async () => ({ items: [] }) };
});

vi.mock("@/lib/seasonal-cast", () => ({
  aggregateSeasonalCast: async () => [],
}));

// 声優ページの行（#102）。中身は tests/unit/lib/voice-actor-home.test.ts が見る
vi.mock("@/lib/voice-actor-home", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/voice-actor-home")>();
  return {
    ...actual,
    loadVoiceActorHome: async () => ({ hero: [], rows: [] }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

type Params = Record<string, string>;
type Page = (props: {
  searchParams: Promise<Params>;
}) => Promise<React.ReactElement>;

async function renderPage(page: Page, params: Params): Promise<HTMLElement> {
  const { container } = render(
    await page({ searchParams: Promise.resolve(params) }),
  );
  const dom = container.cloneNode(true) as HTMLElement; // cloneNode の戻り値は Node 型
  cleanup();
  return dom;
}

/** ページを呼び、redirect されればその遷移先を返す。されなければ null */
async function redirectOf(
  page: (props: { searchParams: Promise<Params> }) => Promise<unknown>,
  params: Params,
): Promise<string | null> {
  try {
    await page({ searchParams: Promise.resolve(params) });
    return null;
  } catch (e) {
    if (e instanceof RedirectSignal) return e.to;
    throw e;
  }
}

function hrefs(root: ParentNode): string[] {
  return [...root.querySelectorAll<HTMLAnchorElement>("a[href]")].map(
    (a) => a.getAttribute("href") ?? "",
  );
}

function h1(root: HTMLElement): string {
  return root.querySelector("h1")?.textContent ?? "";
}

const { default: AnimeSearchPage } = await import("@/app/search/anime/page");
const { default: MovieSearchPage } = await import("@/app/search/movies/page");
const { default: VoiceActorSearchPage } =
  await import("@/app/search/voice-actors/page");
const { default: CharacterSearchPage } =
  await import("@/app/search/characters/page");
const { default: LegacySearchPage } = await import("@/app/search/page");
const { default: MoviesPage } = await import("@/app/browse/movies/page");
const { default: VoiceActorsPage } = await import("@/app/voice-actors/page");

describe("/search/anime", () => {
  it("キーワードでアニメを検索し、作品の詳細へ飛ぶカードを並べる", async () => {
    const dom = await renderPage(AnimeSearchPage, { q: "進撃" });

    expect(h1(dom)).toBe("「進撃」の検索結果");
    expect(searchAnimeKeyword).toHaveBeenCalledWith("進撃", 1);
    expect(hrefs(dom)).toContain("/anime/1");
    expect(hrefs(dom)).toContain(searchResultsHref("anime", "進撃", 2));
  });

  it("キーワードはサニタイズしてから検索する", async () => {
    const dom = await renderPage(AnimeSearchPage, { q: " <b>進撃</b>\"' " });

    expect(searchAnimeKeyword).toHaveBeenCalledWith("進撃", 1);
    expect(h1(dom)).toBe("「進撃」の検索結果");
  });

  it("page は範囲検証してから渡す", async () => {
    await renderPage(AnimeSearchPage, { q: "進撃", page: "abc" });
    expect(searchAnimeKeyword).toHaveBeenLastCalledWith("進撃", 1);

    await renderPage(AnimeSearchPage, { q: "進撃", page: "99999" });
    const [, page] = searchAnimeKeyword.mock.lastCall ?? [];
    expect(page).toBeLessThanOrEqual(500);
  });

  it("キーワードが無ければ検索しない（入力欄も置かない）", async () => {
    const dom = await renderPage(AnimeSearchPage, {});

    expect(searchAnimeKeyword).not.toHaveBeenCalled();
    expect(dom.querySelector("input")).toBeNull();
  });

  it("検索が失敗したらエラーを出す", async () => {
    searchAnimeKeyword.mockRejectedValueOnce(new Error("boom"));
    const dom = await renderPage(AnimeSearchPage, { q: "進撃" });

    expect(dom.textContent).toContain("検索中にエラーが発生しました");
  });
});

describe("/search/movies", () => {
  it("キーワードでアニメ映画を検索し、映画の詳細へ飛ぶ", async () => {
    const dom = await renderPage(MovieSearchPage, { q: "君の名は" });

    expect(h1(dom)).toBe("「君の名は」の検索結果");
    expect(searchMovieKeyword).toHaveBeenCalledWith("君の名は");
    expect(hrefs(dom)).toContain("/movie/10");
  });
});

describe("/search/voice-actors", () => {
  it("日本の声優だけを残し、声優の詳細へ飛ぶ", async () => {
    const dom = await renderPage(VoiceActorSearchPage, {
      q: "花江",
      page: "2",
    });

    expect(h1(dom)).toBe("「花江」の検索結果");
    expect(searchPerson).toHaveBeenCalledWith("花江", 2);
    expect(hrefs(dom)).toContain("/voice-actors/100");
    expect(hrefs(dom)).not.toContain("/voice-actors/101");
    expect(hrefs(dom)).toContain(searchResultsHref("voice-actors", "花江", 3));
  });
});

describe("/search/voice-actors の page 検証", () => {
  it.each([
    ["abc", 1],
    ["0", 1],
    ["-3", 1],
    ["99999", 500],
  ])(
    "page=%s は %i として渡す（1〜TMDB_MAX_PAGE に収める）",
    async (raw, expected) => {
      await renderPage(VoiceActorSearchPage, { q: "花江", page: raw });

      expect(searchPerson).toHaveBeenLastCalledWith("花江", expected);
    },
  );

  it("page が無ければ 1", async () => {
    await renderPage(VoiceActorSearchPage, { q: "花江" });

    expect(searchPerson).toHaveBeenLastCalledWith("花江", 1);
  });
});

describe("/search/characters", () => {
  it("キャラを検索し、キャラの詳細へ飛ぶ（ページ内の入力欄は無い）", async () => {
    const dom = await renderPage(CharacterSearchPage, { q: "炭治郎" });

    expect(h1(dom)).toBe("「炭治郎」の検索結果");
    expect(searchAniListCharacters).toHaveBeenCalledWith("炭治郎");
    expect(hrefs(dom)).toContain("/characters/77");
    expect(dom.querySelector("input")).toBeNull();
  });
});

describe("4 部門で同じ部門タブを出す", () => {
  it.each([
    ["anime", AnimeSearchPage],
    ["movies", MovieSearchPage],
    ["voice-actors", VoiceActorSearchPage],
    ["characters", CharacterSearchPage],
  ] as const)("%s", async (_slug, page) => {
    const dom = await renderPage(page, { q: "x" });
    const nav = dom.querySelector('nav[aria-label="検索部門"]');

    expect(nav).not.toBeNull();
    expect(hrefs(nav ?? dom)).toEqual([
      searchResultsHref("anime", "x"),
      searchResultsHref("movies", "x"),
      searchResultsHref("voice-actors", "x"),
      searchResultsHref("characters", "x"),
    ]);
  });
});

describe("旧 URL の redirect", () => {
  it("/search?q= → /search/anime?q=", async () => {
    expect(await redirectOf(LegacySearchPage, { q: "進撃" })).toBe(
      searchResultsHref("anime", "進撃"),
    );
  });

  it("/search?q= の q もサニタイズする", async () => {
    expect(await redirectOf(LegacySearchPage, { q: "<i>進撃</i>" })).toBe(
      searchResultsHref("anime", "進撃"),
    );
  });

  it("/search（キーワード無し・旧フィルターモード）はトップへ", async () => {
    expect(await redirectOf(LegacySearchPage, {})).toBe("/");
    expect(
      await redirectOf(LegacySearchPage, { mode: "filter", genre: "16" }),
    ).toBe("/");
  });

  it("/browse/movies?q= → /search/movies?q=", async () => {
    expect(await redirectOf(MoviesPage, { q: "君の名は" })).toBe(
      searchResultsHref("movies", "君の名は"),
    );
  });

  it("/voice-actors?q= → /search/voice-actors?q=", async () => {
    expect(await redirectOf(VoiceActorsPage, { q: "花江" })).toBe(
      searchResultsHref("voice-actors", "花江"),
    );
  });

  it("/voice-actors（キーワード無し）は redirect せず、検索欄の無い一覧を出す", async () => {
    expect(await redirectOf(VoiceActorsPage, {})).toBeNull();

    const dom = await renderPage(VoiceActorsPage, {});
    expect(dom.querySelector("input")).toBeNull();
    expect(dom.querySelector("form")).toBeNull();
    expect(searchPerson).not.toHaveBeenCalled();
  });
});
