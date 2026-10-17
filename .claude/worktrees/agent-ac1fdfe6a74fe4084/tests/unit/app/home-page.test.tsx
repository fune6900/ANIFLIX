import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { TMDbAnime } from "@/types/tmdb";
import { ANIME_GENRES } from "@/lib/genres";

/**
 * ホームの「探す」3 セクション（シーズン / 年代 / ジャンル）の契約（#75）。
 *
 * 3 つとも「見出し + 一覧へ → + ピル列 + 行」の同じ形に揃え、各行の
 * 「すべて見る」はその粒度の専用ページへ飛ばす。
 * `@/lib/tmdb` / `@/lib/seasonal-anime` / `@/lib/seasonal-cast` は自前の lib なのでモックする。
 */

function anime(id: number): TMDbAnime {
  return {
    id,
    name: `作品${id}`,
    original_name: `Work ${id}`,
    overview: "あらすじ",
    poster_path: `/p${id}.jpg`,
    backdrop_path: `/b${id}.jpg`,
    first_air_date: "2020-01-01",
    vote_average: 7,
    vote_count: 10,
    genre_ids: [16],
    origin_country: ["JP"],
  };
}

function page(start: number) {
  return {
    page: 1,
    total_pages: 10,
    total_results: 200,
    results: Array.from({ length: 20 }, (_, i) => anime(start + i)),
  };
}

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb")>();
  return {
    ...actual,
    getNewAnime: () => Promise.resolve(page(1000)),
    // 週間トレンド（世界の TV）。「今週のトレンド」行は /browse/trending と同じくここから取る
    getTrendingAnime: (p: number) => Promise.resolve(page(3000 + p * 100)),
    getAnimeVideos: () => Promise.resolve([]),
    getAnimeByGenre: (_id: number, p: number) => Promise.resolve(page(p * 100)),
    getAnimeByKeywords: (_k: string[], p: number) =>
      Promise.resolve(page(p * 100)),
    getAnimeByEra: (_d: number, p: number) => Promise.resolve(page(p * 100)),
  };
});

// 実物は limit を TMDb 突き合わせ前の候補数に使い、items はそれより少なく返る
// （TMDb に無い作品・劇場版が落ちる）。その目減りを再現しておく
// pastSeasonGate を差し込むと、現クール（2026 夏）以外の取得をそこで止められる
let pastSeasonGate: Promise<void> | null = null;

vi.mock("@/lib/seasonal-anime", () => ({
  fetchSeasonalAnime: async (
    y: number,
    s: string,
    opts: { limit: number },
  ) => {
    const isCurrent = y === 2026 && s === "summer";
    if (!isCurrent && pastSeasonGate) await pastSeasonGate;
    return {
      items: Array.from({ length: Math.max(0, opts.limit - 15) }, (_, i) =>
        anime(5000 + i),
      ),
    };
  },
}));

const aggregateSeasonalCast = vi.fn(() =>
  Promise.resolve(
      Array.from({ length: 25 }, (_, i) => ({
        id: 9000 + i,
        name: `声優${i}`,
        profilePath: `/va${i}.jpg`,
        topCharacter: `役${i}`,
        appearances: 1,
        bestOrder: i,
      })),
    ),
);

vi.mock("@/lib/seasonal-cast", () => ({
  aggregateSeasonalCast: () => aggregateSeasonalCast(),
}));

const { default: Home } = await import("@/app/page");

/**
 * ホームはジャンル 20 行 + 年代・シーズン行でカードが 900 枚近くになる。
 * テストごとに描き直し、ロール計算の重い getAllByRole で走査すると
 * CI のランナーでは 5 秒を超えて落ちた。1 回だけ描いて共有し、
 * リンクは querySelectorAll で拾う（アサーションは全部読み取りだけ）。
 * globals: true の Testing Library はテストごとに自動 cleanup するため、
 * 描画結果は複製して持っておく
 */
const RENDER_TIMEOUT_MS = 30_000;

beforeAll(() => {
  // 2026 夏クール。直近 4 シーズン = 2026 夏・春・冬 / 2025 秋
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T12:00:00+09:00"));
});

afterAll(() => {
  vi.useRealTimers();
});

let homeDom: HTMLElement = document.createElement("div");

function links(root: ParentNode = homeDom): HTMLAnchorElement[] {
  return [...root.querySelectorAll<HTMLAnchorElement>("a[href]")];
}

function hrefsOf(label: RegExp): string[] {
  return links()
    .filter((a) => label.test(a.textContent ?? ""))
    .map((a) => a.getAttribute("href") ?? "");
}

