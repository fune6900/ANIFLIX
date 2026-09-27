import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AniListMedia, AniListMediaPage } from "@/lib/anilist";
import type { TMDbAnime, TMDbMovie } from "@/types/tmdb";

/**
 * シーズン一覧の取得パイプライン。
 *
 * `@/lib/anilist` と `@/lib/tmdb` は自前の lib なのでモックしてよい
 * （`@.claude/rules/testing.md` の通常方針）。
 */

const getAniListSeasonAnime =
  vi.fn<
    (
      year: number,
      season: string,
      page: number,
      perPage: number,
    ) => Promise<AniListMediaPage>
  >();
const getAniListAnimeAiringInRange =
  vi.fn<
    (
      start: number,
      end: number,
      page: number,
      perPage: number,
    ) => Promise<AniListMediaPage>
  >();
const getAnimeBySeason = vi.fn();
const searchAnime = vi.fn();
const searchMovie = vi.fn();

vi.mock("@/lib/anilist", () => ({
  getAniListSeasonAnime: (...a: [number, string, number, number]) =>
    getAniListSeasonAnime(...a),
  getAniListAnimeAiringInRange: (...a: [number, number, number, number]) =>
    getAniListAnimeAiringInRange(...a),
  toAniListSeason: (slug: string) => slug.toUpperCase(),
}));

vi.mock("@/lib/tmdb", () => ({
  getAnimeBySeason: (...a: unknown[]) => getAnimeBySeason(...a),
  searchAnime: (...a: unknown[]) => searchAnime(...a),
  searchMovie: (...a: unknown[]) => searchMovie(...a),
}));

const {
  fetchSeasonalAnime,
  isPerpetualLongRunner,
  toFuzzyDateInt,
  seasonBoundsToFuzzyInts,
} = await import("@/lib/seasonal-anime");

// ──────────────────────────────────────────
// フィクスチャ
// ──────────────────────────────────────────

let nextId = 1;

/** AniList の作品を組み立てる。指定しない項目は無害な既定値 */
function media(
  overrides: Omit<Partial<AniListMedia>, "title"> & { title?: string },
): AniListMedia {
  const { title, ...rest } = overrides;
  return {
    id: nextId++,
    idMal: null,
    title: { native: title ?? "作品", romaji: null, english: null },
    coverImage: { large: null, extraLarge: null, color: null },
    bannerImage: null,
    averageScore: null,
    popularity: 100,
    startDate: { year: 2026, month: 7, day: 1 },
    endDate: { year: 2026, month: 9, day: 30 },
    status: "FINISHED",
    format: "TV",
    episodes: 12,
    countryOfOrigin: "JP",
    isAdult: false,
    synonyms: [],
    siteUrl: "",
    ...rest,
  };
}

/** TMDb の作品。name が AniList のタイトルと突き合わされる */
function tmdb(id: number, name: string): TMDbAnime {
  return {
    id,
    name,
    original_name: name,
    overview: "",
    poster_path: null,
    backdrop_path: null,
    vote_average: 0,
    vote_count: 0,
    first_air_date: "2026-07-01",
    genre_ids: [],
    origin_country: ["JP"],
  };
}

function page(results: AniListMedia[], hasNextPage = false): AniListMediaPage {
  return {
    results,
    totalPages: 1,
    totalResults: results.length,
    hasNextPage,
  };
}

/** TMDb の映画 */
function movie(id: number, title: string): TMDbMovie {
  return {
    id,
    title,
    original_title: title,
    overview: "",
    poster_path: null,
    backdrop_path: null,
    release_date: "2026-07-01",
    vote_average: 0,
    vote_count: 0,
    genre_ids: [],
  };
}

/** TMDb プールを空にし、検索も空を返す既定状態 */
function emptyTmdb() {
  getAnimeBySeason.mockResolvedValue({ results: [] });
  searchAnime.mockResolvedValue({ results: [] });
  searchMovie.mockResolvedValue({ results: [] });
}

/** AniList のタイトルがそのまま TMDb にある状態にする */
function tmdbPoolFrom(names: string[]) {
  const pool = names.map((n, i) => tmdb(1000 + i, n));
  getAnimeBySeason.mockResolvedValue({ results: pool });
  searchAnime.mockResolvedValue({ results: [] });
  searchMovie.mockResolvedValue({ results: [] });
  return pool;
}

