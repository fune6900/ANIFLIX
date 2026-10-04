import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TMDbMovie, TMDbSearchResponse } from "@/types/tmdb";
import { ANIME_GENRES, findGenre } from "@/lib/genres";
import type { AnimeGenre } from "@/lib/genres";

/**
 * アニメ映画の「すべて見る」専用ページの取得（#91）。
 *
 * ページの組み方は TMDb を介さない偽のソース（配列を 20 件ずつ返す関数）で確かめる。
 * どの TMDb 関数をどの引数で呼ぶかは `@/lib/tmdb` をモックして確かめる（自前の lib）。
 */

interface MovieInit {
  popularity?: number;
  poster?: string | null;
  release?: string;
}

function movie(id: number, init: MovieInit = {}): TMDbMovie {
  return {
    id,
    title: `映画${id}`,
    original_title: `Movie ${id}`,
    overview: "",
    poster_path: init.poster === undefined ? `/p${id}.jpg` : init.poster,
    backdrop_path: null,
    release_date: init.release ?? "2026-01-01",
    vote_average: 7,
    vote_count: 10,
    genre_ids: [16],
    popularity: init.popularity ?? 1,
  };
}

const TMDB_PAGE = 20;

/** 配列を TMDb と同じく 20 件ずつのページで返すソース。呼ばれたページを記録する */
function fakeSource(items: TMDbMovie[], totalResults = items.length) {
  const calls: number[] = [];
  const fetchPage = async (
    page: number,
  ): Promise<TMDbSearchResponse<TMDbMovie>> => {
    calls.push(page);
    return {
      page,
      total_pages: Math.ceil(totalResults / TMDB_PAGE),
      total_results: totalResults,
      results: items.slice((page - 1) * TMDB_PAGE, page * TMDB_PAGE),
    };
  };
  return { fetchPage, calls };
}

/** 人気が高い順（TMDb の popularity.desc と同じ並び）に n 件 */
function popularList(base: number, n: number, step = 1): TMDbMovie[] {
  return Array.from({ length: n }, (_, i) =>
    movie(base + i, { popularity: 100000 - i * step }),
  );
}

const tmdb = {
  getLatestAnimeMovies: vi.fn(async (p: number) => ({
    page: p,
    total_pages: 1,
    total_results: 3,
    results:
      p === 1
        ? [
            movie(1, { release: "2026-10-03" }),
            movie(2, { release: "2026-10-02", poster: null }),
            movie(3, { release: "2026-10-01" }),
          ]
        : [],
  })),
  getAnimeMoviesByGenre: vi.fn(
    async (genreId: number, p: number, _exclude?: readonly number[]) => ({
      page: p,
      total_pages: 1,
      total_results: 1,
      results: p === 1 ? [movie(genreId * 10)] : [],
    }),
  ),
  getAnimeMovieByKeywords: vi.fn(async (_kw: string[], p: number) => ({
    page: p,
    total_pages: 1,
    total_results: 1,
    results: p === 1 ? [movie(777)] : [],
  })),
};

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getLatestAnimeMovies: (p: number) => tmdb.getLatestAnimeMovies(p),
  getAnimeMoviesByGenre: (g: number, p: number, ex?: readonly number[]) =>
    tmdb.getAnimeMoviesByGenre(g, p, ex),
  getAnimeMovieByKeywords: (kw: string[], p: number) =>
    tmdb.getAnimeMovieByKeywords(kw, p),
}));

const {
  MOVIE_LIST_PAGE_SIZE,
  interleavedRanges,
  loadMovieListPage,
  loadLatestMovieList,
  loadGenreMovieList,
} = await import("@/lib/movie-list");

beforeEach(() => {
  for (const fn of Object.values(tmdb)) fn.mockClear();
});

function genre(id: number): AnimeGenre {
  const g = findGenre(id);
  if (!g) throw new Error(`unknown genre ${id}`);
  return g;
}

describe("1 ページの件数", () => {
  it("TV の新着一覧（/browse/new）と同じ 70 件", () => {
    expect(MOVIE_LIST_PAGE_SIZE).toBe(70);
  });
});

