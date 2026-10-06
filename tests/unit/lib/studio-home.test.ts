import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TMDbAnime, TMDbSearchResponse } from "@/types/tmdb";
import { ANIME_STUDIOS } from "@/lib/studios";
import { FEATURED_HERO_SIZE } from "@/lib/featured-rows";

/**
 * 制作会社ホーム（`/browse/studios`、#117）の行とカルーセルの組み立て。
 * `@/lib/tmdb` は自前の lib なのでモックする（fetch は素でモックしない）。
 */

interface AnimeInit {
  backdrop?: string | null;
  overview?: string;
}

function anime(id: number, init: AnimeInit = {}): TMDbAnime {
  return {
    id,
    name: `作品${id}`,
    original_name: `Anime ${id}`,
    overview: init.overview ?? "あらすじ",
    poster_path: `/p${id}.jpg`,
    backdrop_path: init.backdrop === undefined ? `/b${id}.jpg` : init.backdrop,
    first_air_date: "2020-04-01",
    vote_average: 8,
    vote_count: 100,
    genre_ids: [16],
    origin_country: ["JP"],
  };
}

function response(results: TMDbAnime[]): TMDbSearchResponse<TMDbAnime> {
  return {
    page: 1,
    total_pages: 3,
    total_results: results.length * 3,
    results,
  };
}

/** スタジオの並び順 i から作品 id を作る（スタジオ i の作品は i*100+0..） */
function worksOf(index: number, n = 20): TMDbAnime[] {
  return Array.from({ length: n }, (_, k) => anime(index * 100 + k));
}

function studioIndexOf(id: number): number {
  return ANIME_STUDIOS.findIndex((s) => s.id === id);
}

/** 作品 id → その作品を出したスタジオの並び順（テストデータの規則から逆算） */
function ownerOf(workId: number): number {
  return Math.floor(workId / 100);
}

/** 既定: 各社 20 件（TMDb 1 ページ分）+ 余分を 5 件付けて、切り詰めを確かめる */
const defaultImpl = async (companyId: number, _page?: number) =>
  response(worksOf(studioIndexOf(companyId), 25));

// `@/lib/featured-rows` を静的に読むと `@/lib/tmdb` まで辿るため、モックは巻き上げて作る
const { getAnimeByStudio } = vi.hoisted(() => ({
  getAnimeByStudio:
    vi.fn<
      (
        companyId: number,
        page?: number,
      ) => Promise<TMDbSearchResponse<TMDbAnime>>
    >(),
}));

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb")>();
  return { ...actual, getAnimeByStudio };
});

const { loadStudioHome, STUDIO_ROW_SIZE, STUDIO_ROW_MIN_WORKS } =
  await import("@/lib/studio-home");

beforeEach(() => {
  getAnimeByStudio.mockReset();
  getAnimeByStudio.mockImplementation(defaultImpl);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadStudioHome: 行", () => {
  it("全スタジオを TMDb 1 ページ目で 1 回ずつ引く（26 社 = 26 回）", async () => {
    await loadStudioHome();

    expect(getAnimeByStudio).toHaveBeenCalledTimes(ANIME_STUDIOS.length);
    const calledIds = getAnimeByStudio.mock.calls.map(([id]) => id);
    expect(new Set(calledIds)).toEqual(new Set(ANIME_STUDIOS.map((s) => s.id)));
    for (const [, page] of getAnimeByStudio.mock.calls) {
      expect(page).toBe(1);
    }
  });

  it("行は ANIME_STUDIOS と同順・同数で、各行は人気順のまま 20 件", async () => {
    const home = await loadStudioHome();

    expect(STUDIO_ROW_SIZE).toBe(20);
    expect(home.rows.map((r) => r.studio.id)).toEqual(
      ANIME_STUDIOS.map((s) => s.id),
    );
    for (const [i, row] of home.rows.entries()) {
      expect(
        row.anime.map((a) => a.id),
        row.studio.name,
      ).toEqual(worksOf(i, 20).map((a) => a.id));
    }
  });

  it("取得を並列に走らせる（前の社の応答を待たずに次の社を引く）", async () => {
    const resolvers: Array<() => void> = [];
    getAnimeByStudio.mockImplementation(
      (companyId: number) =>
        new Promise((resolve) => {
          resolvers.push(() =>
            resolve(response(worksOf(studioIndexOf(companyId)))),
          );
        }),
    );

    const pending = loadStudioHome();
    // 1 社も応答していない時点で全社の取得が始まっている
    await Promise.resolve();
    expect(getAnimeByStudio).toHaveBeenCalledTimes(ANIME_STUDIOS.length);

    for (const r of resolvers) r();
    await pending;
  });

  it("失敗した社の行だけ空になり、他の社とページは落ちない", async () => {
    const failing = new Set([ANIME_STUDIOS[0].id, ANIME_STUDIOS[3].id]);
    getAnimeByStudio.mockImplementation(async (companyId: number) => {
      if (failing.has(companyId)) throw new Error("TMDb 503");
      return response(worksOf(studioIndexOf(companyId)));
    });

    const home = await loadStudioHome();

    expect(home.rows).toHaveLength(ANIME_STUDIOS.length);
    for (const row of home.rows) {
      if (failing.has(row.studio.id)) {
        expect(row.anime, row.studio.name).toEqual([]);
      } else {
        expect(row.anime.length, row.studio.name).toBe(20);
      }
    }
    // 行は黙って消えるので、ログには残す
    expect(console.error).toHaveBeenCalled();
  });

  it("全社が失敗しても例外を投げず、空の行と空のカルーセルを返す", async () => {
    getAnimeByStudio.mockRejectedValue(new Error("TMDb down"));

    const home = await loadStudioHome();

    expect(home.hero).toEqual([]);
    expect(home.rows.every((r) => r.anime.length === 0)).toBe(true);
  });
});

