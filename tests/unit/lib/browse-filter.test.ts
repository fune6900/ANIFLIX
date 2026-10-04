import { describe, it, expect, vi, afterEach } from "vitest";
import type {
  TMDbAnime,
  TMDbMovie,
  TMDbWatchProvidersResponse,
} from "@/types/tmdb";
import type { SeasonalEntry } from "@/lib/seasonal-anime";
import type { AniListMedia } from "@/lib/anilist";
import { ANIME_GENRES, findGenre, genreKeywordIds } from "@/lib/genres";

/**
 * 一覧ページの共通フィルター（#77）。
 *
 * - 値は URL クエリで持ち、ホワイトリスト照合する
 * - **そのページで既に取得した作品の中だけ**を絞る（新しく作品を取りに行かない）
 * - 配信サービスは作品ごとに watch/providers を引く。失敗した作品は「不明」として
 *   表示しない（ページは落とさない）
 * `@/lib/tmdb` は自前の lib なのでモックしてよい。
 */

const getAnimeWatchProviders = vi.fn();
const getMovieWatchProviders = vi.fn();
const getAnimeKeywordIds = vi.fn();
const getMovieKeywordIds = vi.fn();
const resolveKeywordId = vi.fn();

vi.mock("@/lib/tmdb", () => ({
  getAnimeWatchProviders: (id: number) => getAnimeWatchProviders(id),
  getMovieWatchProviders: (id: number) => getMovieWatchProviders(id),
  getAnimeKeywordIds: (id: number) => getAnimeKeywordIds(id),
  getMovieKeywordIds: (id: number) => getMovieKeywordIds(id),
  resolveKeywordId: (q: string) => resolveKeywordId(q),
}));

const {
  FILTER_GENRES,
  parseBrowseFilter,
  isFilterActive,
  withFilter,
  filterAnime,
  filterEntries,
} = await import("@/lib/browse-filter");

function anime(id: number, genreIds: number[] = [16]): TMDbAnime {
  return {
    id,
    name: `作品${id}`,
    original_name: `Work ${id}`,
    overview: "",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2026-01-01",
    vote_average: 7,
    vote_count: 10,
    genre_ids: genreIds,
    origin_country: ["JP"],
  };
}

function movie(id: number, genreIds: number[] = [16]): TMDbMovie {
  return {
    id,
    title: `映画${id}`,
    original_title: `Movie ${id}`,
    overview: "",
    poster_path: null,
    backdrop_path: null,
    release_date: "2026-01-01",
    vote_average: 7,
    vote_count: 10,
    genre_ids: genreIds,
  };
}

function providersWith(...names: string[]): TMDbWatchProvidersResponse {
  return {
    id: 0,
    results: {
      JP: {
        link: "",
        flatrate: names.map((n, i) => ({
          provider_id: i,
          provider_name: n,
          logo_path: null,
          display_priority: i,
        })),
      },
    },
  };
}

afterEach(() => {
  getAnimeWatchProviders.mockReset();
  getMovieWatchProviders.mockReset();
  getAnimeKeywordIds.mockReset();
  getMovieKeywordIds.mockReset();
  resolveKeywordId.mockClear();
});

describe("FILTER_GENRES", () => {
  it("選択肢は ANIME_GENRES の全ジャンル（キーワード由来も含む）", () => {
    expect(FILTER_GENRES.map((g) => g.id)).toEqual(
      ANIME_GENRES.map((g) => g.id),
    );
  });
});

describe("parseBrowseFilter", () => {
  it("選択肢にある値だけを受け付ける", () => {
    expect(parseBrowseFilter({ genre: "10759", service: "netflix" })).toEqual({
      genreId: 10759,
      service: "netflix",
    });
  });

  it("未指定・空文字は絞らない", () => {
    expect(parseBrowseFilter({})).toEqual({ genreId: null, service: null });
    expect(parseBrowseFilter({ genre: "", service: "" })).toEqual({
      genreId: null,
      service: null,
    });
  });

  it.each([
    ["存在しないジャンル", "99999"],
    ["数値でない", "abc"],
    ["小数・前後に余計な文字", "10759abc"],
    ["負数", "-16"],
    ["タグ入り", "<script>alert(1)</script>"],
  ])("ジャンル: %s は捨てる", (_label, raw) => {
    expect(parseBrowseFilter({ genre: raw }).genreId).toBeNull();
  });

  it.each([
    ["未知のサービス", "crunchyroll"],
    ["プロトタイプのキー", "constructor"],
    ["大文字違い", "Netflix"],
    ["タグ入り", "netflix<script>"],
  ])("サービス: %s は捨てる", (_label, raw) => {
    expect(parseBrowseFilter({ service: raw }).service).toBeNull();
  });

  it("キーワード由来のジャンルも受け付ける", () => {
    expect(parseBrowseFilter({ genre: "9001" }).genreId).toBe(9001);
  });

  it("配列（?genre=a&genre=b）は先頭だけを見る", () => {
    expect(
      parseBrowseFilter({ genre: ["35", "18"], service: ["hulu", "netflix"] }),
    ).toEqual({ genreId: 35, service: "hulu" });
  });
});