describe("interleavedRanges: 重ならない複数の一覧を交互に並べた時の各一覧の範囲", () => {
  it("一覧が 1 つなら窓そのもの", () => {
    expect(interleavedRanges([100], 70, 140)).toEqual([[70, 100]]);
  });

  it("2 つなら半分ずつ取る", () => {
    expect(interleavedRanges([100, 100], 0, 70)).toEqual([
      [0, 35],
      [0, 35],
    ]);
    expect(interleavedRanges([100, 100], 70, 140)).toEqual([
      [35, 70],
      [35, 70],
    ]);
  });

  it("奇数の境界は先頭の一覧から先に数える（A0 B0 A1 …）", () => {
    expect(interleavedRanges([100, 100], 0, 3)).toEqual([
      [0, 2],
      [0, 1],
    ]);
    expect(interleavedRanges([100, 100], 3, 5)).toEqual([
      [2, 3],
      [1, 2],
    ]);
  });

  it("片方が尽きたら残りはもう片方で埋める", () => {
    expect(interleavedRanges([10, 100], 0, 70)).toEqual([
      [0, 10],
      [0, 60],
    ]);
    expect(interleavedRanges([10, 100], 70, 140)).toEqual([
      [10, 10],
      [60, 100],
    ]);
  });

  it("どの窓でも取る件数の合計は窓の大きさ（総数で頭打ち）", () => {
    const totals = [37, 101, 5];
    const sum = totals.reduce((a, b) => a + b, 0);
    for (let start = 0; start < sum; start += 7) {
      const end = start + 7;
      const taken = interleavedRanges(totals, start, end).reduce(
        (n, [from, to]) => n + (to - from),
        0,
      );
      expect(taken).toBe(Math.min(end, sum) - start);
    }
  });
});