describe("loadStudioHome: 作品の少ない社", () => {
  it("下限は 5 件", () => {
    expect(STUDIO_ROW_MIN_WORKS).toBe(5);
  });

  it.each([1, 2, 3, 4])(
    "%i 件しかない社は行を空にし、カルーセルにも使わない",
    async (n) => {
      const sparse = ANIME_STUDIOS[0].id;
      getAnimeByStudio.mockImplementation(async (companyId: number) =>
        companyId === sparse
          ? response(worksOf(0, n))
          : response(worksOf(studioIndexOf(companyId))),
      );

      const home = await loadStudioHome();

      expect(home.rows[0].anime).toEqual([]);
      expect(home.rows.slice(1).every((r) => r.anime.length === 20)).toBe(true);
      expect(home.hero.some((a) => ownerOf(a.id) === 0)).toBe(false);
    },
  );

  it("ちょうど 5 件の社は行を出す", async () => {
    const sparse = ANIME_STUDIOS[0].id;
    getAnimeByStudio.mockImplementation(async (companyId: number) =>
      companyId === sparse
        ? response(worksOf(0, 5))
        : response(worksOf(studioIndexOf(companyId))),
    );

    const home = await loadStudioHome();

    expect(home.rows[0].anime.map((a) => a.id)).toEqual(
      worksOf(0, 5).map((a) => a.id),
    );
  });

  it("作品の少ない社しか無ければカルーセルは空", async () => {
    getAnimeByStudio.mockImplementation(async (companyId: number) =>
      response(worksOf(studioIndexOf(companyId), 4)),
    );

    const home = await loadStudioHome();

    expect(home.hero).toEqual([]);
    expect(home.rows.every((r) => r.anime.length === 0)).toBe(true);
  });
});

describe("loadStudioHome: カルーセル", () => {
  it("6 件。背景画像とあらすじのある作品だけ", async () => {
    // どの社も先頭 2 件はカルーセルに使えない
    getAnimeByStudio.mockImplementation(async (companyId: number) => {
      const i = studioIndexOf(companyId);
      return response([
        anime(i * 100, { backdrop: null }),
        anime(i * 100 + 1, { overview: "" }),
        ...worksOf(i).slice(2),
      ]);
    });

    const home = await loadStudioHome();

    expect(home.hero).toHaveLength(FEATURED_HERO_SIZE);
    for (const a of home.hero) {
      expect(a.backdrop_path, String(a.id)).toBeTruthy();
      expect(a.overview, String(a.id)).toBeTruthy();
      expect(a.id % 100, String(a.id)).toBeGreaterThanOrEqual(2);
    }
  });

  it("1 社に偏らず、6 社から 1 件ずつ選ぶ（各社の一番人気）", async () => {
    const home = await loadStudioHome();

    const owners = home.hero.map((a) => ownerOf(a.id));
    expect(new Set(owners).size).toBe(FEATURED_HERO_SIZE);
    for (const a of home.hero) {
      expect(a.id % 100, String(a.id)).toBe(0);
    }
  });

  it("毎回同じ 6 社に固定しない（社の順をシャッフルする）", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const a = (await loadStudioHome()).hero.map((x) => ownerOf(x.id));
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const b = (await loadStudioHome()).hero.map((x) => ownerOf(x.id));

    expect(a).not.toEqual(b);
  });

  it("共同制作で複数社に同じ作品があっても 1 回だけ出す", async () => {
    // 全社が同じ作品を一番人気に持ち、残りは各社の作品
    getAnimeByStudio.mockImplementation(async (companyId: number) =>
      response([anime(9999), ...worksOf(studioIndexOf(companyId), 19)]),
    );

    const home = await loadStudioHome();
    const ids = home.hero.map((a) => a.id);

    expect(ids.filter((id) => id === 9999)).toHaveLength(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(FEATURED_HERO_SIZE);
  });

  it("候補のある社が 6 社に満たなければ、各社の 2 番手以降で埋める", async () => {
    const withWorks = new Set([ANIME_STUDIOS[1].id, ANIME_STUDIOS[2].id]);
    getAnimeByStudio.mockImplementation(async (companyId: number) =>
      withWorks.has(companyId)
        ? response(worksOf(studioIndexOf(companyId)))
        : response([]),
    );

    const home = await loadStudioHome();
    const ids = home.hero.map((a) => a.id);

    expect(ids).toHaveLength(FEATURED_HERO_SIZE);
    expect(new Set(ids).size).toBe(FEATURED_HERO_SIZE);
    // 2 社から 3 件ずつ（片方に寄せない）
    const owners = ids.map(ownerOf);
    expect(owners.filter((o) => o === 1)).toHaveLength(3);
    expect(owners.filter((o) => o === 2)).toHaveLength(3);
  });
});
