import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TMDbAnime } from "@/types/tmdb";
import type { AnimeGenre } from "@/lib/genres";
import { ANIME_ERAS } from "@/lib/eras";

/**
 * ホームの「シーズン / 年代 / ジャンルで探す」の行を組み立てる。
 *
 * TMDb の 1 ページは 20 件なので、1 行 30 件を満たすには 2 ページ要る。
 * `@/lib/tmdb` / `@/lib/seasonal-anime` は自前の lib なのでモックしてよい。
 */

const getAnimeByGenre = vi.fn();
const getAnimeByKeywords = vi.fn();
const getAnimeByEra = vi.fn();
const fetchSeasonalAnime = vi.fn();

vi.mock("@/lib/tmdb", () => ({
  getAnimeByGenre: (...a: unknown[]) => getAnimeByGenre(...a),
  getAnimeByKeywords: (...a: unknown[]) => getAnimeByKeywords(...a),
  getAnimeByEra: (...a: unknown[]) => getAnimeByEra(...a),
}));

vi.mock("@/lib/seasonal-anime", () => ({
  fetchSeasonalAnime: (...a: unknown[]) => fetchSeasonalAnime(...a),
}));

const {
  HOME_ROW_SIZE,
  HOME_SEASON_ROW_COUNT,
  HOME_ERA_ROW_COUNT,
  pickHomeEras,
  fetchGenreRow,
  fetchEraRow,
  fetchSeasonRow,
} = await import("@/lib/home-rows");

function anime(id: number): TMDbAnime {
  return {
    id,
    name: `作品${id}`,
    original_name: `Work ${id}`,
    overview: "",
    poster_path: `/p${id}.jpg`,
    backdrop_path: `/b${id}.jpg`,
    first_air_date: "2020-01-01",
    vote_average: 7,
    vote_count: 10,
    genre_ids: [16],
    origin_country: ["JP"],
  };
}

/** start から 20 件の 1 ページ分 */
function page(start: number, size = 20) {
  return {
    page: 1,
    total_pages: 10,
    total_results: 200,
    results: Array.from({ length: size }, (_, i) => anime(start + i)),
  };
}

const GENRE: AnimeGenre = {
  id: 10759,
  filterType: "genre",
  name: "アクション・冒険",
  emoji: "⚔️",
  color: "",
};

const KEYWORD_GENRE: AnimeGenre = {
  id: 9001,
  filterType: "keyword",
  keyword: "isekai",
  extraKeywords: ["reincarnation"],
  name: "異世界転生",
  emoji: "🌀",
  color: "",
};

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  getAnimeByGenre.mockReset();
  getAnimeByKeywords.mockReset();
  getAnimeByEra.mockReset();
  fetchSeasonalAnime.mockReset();
});

describe("定数", () => {
  it("1 行 30 件・シーズン 4 行・年代 3 行", () => {
    expect(HOME_ROW_SIZE).toBe(30);
    expect(HOME_SEASON_ROW_COUNT).toBe(4);
    expect(HOME_ERA_ROW_COUNT).toBe(3);
  });
});

describe("pickHomeEras", () => {
  it("新しい年代から順に指定数だけ返す", () => {
    const eras = pickHomeEras(3);

    expect(eras.map((e) => e.decade)).toEqual([2020, 2010, 2000]);
  });

  it("元の ANIME_ERAS の並びを壊さない", () => {
    const before = ANIME_ERAS.map((e) => e.decade);

    pickHomeEras(3);

    expect(ANIME_ERAS.map((e) => e.decade)).toEqual(before);
  });
});

describe("fetchGenreRow", () => {
  it("TMDb ジャンルは連続 2 ページを取り、30 件に揃える", async () => {
    getAnimeByGenre.mockImplementation((_id: number, p: number) =>
      Promise.resolve(page(p * 100)),
    );

    const items = await fetchGenreRow(GENRE);

    expect(getAnimeByGenre).toHaveBeenCalledTimes(2);
    const pages = getAnimeByGenre.mock.calls.map((c) => c[1]).sort();
    expect(pages).toEqual([1, 2]);
    expect(getAnimeByGenre.mock.calls.every((c) => c[0] === 10759)).toBe(true);
    expect(items).toHaveLength(30);
  });

  it("キーワードジャンルは追加キーワードも含めて引く", async () => {
    getAnimeByKeywords.mockImplementation((_kw: string[], p: number) =>
      Promise.resolve(page(p * 100)),
    );

    const items = await fetchGenreRow(KEYWORD_GENRE);

    expect(getAnimeByKeywords).toHaveBeenCalledTimes(2);
    expect(getAnimeByKeywords.mock.calls[0][0]).toEqual([
      "isekai",
      "reincarnation",
    ]);
    expect(items).toHaveLength(30);
  });

  it("2 ページにまたがる重複は 1 件にまとめる", async () => {
    // TMDb は人気順のページングで境界の作品が重複して返ることがある
    getAnimeByGenre
      .mockResolvedValueOnce(page(1))
      .mockResolvedValueOnce(page(11));

    const items = await fetchGenreRow(GENRE);
    const ids = items.map((a) => a.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(30);
  });

  it("片方のページが落ちても残りで返す", async () => {
    getAnimeByGenre
      .mockResolvedValueOnce(page(1))
      .mockRejectedValueOnce(new Error("TMDb down"));

    const items = await fetchGenreRow(GENRE);

    expect(items).toHaveLength(20);
  });

  it("両方落ちたら空配列（ホーム全体を落とさない）", async () => {
    getAnimeByGenre.mockRejectedValue(new Error("TMDb down"));

    await expect(fetchGenreRow(GENRE)).resolves.toEqual([]);
  });
});

describe("fetchEraRow", () => {
  it("その年代を連続 2 ページ取り、30 件に揃える", async () => {
    getAnimeByEra.mockImplementation((_d: number, p: number) =>
      Promise.resolve(page(p * 100)),
    );

    const items = await fetchEraRow(2010);

    expect(getAnimeByEra).toHaveBeenCalledTimes(2);
    expect(getAnimeByEra.mock.calls.every((c) => c[0] === 2010)).toBe(true);
    expect(items).toHaveLength(30);
  });

  it("失敗したら空配列", async () => {
    getAnimeByEra.mockRejectedValue(new Error("TMDb down"));

    await expect(fetchEraRow(2010)).resolves.toEqual([]);
  });
});

describe("fetchSeasonRow", () => {
  it("AniList 一次ソースで 30 件を人気順のまま返す", async () => {
    const items = Array.from({ length: 30 }, (_, i) => anime(i + 1));
    fetchSeasonalAnime.mockResolvedValue({ items });

    const row = await fetchSeasonRow(2026, "spring");

    expect(fetchSeasonalAnime).toHaveBeenCalledWith(2026, "spring", {
      limit: 30,
    });
    expect(row.map((a) => a.id)).toEqual(items.map((a) => a.id));
  });

  it("30 件を超えて返ってきても 30 件で切る", async () => {
    const items = Array.from({ length: 45 }, (_, i) => anime(i + 1));
    fetchSeasonalAnime.mockResolvedValue({ items });

    await expect(fetchSeasonRow(2026, "spring")).resolves.toHaveLength(30);
  });

  it("失敗したら空配列", async () => {
    fetchSeasonalAnime.mockRejectedValue(new Error("AniList down"));

    await expect(fetchSeasonRow(2026, "spring")).resolves.toEqual([]);
  });
});