describe("isFilterActive", () => {
  it("どちらかが指定されていれば true", () => {
    expect(isFilterActive({ genreId: null, service: null })).toBe(false);
    expect(isFilterActive({ genreId: 35, service: null })).toBe(true);
    expect(isFilterActive({ genreId: null, service: "hulu" })).toBe(true);
  });
});

describe("withFilter", () => {
  it("ページ送りのリンクにフィルターを引き継ぐ", () => {
    expect(
      withFilter("/browse/new?page=2", { genreId: 35, service: "netflix" }),
    ).toBe("/browse/new?page=2&genre=35&service=netflix");
  });

  it("クエリが無いリンクにも付けられる", () => {
    expect(
      withFilter("/browse/airing", { genreId: null, service: "hulu" }),
    ).toBe("/browse/airing?service=hulu");
  });

  it("フィルターが無ければリンクを変えない", () => {
    expect(
      withFilter("/browse/new?page=2", { genreId: null, service: null }),
    ).toBe("/browse/new?page=2");
  });
});

describe("filterAnime", () => {
  it("フィルターが無ければそのまま返し、配信情報も引かない", async () => {
    const items = [anime(1), anime(2)];

    const out = await filterAnime(items, { genreId: null, service: null });

    expect(out).toEqual(items);
    expect(getAnimeWatchProviders).not.toHaveBeenCalled();
  });

  it("ジャンルは一覧データの genre_ids で絞り、追加リクエストしない", async () => {
    const items = [anime(1, [16, 35]), anime(2, [16, 18]), anime(3, [16, 35])];

    const out = await filterAnime(items, { genreId: 35, service: null });

    expect(out.map((a) => a.id)).toEqual([1, 3]);
    expect(getAnimeWatchProviders).not.toHaveBeenCalled();
  });

  it("配信サービスは渡された作品の分だけ引き、配信中のものを残す", async () => {
    getAnimeWatchProviders.mockImplementation(async (id: number) =>
      id === 2 ? providersWith("Netflix") : providersWith("Hulu"),
    );
    const items = [anime(1), anime(2), anime(3)];

    const out = await filterAnime(items, { genreId: null, service: "netflix" });

    expect(out.map((a) => a.id)).toEqual([2]);
    expect(getAnimeWatchProviders.mock.calls.map((c) => c[0]).sort()).toEqual([
      1, 2, 3,
    ]);
  });

  it("ジャンルで落ちた作品の配信情報は引かない", async () => {
    getAnimeWatchProviders.mockResolvedValue(providersWith("Netflix"));
    const items = [anime(1, [16, 35]), anime(2, [16, 18])];

    const out = await filterAnime(items, { genreId: 35, service: "netflix" });

    expect(out.map((a) => a.id)).toEqual([1]);
    expect(getAnimeWatchProviders.mock.calls.map((c) => c[0])).toEqual([1]);
  });

  it("配信情報が取れなかった作品は「不明」として出さない（全体は落とさない）", async () => {
    getAnimeWatchProviders.mockImplementation(async (id: number) => {
      if (id === 1) throw new Error("TMDb down");
      return providersWith("Netflix");
    });

    const out = await filterAnime([anime(1), anime(2)], {
      genreId: null,
      service: "netflix",
    });

    expect(out.map((a) => a.id)).toEqual([2]);
  });

  it("並び順を保つ", async () => {
    getAnimeWatchProviders.mockImplementation(
      (id: number) =>
        new Promise((resolve) =>
          setTimeout(() => resolve(providersWith("Netflix")), 10 - id),
        ),
    );

    const out = await filterAnime([anime(1), anime(2), anime(3)], {
      genreId: null,
      service: "netflix",
    });

    expect(out.map((a) => a.id)).toEqual([1, 2, 3]);
  });

  it("配信情報の取得は同時 10 件までに抑える", async () => {
    let inFlight = 0;
    let peak = 0;
    getAnimeWatchProviders.mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return providersWith("Netflix");
    });
    const items = Array.from({ length: 70 }, (_, i) => anime(i + 1));

    const out = await filterAnime(items, { genreId: null, service: "netflix" });

    expect(out).toHaveLength(70);
    expect(peak).toBeLessThanOrEqual(10);
  });
});