describe("loadMovieListPage: 一覧 1 つ", () => {
  it("70 件ずつ、並び順のまま区切る", async () => {
    const items = popularList(1, 150);
    const src = fakeSource(items);

    const p1 = await loadMovieListPage([src.fetchPage], 1);
    expect(p1.results.map((m) => m.id)).toEqual(
      items.slice(0, 70).map((m) => m.id),
    );
    expect(p1.totalPages).toBe(3);
    expect(p1.totalResults).toBe(150);

    const p3 = await loadMovieListPage([src.fetchPage], 3);
    expect(p3.results.map((m) => m.id)).toEqual(
      items.slice(140).map((m) => m.id),
    );
  });

  it("並びを人気順に並べ直さない（最新作は公開日順のまま）", async () => {
    const items = [
      movie(1, { popularity: 1 }),
      movie(2, { popularity: 50 }),
      movie(3, { popularity: 10 }),
    ];
    const page = await loadMovieListPage([fakeSource(items).fetchPage], 1);

    expect(page.results.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it("その窓にかかる TMDb のページだけを取る（総数を知るための 1 ページ目を除く）", async () => {
    const src = fakeSource(popularList(1, 400));

    await loadMovieListPage([src.fetchPage], 2);

    // 70〜139 件目 = TMDb の 4〜7 ページ
    expect(new Set(src.calls)).toEqual(new Set([1, 4, 5, 6, 7]));
  });

  it("総ページ数より先を求められたら最終ページを出す（空のグリッドにしない）", async () => {
    const src = fakeSource(popularList(1, 150));

    const page = await loadMovieListPage([src.fetchPage], 9);

    expect(page.page).toBe(3);
    expect(page.results).toHaveLength(10);
  });

  it("TMDb が返さない 500 ページより先は数えない", async () => {
    const src = fakeSource(popularList(1, 40), 50000);

    const page = await loadMovieListPage([src.fetchPage], 1);

    expect(page.totalPages).toBe(Math.ceil(10000 / 70));
  });

  it("keep で落とした作品は出さない", async () => {
    const items = popularList(1, 5);
    const page = await loadMovieListPage([fakeSource(items).fetchPage], 1, {
      keep: (m) => m.id % 2 === 1,
    });

    expect(page.results.map((m) => m.id)).toEqual([1, 3, 5]);
  });

  it("2 ページ目以降の 1 ページが落ちても、その 20 件が欠けるだけで throw しない", async () => {
    const items = popularList(1, 100);
    const src = fakeSource(items);
    const flaky = async (page: number) => {
      if (page === 3) throw new Error("TMDb down");
      return src.fetchPage(page);
    };

    const page = await loadMovieListPage([flaky], 1);

    // 41〜60 件目（TMDb の 3 ページ目）だけが欠け、後ろが前へ詰まらない
    expect(page.results.map((m) => m.id)).toEqual([
      ...items.slice(0, 40).map((m) => m.id),
      ...items.slice(60, 70).map((m) => m.id),
    ]);
    expect(page.totalPages).toBe(2);
  });

  it("TMDb のページ境界で同じ作品が 2 回来ても 1 回だけ出す", async () => {
    // 人気順のページングは境界で順位が入れ替わる。21 件目に 20 件目と同じ作品が来た状態
    const items = popularList(1, 40);
    items[20] = items[19];

    const page = await loadMovieListPage([fakeSource(items).fetchPage], 1);
    const ids = page.results.map((m) => m.id);

    expect(ids).toHaveLength(39);
    expect(new Set(ids).size).toBe(39);
  });

  it("全部のページが落ちたら throw する", async () => {
    const fail = async (): Promise<TMDbSearchResponse<TMDbMovie>> => {
      throw new Error("TMDb down");
    };

    await expect(loadMovieListPage([fail], 1)).rejects.toThrow();
  });
});

describe("loadMovieListPage: 重ならない一覧 2 つの合併（アクション・冒険など）", () => {
  // A は人気の高い作品が多く、B は少ない
  const A = popularList(1, 100, 10);
  const B = popularList(1001, 30, 7);

  it("全ページを通して、どちらの作品も 1 回ずつ出る（抜けも重複も無い）", async () => {
    const a = fakeSource(A);
    const b = fakeSource(B);
    const first = await loadMovieListPage([a.fetchPage, b.fetchPage], 1);
    const seen: number[] = [];
    for (let p = 1; p <= first.totalPages; p++) {
      const page = await loadMovieListPage([a.fetchPage, b.fetchPage], p);
      seen.push(...page.results.map((m) => m.id));
    }

    expect(first.totalResults).toBe(130);
    expect(first.totalPages).toBe(2);
    expect(seen).toHaveLength(130);
    expect(new Set(seen)).toEqual(new Set([...A, ...B].map((m) => m.id)));
  });

  it("1 ページ目は両方から半分ずつ取り、人気順に並べ直す", async () => {
    const page = await loadMovieListPage(
      [fakeSource(A).fetchPage, fakeSource(B).fetchPage],
      1,
    );

    expect(page.results).toHaveLength(70);
    // B は 30 件しか無いので A から 40 件
    expect(page.results.filter((m) => m.id > 1000)).toHaveLength(30);
    const pops = page.results.map((m) => m.popularity ?? 0);
    expect([...pops].sort((x, y) => y - x)).toEqual(pops);
  });

  it("両方の一覧に同じ作品が来ても 1 回だけ出す", async () => {
    // without_genres で割っても、取得の間にジャンルが付け替わると両方に現れうる
    const a = popularList(1, 10, 10);
    const b = [a[3], ...popularList(1001, 9, 7)];

    const page = await loadMovieListPage(
      [fakeSource(a).fetchPage, fakeSource(b).fetchPage],
      1,
    );
    const ids = page.results.map((m) => m.id);

    expect(ids.filter((id) => id === a[3].id)).toHaveLength(1);
    expect(ids).toHaveLength(19);
  });

  it("片方の一覧が落ちても、もう片方の作品は出す", async () => {
    const fail = async (): Promise<TMDbSearchResponse<TMDbMovie>> => {
      throw new Error("TMDb down");
    };
    const page = await loadMovieListPage([fail, fakeSource(B).fetchPage], 1);

    expect(page.results.map((m) => m.id)).toEqual(B.map((m) => m.id));
  });
});

describe("loadLatestMovieList: 最新作", () => {
  it("行と同じ取得（今日以前に公開・公開日の新しい順）を使い、ポスターの無い作品を落とす", async () => {
    const page = await loadLatestMovieList(1);

    expect(tmdb.getLatestAnimeMovies).toHaveBeenCalledWith(1);
    expect(page.results.map((m) => m.id)).toEqual([1, 3]);
  });
});

describe("loadGenreMovieList: ジャンル別", () => {
  it("映画と共通の ID はそのジャンル 1 つで取る", async () => {
    await loadGenreMovieList(genre(35), 1);

    expect(tmdb.getAnimeMoviesByGenre).toHaveBeenCalledWith(35, 1, []);
    expect(tmdb.getAnimeMoviesByGenre.mock.calls.every(([g]) => g === 35)).toBe(
      true,
    );
  });

  it("アクション・冒険は 28 ∪ 12（12 は 28 を除いた残り）で取る", async () => {
    const page = await loadGenreMovieList(genre(10759), 1);

    expect(tmdb.getAnimeMoviesByGenre).toHaveBeenCalledWith(28, 1, []);
    expect(tmdb.getAnimeMoviesByGenre).toHaveBeenCalledWith(12, 1, [28]);
    expect(page.results.map((m) => m.id).sort()).toEqual([120, 280]);
  });

  it("SF・ファンタジーは 878 ∪ 14（14 は 878 を除いた残り）で取る", async () => {
    await loadGenreMovieList(genre(10765), 1);

    expect(tmdb.getAnimeMoviesByGenre).toHaveBeenCalledWith(878, 1, []);
    expect(tmdb.getAnimeMoviesByGenre).toHaveBeenCalledWith(14, 1, [878]);
  });

  it("キーワード由来のジャンルはキーワード（追加キーワード込み）の OR で取る", async () => {
    const isekai = ANIME_GENRES.find((g) => g.filterType === "keyword");
    if (!isekai?.keyword) throw new Error("keyword genre missing");

    const page = await loadGenreMovieList(isekai, 1);

    expect(tmdb.getAnimeMovieByKeywords).toHaveBeenCalledWith(
      [isekai.keyword, ...(isekai.extraKeywords ?? [])],
      1,
    );
    expect(tmdb.getAnimeMoviesByGenre).not.toHaveBeenCalled();
    expect(page.results.map((m) => m.id)).toEqual([777]);
  });
});
