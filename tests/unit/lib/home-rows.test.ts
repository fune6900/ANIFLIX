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
const getAnimeByKeyword = vi.fn();
const getAnimeByEra = vi.fn();
const fetchSeasonalAnime = vi.fn();

vi.mock("@/lib/tmdb", () => ({
  getAnimeByGenre: (...a: unknown[]) => getAnimeByGenre(...a),
  getAnimeByKeyword: (...a: unknown[]) => getAnimeByKeyword(...a),
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
  fetchSeasonRows,
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
  keywordIds: [237451, 213756],
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
  getAnimeByKeyword.mockReset();
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

  it("開始ページが 2 のときは 2・3 ページ目を取る", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    getAnimeByGenre.mockImplementation((_id: number, p: number) =>
      Promise.resolve(page(p * 100)),
    );

    const items = await fetchGenreRow(GENRE);

    const pages = getAnimeByGenre.mock.calls.map((c) => c[1]).sort();
    expect(pages).toEqual([2, 3]);
    expect(items).toHaveLength(30);
  });

  it("キーワードジャンルは固定のキーワード ID（同義語込み）で引く（#99）", async () => {
    getAnimeByKeyword.mockImplementation((_ids: number[], p: number) =>
      Promise.resolve(page(p * 100)),
    );

    const items = await fetchGenreRow(KEYWORD_GENRE);

    expect(getAnimeByKeyword).toHaveBeenCalledTimes(2);
    expect(getAnimeByKeyword.mock.calls[0][0]).toEqual([237451, 213756]);
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
  /**
   * 実物の fetchSeasonalAnime は limit を「TMDb と突き合わせる前の AniList 候補数」
   * に使う。TMDb に無い作品・劇場版・重複ヒットが後から落ちるため、items は
   * limit より少なく返る。ここではその目減りを再現する
   */
  function shrinkingSeasonal(lost: number) {
    return (_y: number, _s: string, opts: { limit: number }) =>
      Promise.resolve({
        items: Array.from({ length: Math.max(0, opts.limit - lost) }, (_, i) =>
          anime(i + 1),
        ),
      });
  }

  it("突き合わせで候補が目減りしても 30 件を満たす", async () => {
    fetchSeasonalAnime.mockImplementation(shrinkingSeasonal(15));

    const row = await fetchSeasonRow(2026, "spring");

    expect(row).toHaveLength(30);
  });

  it("人気順のまま返す（shuffle しない）", async () => {
    fetchSeasonalAnime.mockImplementation(shrinkingSeasonal(0));

    const row = await fetchSeasonRow(2026, "spring");

    expect(row.map((a) => a.id)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
  });

  it("失敗したら空配列", async () => {
    fetchSeasonalAnime.mockRejectedValue(new Error("AniList down"));

    await expect(fetchSeasonRow(2026, "spring")).resolves.toEqual([]);
  });
});

describe("fetchSeasonRows", () => {
  it("シーズンを 1 つずつ順に取る（AniList へ同時に投げない）", async () => {
    // キャッシュが冷えていると 1 シーズンで AniList を最大 8 回叩く。
    // 並列にすると現クールの取得まで 429 に巻き込まれる
    const resolvers: Array<() => void> = [];
    fetchSeasonalAnime.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(() => resolve({ items: [anime(1)] }));
        }),
    );

    const pending = fetchSeasonRows([
      { year: 2026, season: "spring" },
      { year: 2026, season: "winter" },
      { year: 2025, season: "fall" },
    ]);

    await Promise.resolve();
    expect(fetchSeasonalAnime).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 3; i++) {
      await vi.waitFor(() => expect(resolvers[i]).toBeDefined());
      resolvers[i]();
    }
    const rows = await pending;

    expect(fetchSeasonalAnime).toHaveBeenCalledTimes(3);
    expect(fetchSeasonalAnime.mock.calls.map((c) => c[1])).toEqual([
      "spring",
      "winter",
      "fall",
    ]);
    expect(rows).toHaveLength(3);
  });

  it("途中のシーズンが落ちても残りを取る", async () => {
    fetchSeasonalAnime
      .mockResolvedValueOnce({ items: [anime(1)] })
      .mockRejectedValueOnce(new Error("AniList down"))
      .mockResolvedValueOnce({ items: [anime(3)] });

    const rows = await fetchSeasonRows([
      { year: 2026, season: "spring" },
      { year: 2026, season: "winter" },
      { year: 2025, season: "fall" },
    ]);

    expect(rows.map((r) => r.map((a) => a.id))).toEqual([[1], [], [3]]);
  });
});