beforeEach(() => {
  nextId = 1;
  getAniListSeasonAnime.mockResolvedValue(page([]));
  getAniListAnimeAiringInRange.mockResolvedValue(page([]));
  emptyTmdb();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────
// 純粋関数
// ──────────────────────────────────────────

describe("toFuzzyDateInt", () => {
  it("年月日を YYYYMMDD の整数にする", () => {
    expect(toFuzzyDateInt({ year: 2026, month: 7, day: 1 })).toBe(20260701);
  });

  it("月日が欠けていても比較できる値にする", () => {
    expect(toFuzzyDateInt({ year: 2026, month: null, day: null })).toBe(
      20260101,
    );
  });

  it("年が無ければ null", () => {
    expect(toFuzzyDateInt({ year: null, month: 7, day: 1 })).toBeNull();
  });
});

describe("seasonBoundsToFuzzyInts", () => {
  it("境界を含められるよう前後に 1 だけ広げる", () => {
    // endDate_greater / startDate_lesser は排他的なので、
    // 7/1 に終わる作品・9/30 に始まる作品を落とさないため
    expect(seasonBoundsToFuzzyInts("2026-07-01", "2026-09-30")).toEqual({
      start: 20260700,
      end: 20260931,
    });
  });
});

describe("isPerpetualLongRunner", () => {
  it("話数未定で開始が 2 年以上前なら長寿作品とみなす", () => {
    const onePiece = media({
      title: "ONE PIECE",
      episodes: null,
      startDate: { year: 1999, month: 10, day: 20 },
    });
    expect(isPerpetualLongRunner(onePiece, 2026)).toBe(true);
  });

  it("話数が決まっていれば長寿作品とみなさない", () => {
    const digimon = media({
      title: "DIGIMON BEATBREAK",
      episodes: 49,
      startDate: { year: 2025, month: 10, day: 5 },
    });
    expect(isPerpetualLongRunner(digimon, 2026)).toBe(false);
  });

  it("前年開始なら話数未定でも残す", () => {
    const m = media({
      title: "リラックマ",
      episodes: null,
      startDate: { year: 2025, month: 4, day: 1 },
    });
    expect(isPerpetualLongRunner(m, 2026)).toBe(false);
  });

  it("開始年が不明な作品は落とさない", () => {
    // 分類できないものを切ると、実在の新作（例: ジャンケットバンク）を巻き込む
    const unknown = media({
      title: "ジャンケットバンク",
      episodes: null,
      startDate: { year: null, month: null, day: null },
    });
    expect(isPerpetualLongRunner(unknown, 2026)).toBe(false);
  });
});

// ──────────────────────────────────────────
// パイプライン
// ──────────────────────────────────────────

describe("fetchSeasonalAnime", () => {
  it("シーズンクエリと期間クエリの和集合を取る", async () => {
    // 期間クエリは終了日未定の新作を落とし、シーズンクエリは継続作品を落とす。
    // 片方にしか無い作品が両方とも出ること
    getAniListSeasonAnime.mockResolvedValue(page([media({ title: "新作" })]));
    getAniListAnimeAiringInRange.mockResolvedValue(
      page([media({ title: "継続作" })]),
    );
    tmdbPoolFrom(["新作", "継続作"]);

    const { items } = await fetchSeasonalAnime(2026, "summer");

    expect(new Set(items.map((i) => i.name))).toEqual(
      new Set(["新作", "継続作"]),
    );
  });

  it("前クールから継続している作品を含める", async () => {
    // 転スラ 4 期は AniList 上 2026 SPRING 所属。シーズンクエリには出ない
    getAniListSeasonAnime.mockResolvedValue(page([]));
    getAniListAnimeAiringInRange.mockResolvedValue(
      page([
        media({
          title: "転生したらスライムだった件 第4期 第1&2クール",
          startDate: { year: 2026, month: 4, day: 1 },
          endDate: { year: 2026, month: 9, day: 25 },
        }),
      ]),
    );
    // TMDb は続編を本体の Season N として持つので、本体名しか無い
    tmdbPoolFrom(["転生したらスライムだった件"]);

    const { items } = await fetchSeasonalAnime(2026, "summer");

    expect(items.map((i) => i.name)).toEqual(["転生したらスライムだった件"]);
  });

  it("末尾が裸の数字の続編も本体に紐付ける", async () => {
    getAniListSeasonAnime.mockResolvedValue(
      page([media({ title: "乙女ゲー世界はモブに厳しい世界です2" })]),
    );
    tmdbPoolFrom(["乙女ゲー世界はモブに厳しい世界です"]);

    const { items } = await fetchSeasonalAnime(2026, "summer");

    expect(items.map((i) => i.name)).toEqual([
      "乙女ゲー世界はモブに厳しい世界です",
    ]);
  });

  it("常時放送の長寿作品を除外する", async () => {
    getAniListAnimeAiringInRange.mockResolvedValue(
      page([
        media({
          title: "ONE PIECE",
          episodes: null,
          startDate: { year: 1999, month: 10, day: 20 },
          popularity: 999999,
        }),
        media({ title: "新作" }),
      ]),
    );
    tmdbPoolFrom(["ONE PIECE", "新作"]);

    const { items } = await fetchSeasonalAnime(2026, "summer");

    expect(items.map((i) => i.name)).toEqual(["新作"]);
  });

  it("人気順に並べる", async () => {
    getAniListSeasonAnime.mockResolvedValue(
      page([
        media({ title: "不人気", popularity: 10 }),
        media({ title: "人気", popularity: 9000 }),
        media({ title: "中間", popularity: 500 }),
      ]),
    );
    tmdbPoolFrom(["不人気", "人気", "中間"]);

    const { items } = await fetchSeasonalAnime(2026, "summer");

    expect(items.map((i) => i.name)).toEqual(["人気", "中間", "不人気"]);
  });

  it("次ページがある限り取り切る", async () => {
    // 1 ページ 50 件で打ち切ると、その季の後半が丸ごと落ちる
    getAniListSeasonAnime.mockImplementation(async (_y, _s, p) => {
      if (p === 1) return page([media({ title: "1ページ目" })], true);
      if (p === 2) return page([media({ title: "2ページ目" })], true);
      return page([media({ title: "3ページ目" })], false);
    });
    tmdbPoolFrom(["1ページ目", "2ページ目", "3ページ目"]);

    const { items } = await fetchSeasonalAnime(2026, "summer");

    expect(items.map((i) => i.name).sort()).toEqual([
      "1ページ目",
      "2ページ目",
      "3ページ目",
    ]);
  });

  it("同じ TMDb 作品に複数マッチしても重複させない", async () => {
    getAniListSeasonAnime.mockResolvedValue(
      page([
        media({ title: "鬼滅の刃", popularity: 200 }),
        media({ title: "鬼滅の刃 第2期", popularity: 100 }),
      ]),
    );
    tmdbPoolFrom(["鬼滅の刃"]);

    const { items } = await fetchSeasonalAnime(2026, "summer");

    expect(items).toHaveLength(1);
  });

  it("limit を超えて返さない", async () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      media({ title: `作品${i}`, popularity: 1000 - i }),
    );
    getAniListSeasonAnime.mockResolvedValue(page(many));
    tmdbPoolFrom(many.map((m) => m.title.native ?? ""));

    const { items } = await fetchSeasonalAnime(2026, "summer", { limit: 3 });

    expect(items).toHaveLength(3);
  });

  it("AniList が両方失敗したら TMDb の discover に倒す", async () => {
    getAniListSeasonAnime.mockRejectedValue(new Error("AniList down"));
    getAniListAnimeAiringInRange.mockRejectedValue(new Error("AniList down"));
    getAnimeBySeason.mockResolvedValue({ results: [tmdb(1, "代替")] });

    const result = await fetchSeasonalAnime(2026, "summer");

    expect(result.source).toBe("tmdb-fallback");
    expect(result.items.map((i) => i.name)).toEqual(["代替"]);
  });

  it("片方のクエリが落ちてももう片方の結果を返す", async () => {
    getAniListSeasonAnime.mockRejectedValue(new Error("AniList down"));
    getAniListAnimeAiringInRange.mockResolvedValue(
      page([media({ title: "生き残り" })]),
    );
    tmdbPoolFrom(["生き残り"]);

    const result = await fetchSeasonalAnime(2026, "summer");

    expect(result.source).toBe("anilist+tmdb");
    expect(result.items.map((i) => i.name)).toEqual(["生き残り"]);
  });

  it("TMDb に無い作品も unmatchedTitles に残す", async () => {
    getAniListSeasonAnime.mockResolvedValue(
      page([media({ title: "TMDb に無い作品" })]),
    );
    emptyTmdb();

    const result = await fetchSeasonalAnime(2026, "summer");

    expect(result.items).toEqual([]);
    expect(result.unmatchedTitles).toEqual(["TMDb に無い作品"]);
  });

  describe("TMDb に無い作品の扱い", () => {
    it("捨てずに AniList のデータで返す", async () => {
      // かつては丸ごと捨てていた。1 シーズンあたり 20〜40 件が消えていた
      getAniListSeasonAnime.mockResolvedValue(
        page([media({ title: "ショート作品" })]),
      );
      emptyTmdb();

      const { entries } = await fetchSeasonalAnime(2026, "summer");

      expect(entries).toHaveLength(1);
      expect(entries[0].kind).toBe("unlisted");
      if (entries[0].kind === "unlisted") {
        expect(entries[0].media.title.native).toBe("ショート作品");
      }
    });

    it("items には混ぜない（TMDb id を要する用途を壊さない）", async () => {
      getAniListSeasonAnime.mockResolvedValue(
        page([media({ title: "ショート作品" }), media({ title: "本編" })]),
      );
      tmdbPoolFrom(["本編"]);

      const { items, entries } = await fetchSeasonalAnime(2026, "summer");

      expect(items.map((i) => i.name)).toEqual(["本編"]);
      expect(entries).toHaveLength(2);
    });
  });

  describe("劇場版", () => {
    it("MOVIE 形式は映画検索で解決する", async () => {
      getAniListSeasonAnime.mockResolvedValue(
        page([media({ title: "劇場版 作品", format: "MOVIE" })]),
      );
      emptyTmdb();
      searchMovie.mockResolvedValue({ results: [movie(7, "劇場版 作品")] });

      const { entries } = await fetchSeasonalAnime(2026, "summer");

      expect(entries).toHaveLength(1);
      expect(entries[0].kind).toBe("movie");
      if (entries[0].kind === "movie") {
        expect(entries[0].movie.title).toBe("劇場版 作品");
      }
    });

    it("MOVIE 形式で TV 検索を叩かない", async () => {
      // 劇場版を TV 検索へ投げても当たらない。問い合わせの無駄
      getAniListSeasonAnime.mockResolvedValue(
        page([media({ title: "劇場版 作品", format: "MOVIE" })]),
      );
      emptyTmdb();

      await fetchSeasonalAnime(2026, "summer");

      expect(searchAnime).not.toHaveBeenCalled();
      expect(searchMovie).toHaveBeenCalled();
    });

    it("TV 形式で映画検索を叩かない", async () => {
      getAniListSeasonAnime.mockResolvedValue(
        page([media({ title: "TV 作品" })]),
      );
      emptyTmdb();

      await fetchSeasonalAnime(2026, "summer");

      expect(searchMovie).not.toHaveBeenCalled();
    });
  });

  describe("副題の差を許容する", () => {
    it("TMDb 側に副題が付いていても紐付ける", async () => {
      getAniListSeasonAnime.mockResolvedValue(
        page([media({ title: "凶乱令嬢ニア・リストン" })]),
      );
      tmdbPoolFrom(["凶乱令嬢ニア・リストン 病弱令嬢に転生した神殺しの武人"]);

      const { items } = await fetchSeasonalAnime(2026, "summer");

      expect(items).toHaveLength(1);
    });

    it("完全一致を前方一致より優先する", async () => {
      getAniListSeasonAnime.mockResolvedValue(
        page([media({ title: "鬼滅の刃" })]),
      );
      getAnimeBySeason.mockResolvedValue({
        results: [tmdb(1, "鬼滅の刃 遊郭編"), tmdb(2, "鬼滅の刃")],
      });
      searchAnime.mockResolvedValue({ results: [] });
      searchMovie.mockResolvedValue({ results: [] });

      const { items } = await fetchSeasonalAnime(2026, "summer");

      expect(items.map((i) => i.id)).toEqual([2]);
    });

    it("単語の途中で切れる前方一致は紐付けない", async () => {
      getAniListSeasonAnime.mockResolvedValue(
        page([media({ title: "ワンピース" })]),
      );
      tmdbPoolFrom(["ワンピースフィルム レッド"]);

      const { entries } = await fetchSeasonalAnime(2026, "summer");

      expect(entries[0].kind).toBe("unlisted");
    });
  });

  describe("取得上限", () => {
    it("既定の上限が 1 シーズン分を取り切れる", async () => {
      // 2026 夏は 138 件。100 で打ち切っていた頃は 38 件が捨てられていた
      const many = Array.from({ length: 138 }, (_, i) =>
        media({ title: `作品${i}`, popularity: 1000 - i }),
      );
      getAniListSeasonAnime.mockResolvedValue(page(many));
      emptyTmdb();

      const { entries } = await fetchSeasonalAnime(2026, "summer");

      expect(entries).toHaveLength(138);
    });
  });
});