/** 「すべて見る」の遷移先が href の行。TOP10 行は現クールと同じ遷移先なので除く */
function rowFor(href: string): HTMLElement | null {
  const more = links().find(
    (a) =>
      a.getAttribute("href") === href &&
      /すべて見る/.test(a.textContent ?? "") &&
      !/TOP10/.test(a.closest("h2")?.textContent ?? ""),
  );
  return more?.closest("h2")?.parentElement ?? null;
}

function countLinks(row: HTMLElement | null, prefix: string): number {
  if (!row) return -1;
  return links(row).filter((a) => a.getAttribute("href")?.startsWith(prefix))
    .length;
}

describe("ホーム: 探すセクション", () => {
  beforeAll(async () => {
    const { container } = render(await Home());
    homeDom = container.cloneNode(true) as HTMLElement; // cloneNode の戻り値は Node 型
    cleanup();
  }, RENDER_TIMEOUT_MS);

  it("シーズン・年代・ジャンルそれぞれに「一覧へ →」がある", () => {
    expect(hrefsOf(/一覧へ/)).toEqual(
      expect.arrayContaining([
        "/browse/seasons",
        "/browse/eras",
        "/browse/genres",
      ]),
    );
  });

  it("直近 4 シーズンの行があり、各シーズンの専用ページへ飛ぶ", () => {
    expect(hrefsOf(/すべて見る/)).toEqual(
      expect.arrayContaining([
        "/browse/season/2026/summer",
        "/browse/season/2026/spring",
        "/browse/season/2026/winter",
        "/browse/season/2025/fall",
      ]),
    );
  });

  it("直近 3 年代の行があり、各年代の専用ページへ飛ぶ", () => {
    const hrefs = hrefsOf(/すべて見る/);

    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/browse/era/2020",
        "/browse/era/2010",
        "/browse/era/2000",
      ]),
    );
    expect(hrefs).not.toContain("/browse/era/1990");
  });

  it("ジャンルもピル列を持ち、全ジャンルへのリンクが並ぶ", () => {
    for (const genre of ANIME_GENRES) {
      const pill = links().find(
        (a) =>
          a.getAttribute("href") === `/browse/genre/${genre.id}` &&
          (a.textContent ?? "").includes(genre.name) &&
          !/すべて見る/.test(a.textContent ?? ""),
      );

      expect(pill, genre.name).toBeDefined();
    }
  });

  it("ジャンル・年代・シーズンの行は 30 件並ぶ", () => {
    for (const href of [
      `/browse/genre/${ANIME_GENRES[0].id}`,
      "/browse/era/2020",
      "/browse/season/2026/summer",
      "/browse/season/2026/spring",
      "/browse/season/2025/fall",
    ]) {
      expect(countLinks(rowFor(href), "/anime/"), href).toBe(30);
    }
  });

  it("人気声優は 20 件のまま", () => {
    const heading = [...homeDom.querySelectorAll("h2")].find((h) =>
      /人気声優/.test(h.textContent ?? ""),
    );

    expect(countLinks(heading?.parentElement ?? null, "/voice-actors/")).toBe(
      20,
    );
  });
});

describe("ホーム: 今週のトレンド", () => {
  beforeAll(async () => {
    const { container } = render(await Home());
    homeDom = container.cloneNode(true) as HTMLElement; // cloneNode の戻り値は Node 型
    cleanup();
  }, RENDER_TIMEOUT_MS);

  it("「すべて見る」の一覧（/browse/trending）と同じ週間トレンドから並べる", () => {
    // 行と一覧で取得元が違うと、行で見た作品が一覧に無い
    const heading = [...homeDom.querySelectorAll("h2")].find((h) =>
      /今週のトレンド/.test(h.textContent ?? ""),
    );
    const ids = links(heading?.parentElement ?? homeDom)
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.startsWith("/anime/"))
      .map((h) => Number(h.split("/")[2]));

    expect(ids.length).toBeGreaterThan(0);
    // 週間トレンドのモックは 3100 番台以降の id を返す
    expect(ids.every((id) => id >= 3100)).toBe(true);
  });
});

describe("ホーム: 取得の順序", () => {
  afterEach(() => {
    pastSeasonGate = null;
    aggregateSeasonalCast.mockClear();
  });

  it("過去シーズン行の取得は、声優集約など 2 段目の開始を待たせない", async () => {
    // 過去シーズンは 1 つずつ順に取るため、冷えたキャッシュでは現クールの数倍かかる。
    // 1 段目で待つと 2 段目（トレーラー・声優集約）が始まらず、ホームが真っ白のまま延びる
    let open: () => void = () => {};
    pastSeasonGate = new Promise<void>((resolve) => {
      open = resolve;
    });

    const rendering = Home();

    await vi.waitFor(() => expect(aggregateSeasonalCast).toHaveBeenCalled());

    open();
    await expect(rendering).resolves.toBeTruthy();
  });
});