describe("filterEntries（シーズン一覧の TV / 映画 / TMDb 未登録）", () => {
  const unlisted: SeasonalEntry = {
    kind: "unlisted",
    media: { id: 1 } as AniListMedia, // 判定に使わないフィールドを省くため
  };

  it("映画は映画の配信情報を引く", async () => {
    getMovieWatchProviders.mockResolvedValue(providersWith("Netflix"));
    getAnimeWatchProviders.mockResolvedValue(providersWith("Hulu"));
    const entries: SeasonalEntry[] = [
      { kind: "tv", anime: anime(1) },
      { kind: "movie", movie: movie(2) },
    ];

    const out = await filterEntries(entries, {
      genreId: null,
      service: "netflix",
    });

    expect(out).toEqual([{ kind: "movie", movie: movie(2) }]);
    expect(getMovieWatchProviders).toHaveBeenCalledWith(2);
  });

  it("TMDb に無い作品はフィルター中は出さない（ジャンルも配信も判定できない）", async () => {
    const out = await filterEntries([unlisted], { genreId: 35, service: null });

    expect(out).toEqual([]);
  });

  it("フィルターが無ければ TMDb に無い作品も残す", async () => {
    const out = await filterEntries([unlisted], {
      genreId: null,
      service: null,
    });

    expect(out).toEqual([unlisted]);
  });
});

describe("キーワード由来のジャンル", () => {
  // ANIME_GENRES の 9001 = 異世界転生、9004 = スポーツ、9002 = メカ。
  // キーワード ID は genres.ts の固定値（#99）。名前の解決はしない
  const ISEKAI = 9001;
  const SPORTS = 9004;
  function kw(genreId: number): readonly number[] {
    const g = findGenre(genreId);
    if (!g) throw new Error(`unknown genre ${genreId}`);
    return genreKeywordIds(g);
  }
  const ISEKAI_KW = kw(ISEKAI)[0];
  const SPORTS_EXTRA_KW = kw(SPORTS)[kw(SPORTS).length - 1];
  const MECHA_KW = kw(9002)[0];

  it("作品ごとのキーワードに、ジャンルのキーワードがあれば残す", async () => {
    getAnimeKeywordIds.mockImplementation(async (id: number) =>
      id === 1 ? [ISEKAI_KW] : id === 2 ? [5, ISEKAI_KW] : [MECHA_KW],
    );

    const out = await filterAnime([anime(1), anime(2), anime(3)], {
      genreId: ISEKAI,
      service: null,
    });

    expect(out.map((a) => a.id)).toEqual([1, 2]);
  });

  it("追加キーワードのどれか 1 つでも一致すれば残す（OR）", async () => {
    getAnimeKeywordIds.mockImplementation(async (id: number) =>
      id === 1 ? [SPORTS_EXTRA_KW] : [ISEKAI_KW],
    );

    const out = await filterAnime([anime(1), anime(2)], {
      genreId: SPORTS,
      service: null,
    });

    expect(out.map((a) => a.id)).toEqual([1]);
    // キーワードは固定の ID で照合し、名前の検索はしない
    expect(resolveKeywordId).not.toHaveBeenCalled();
  });

  it("キーワードが取れなかった作品は出さない（ページは落とさない）", async () => {
    getAnimeKeywordIds.mockImplementation(async (id: number) => {
      if (id === 1) throw new Error("TMDb down");
      return [ISEKAI_KW];
    });

    const out = await filterAnime([anime(1), anime(2)], {
      genreId: ISEKAI,
      service: null,
    });

    expect(out.map((a) => a.id)).toEqual([2]);
  });

  it("映画は映画のキーワードを引く", async () => {
    getMovieKeywordIds.mockResolvedValue([ISEKAI_KW]);

    const out = await filterEntries([{ kind: "movie", movie: movie(7) }], {
      genreId: ISEKAI,
      service: null,
    });

    expect(out).toHaveLength(1);
    expect(getMovieKeywordIds).toHaveBeenCalledWith(7);
  });

  it("ジャンルで落ちた作品の配信情報は引かない", async () => {
    getAnimeKeywordIds.mockImplementation(async (id: number) =>
      id === 1 ? [ISEKAI_KW] : [],
    );
    getAnimeWatchProviders.mockResolvedValue(providersWith("Netflix"));

    const out = await filterAnime([anime(1), anime(2)], {
      genreId: ISEKAI,
      service: "netflix",
    });

    expect(out.map((a) => a.id)).toEqual([1]);
    expect(getAnimeWatchProviders.mock.calls.map((c) => c[0])).toEqual([1]);
  });
});

describe("映画のジャンル（TV 専用 ID の読み替え）", () => {
  it.each([
    ["アクション・冒険", 10759, [28]],
    ["アクション・冒険", 10759, [12]],
    ["SF・ファンタジー", 10765, [878]],
    ["SF・ファンタジー", 10765, [14]],
    ["戦争・政治", 10768, [10752]],
    ["コメディ", 35, [35]],
  ])("%s（%i）は映画の %j を拾う", async (_name, genreId, movieGenres) => {
    const out = await filterEntries(
      [{ kind: "movie", movie: movie(1, [16, ...movieGenres]) }],
      { genreId, service: null },
    );

    expect(out).toHaveLength(1);
  });

  it("対応しないジャンルの映画は落とす", async () => {
    const out = await filterEntries(
      [{ kind: "movie", movie: movie(1, [16, 35]) }],
      { genreId: 10759, service: null },
    );

    expect(out).toEqual([]);
  });
});
