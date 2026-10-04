import { describe, it, expect } from "vitest";
import type { TMDbMovie, TMDbSearchResponse } from "@/types/tmdb";
import { LIST_PAGE_SIZE, byDate, loadListPage } from "@/lib/list-page";

/**
 * 「すべて見る」一覧の 70 件ページング（#91 で映画用に作り、#99 で汎用化）。
 *
 * TMDb を介さない偽のソース（配列を 20 件ずつ返す関数）でページの組み方を確かめる。
 */

interface Init {
  popularity?: number;
  poster?: string | null;
  date?: string;
}

function movie(id: number, init: Init = {}): TMDbMovie {
  return {
    id,
    title: `映画${id}`,
    original_title: `Movie ${id}`,
    overview: "",
    poster_path: init.poster === undefined ? `/p${id}.jpg` : init.poster,
    backdrop_path: null,
    release_date: init.date ?? "2026-01-01",
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

function list(base: number, n: number): TMDbMovie[] {
  return Array.from({ length: n }, (_, i) =>
    movie(base + i, { popularity: 100000 - i }),
  );
}

/** 2000-01-01 から step 日ずつ進む日付（offset 日ずらせる） */
function day(n: number): string {
  return new Date(Date.UTC(2000, 0, 1) + n * 86400000)
    .toISOString()
    .split("T")[0];
}

/** 日付の新しい順（TMDb の primary_release_date.desc と同じ並び） */
function datedDesc(base: number, n: number, step: number, offset = 0) {
  return Array.from({ length: n }, (_, i) =>
    movie(base + i, { date: day(offset + (n - i) * step) }),
  );
}

const releaseDate = (m: TMDbMovie) => m.release_date;
const newestFirst = byDate(releaseDate, "desc");
const oldestFirst = byDate(releaseDate, "asc");

const fail = async (): Promise<TMDbSearchResponse<TMDbMovie>> => {
  throw new Error("TMDb down");
};

describe("1 ページの件数", () => {
  it("TV の新着一覧（/browse/new）と同じ 70 件", () => {
    expect(LIST_PAGE_SIZE).toBe(70);
  });
});

describe("byDate", () => {
  it("新しい順 / 古い順に並べる比較関数を作る", () => {
    const a = movie(1, { date: "2020-01-01" });
    const b = movie(2, { date: "2021-01-01" });

    expect([a, b].sort(newestFirst).map((m) => m.id)).toEqual([2, 1]);
    expect([b, a].sort(oldestFirst).map((m) => m.id)).toEqual([1, 2]);
  });

  it("日付の無い作品は最後に回す（どちらの向きでも）", () => {
    const a = movie(1, { date: "" });
    const b = movie(2, { date: "2021-01-01" });

    expect([a, b].sort(newestFirst).map((m) => m.id)).toEqual([2, 1]);
    expect([a, b].sort(oldestFirst).map((m) => m.id)).toEqual([2, 1]);
  });
});

describe("loadListPage: 一覧 1 つ", () => {
  it("70 件ずつ、並び順のまま区切る", async () => {
    const items = list(1, 150);
    const src = fakeSource(items);

    const p1 = await loadListPage([src.fetchPage], 1);
    expect(p1.results.map((m) => m.id)).toEqual(
      items.slice(0, 70).map((m) => m.id),
    );
    expect(p1.totalPages).toBe(3);
    expect(p1.totalResults).toBe(150);

    const p3 = await loadListPage([src.fetchPage], 3);
    expect(p3.results.map((m) => m.id)).toEqual(
      items.slice(140).map((m) => m.id),
    );
  });

  it("並べ直さない（TMDb の並びのまま）", async () => {
    const items = [
      movie(1, { popularity: 1 }),
      movie(2, { popularity: 50 }),
      movie(3, { popularity: 10 }),
    ];
    const page = await loadListPage([fakeSource(items).fetchPage], 1);

    expect(page.results.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it("その窓にかかる TMDb のページだけを取る（総数を知るための 1 ページ目を除く）", async () => {
    const src = fakeSource(list(1, 400));

    await loadListPage([src.fetchPage], 2);

    // 70〜139 件目 = TMDb の 4〜7 ページ
    expect(new Set(src.calls)).toEqual(new Set([1, 4, 5, 6, 7]));
  });

  it("総ページ数より先を求められたら最終ページを出す（空のグリッドにしない）", async () => {
    const page = await loadListPage([fakeSource(list(1, 150)).fetchPage], 9);

    expect(page.page).toBe(3);
    expect(page.results).toHaveLength(10);
  });

  it("TMDb が返さない 500 ページより先は数えない", async () => {
    const page = await loadListPage(
      [fakeSource(list(1, 40), 50000).fetchPage],
      1,
    );

    expect(page.totalPages).toBe(Math.ceil(10000 / 70));
  });

  it("keep で落とした作品は出さない", async () => {
    const page = await loadListPage([fakeSource(list(1, 5)).fetchPage], 1, {
      keep: (m) => m.id % 2 === 1,
    });

    expect(page.results.map((m) => m.id)).toEqual([1, 3, 5]);
  });

  it("2 ページ目以降の 1 ページが落ちても、その 20 件が欠けるだけで throw しない", async () => {
    const items = list(1, 100);
    const src = fakeSource(items);
    const flaky = async (page: number) => {
      if (page === 3) throw new Error("TMDb down");
      return src.fetchPage(page);
    };

    const page = await loadListPage([flaky], 1);

    // 41〜60 件目（TMDb の 3 ページ目）だけが欠け、後ろが前へ詰まらない
    expect(page.results.map((m) => m.id)).toEqual([
      ...items.slice(0, 40).map((m) => m.id),
      ...items.slice(60, 70).map((m) => m.id),
    ]);
    expect(page.totalPages).toBe(2);
  });

  it("TMDb のページ境界で同じ作品が 2 回来ても 1 回だけ出す", async () => {
    const items = list(1, 40);
    items[20] = items[19];

    const page = await loadListPage([fakeSource(items).fetchPage], 1);
    const ids = page.results.map((m) => m.id);

    expect(ids).toHaveLength(39);
    expect(new Set(ids).size).toBe(39);
  });

  it("全部のページが落ちたら throw する", async () => {
    await expect(loadListPage([fail], 1)).rejects.toThrow();
  });
});

describe("loadListPage: 重ならない日付順の一覧 2 つを日付で合わせる（アクション・冒険など）", () => {
  // A は 3 日おき・B は 7 日おきに公開。どちらも新しい順
  const A = datedDesc(1, 230, 3);
  const B = datedDesc(10001, 120, 7, 1);

  async function allPages(
    sources: Array<(p: number) => Promise<TMDbSearchResponse<TMDbMovie>>>,
    compare: (a: TMDbMovie, b: TMDbMovie) => number,
  ) {
    const first = await loadListPage(sources, 1, { compare });
    const pages = [first.results];
    for (let p = 2; p <= first.totalPages; p++) {
      pages.push((await loadListPage(sources, p, { compare })).results);
    }
    return { first, pages };
  }

  it("全ページを通した並びが、2 つを日付で 1 本に並べた順と一致する（ページの境目でも崩れない）", async () => {
    const { first, pages } = await allPages(
      [fakeSource(A).fetchPage, fakeSource(B).fetchPage],
      newestFirst,
    );
    const expected = [...A, ...B].sort(newestFirst).map((m) => m.id);

    expect(first.totalResults).toBe(350);
    expect(first.totalPages).toBe(5);
    expect(pages.map((p) => p.length)).toEqual([70, 70, 70, 70, 70]);
    expect(pages.flat().map((m) => m.id)).toEqual(expected);
  });

  it("古い順でも同じく 1 本の並びになる", async () => {
    const ascA = [...A].reverse();
    const ascB = [...B].reverse();

    const { pages } = await allPages(
      [fakeSource(ascA).fetchPage, fakeSource(ascB).fetchPage],
      oldestFirst,
    );
    const expected = [...A, ...B].sort(oldestFirst).map((m) => m.id);

    expect(pages.flat().map((m) => m.id)).toEqual(expected);
  });

  it("同じ日付が 2 つの一覧にまたがっても、抜けも重複も出ない", async () => {
    // 全作品が 5 日単位の同じ日付に並ぶ（境目で同日の作品が両方の一覧にある）
    const a = Array.from({ length: 150 }, (_, i) =>
      movie(1 + i, { date: day(1000 - Math.floor(i / 4) * 5) }),
    );
    const b = Array.from({ length: 90 }, (_, i) =>
      movie(5001 + i, { date: day(1000 - Math.floor(i / 3) * 5) }),
    );

    const { pages } = await allPages(
      [fakeSource(a).fetchPage, fakeSource(b).fetchPage],
      newestFirst,
    );
    const ids = pages.flat().map((m) => m.id);

    expect(ids).toHaveLength(240);
    expect(new Set(ids).size).toBe(240);
    // 日付は全体を通して新しい順のまま
    const dates = pages.flat().map((m) => m.release_date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("深いページでも前のページを全部は取らない（境目は二分探索で求める）", async () => {
    const bigA = datedDesc(1, 3000, 2);
    const bigB = datedDesc(100001, 3000, 3, 1);
    const a = fakeSource(bigA);
    const b = fakeSource(bigB);

    const page = await loadListPage([a.fetchPage, b.fetchPage], 40, {
      compare: newestFirst,
    });

    const expected = [...bigA, ...bigB]
      .sort(newestFirst)
      .slice(39 * 70, 40 * 70)
      .map((m) => m.id);
    expect(page.results.map((m) => m.id)).toEqual(expected);
    // 先頭から読むと 2730 件 = 片方あたり 70 ページ前後になる
    expect(new Set(a.calls).size + new Set(b.calls).size).toBeLessThan(40);
  });

  it("片方が尽きたら残りはもう片方で埋める", async () => {
    const short = datedDesc(1, 10, 1, 5000);
    const { pages } = await allPages(
      [fakeSource(short).fetchPage, fakeSource(B).fetchPage],
      newestFirst,
    );

    expect(pages.flat().map((m) => m.id)).toEqual(
      [...short, ...B].sort(newestFirst).map((m) => m.id),
    );
  });

  it("両方の一覧に同じ作品が来ても 1 回だけ出す", async () => {
    const a = datedDesc(1, 10, 3);
    const b = [...datedDesc(1001, 9, 7, 1), a[3]].sort(newestFirst);

    const page = await loadListPage(
      [fakeSource(a).fetchPage, fakeSource(b).fetchPage],
      1,
      { compare: newestFirst },
    );
    const ids = page.results.map((m) => m.id);

    expect(ids.filter((id) => id === a[3].id)).toHaveLength(1);
    expect(ids).toHaveLength(19);
  });

  it("片方の一覧が落ちても、もう片方の作品は出す", async () => {
    const page = await loadListPage([fail, fakeSource(B).fetchPage], 1, {
      compare: newestFirst,
    });

    expect(page.results.map((m) => m.id)).toEqual(
      B.slice(0, 70).map((m) => m.id),
    );
  });

  it("keep は合わせた後に効く（ページの境目は keep の前の並びで決める）", async () => {
    const page = await loadListPage(
      [fakeSource(A).fetchPage, fakeSource(B).fetchPage],
      1,
      { compare: newestFirst, keep: (m) => m.id > 10000 },
    );
    const expected = [...A, ...B]
      .sort(newestFirst)
      .slice(0, 70)
      .filter((m) => m.id > 10000)
      .map((m) => m.id);

    expect(page.results.map((m) => m.id)).toEqual(expected);
  });

  it("比較関数の無い合併と、3 つ以上の合併は受け付けない（並びが保証できない）", async () => {
    const s = fakeSource(A).fetchPage;

    await expect(loadListPage([s, s], 1)).rejects.toThrow();
    await expect(
      loadListPage([s, s, s], 1, { compare: newestFirst }),
    ).rejects.toThrow();
  });
});

describe("loadListPage: 同じ日付の扱い", () => {
  it("同じ日付なら先の一覧（A）を先に並べる。ページの境目でもこの順を保つ", async () => {
    const same = "2020-04-01";
    const a = Array.from({ length: 50 }, (_, i) =>
      movie(1 + i, { date: same }),
    );
    const b = Array.from({ length: 50 }, (_, i) =>
      movie(1001 + i, { date: same }),
    );
    const sources = [fakeSource(a).fetchPage, fakeSource(b).fetchPage];

    const p1 = await loadListPage(sources, 1, { compare: newestFirst });
    const p2 = await loadListPage(sources, 2, { compare: newestFirst });

    expect(p1.results.map((m) => m.id)).toEqual([
      ...a.map((m) => m.id),
      ...b.slice(0, 20).map((m) => m.id),
    ]);
    expect(p2.results.map((m) => m.id)).toEqual(b.slice(20).map((m) => m.id));
  });
});

/**
 * 取得を手で進めるソース。1 ラウンド = TMDb への往復 1 回ぶん。
 * 直列に待つ取得が増えるほどラウンド数が増える（時間に依存しない数え方）
 */
function gatedSources(lists: TMDbMovie[][]) {
  const pending: Array<() => void> = [];
  const sources = lists.map(
    (items) =>
      (page: number): Promise<TMDbSearchResponse<TMDbMovie>> =>
        new Promise((resolve) =>
          pending.push(() =>
            resolve({
              page,
              total_pages: Math.ceil(items.length / TMDB_PAGE),
              total_results: items.length,
              results: items.slice((page - 1) * TMDB_PAGE, page * TMDB_PAGE),
            }),
          ),
        ),
  );
  /** 終わるまで往復を進め、何ラウンドかかったかを返す */
  async function rounds(run: Promise<unknown>): Promise<number> {
    let done = false;
    run.then(
      () => (done = true),
      () => (done = true),
    );
    let n = 0;
    for (let guard = 0; guard < 1000; guard++) {
      // マイクロタスクを流し切ってから、その時点で待っている取得を一斉に返す
      await new Promise((r) => setTimeout(r, 0));
      if (done) return n;
      const batch = pending.splice(0);
      if (batch.length === 0) throw new Error("取得待ちが無いのに終わらない");
      n++;
      batch.forEach((resolve) => resolve());
    }
    throw new Error("終わらない");
  }
  return { sources, rounds };
}

describe("loadListPage: 合併の待ち時間", () => {
  // 3000 件 = TMDb 150 ページ。同じ TMDb ページの中の探索は使い回すので、
  // 往復が要るのは「別のページを見る探索段」だけで、その数は log2(150 + 1) 段まで
  const N = 3000;
  const bigA = datedDesc(1, N, 2);
  const bigB = datedDesc(100001, N, 3, 1);
  const searchRounds = Math.ceil(Math.log2(N / 20 + 1));

  it.each([5, 13, 40])(
    "%i ページ目: 比較する 2 件を同時に取り、先頭と末尾の境目も同時に探す（往復は 1 ページ目 + 探索 + 本体まで）",
    async (page) => {
      const { sources, rounds } = gatedSources([bigA, bigB]);
      const run = loadListPage(sources, page, { compare: newestFirst });

      const n = await rounds(run);

      // 直列に待つと 2 件 × 先頭・末尾で最大 4 倍に伸びる（直列の実装では 25 往復）
      expect(n).toBeLessThanOrEqual(1 + searchRounds + 1);
      expect((await run).results.map((m) => m.id)).toEqual(
        [...bigA, ...bigB]
          .sort(newestFirst)
          .slice((page - 1) * 70, page * 70)
          .map((m) => m.id),
      );
    },
  );
});
