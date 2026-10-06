import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { TMDbAnime, TMDbVideo } from "@/types/tmdb";
import { ANIME_STUDIOS } from "@/lib/studios";
import type { StudioHome } from "@/lib/studio-home";

/**
 * 制作会社ホーム（`/browse/studios`、#117）。
 *
 * 行・カルーセルの中身の組み立ては `tests/unit/lib/studio-home.test.ts` が受け持つ。
 * ここではピル・行の並びと遷移先、空の行を隠すこと、予告編の失敗で落ちないことを見る。
 * `@/lib/studio-home` / `@/lib/tmdb` は自前の lib なのでモックする。
 */

function anime(id: number): TMDbAnime {
  return {
    id,
    name: `作品${id}`,
    original_name: `Anime ${id}`,
    overview: "あらすじ",
    poster_path: `/p${id}.jpg`,
    backdrop_path: `/b${id}.jpg`,
    first_air_date: "2020-04-01",
    vote_average: 8,
    vote_count: 100,
    genre_ids: [16],
    origin_country: ["JP"],
  };
}

function list(base: number, n: number): TMDbAnime[] {
  return Array.from({ length: n }, (_, i) => anime(base + i));
}

const HOME: StudioHome = {
  hero: list(1, 6),
  rows: ANIME_STUDIOS.map((studio, i) => ({
    studio,
    anime: list(1000 + i * 100, 20),
  })),
};

let currentHome: StudioHome = HOME;

vi.mock("@/lib/studio-home", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/studio-home")>();
  return { ...actual, loadStudioHome: async () => currentHome };
});

const getAnimeVideos = vi.fn(async (_id: number): Promise<TMDbVideo[]> => [
  {
    id: "v",
    key: "yt-key",
    name: "PV",
    site: "YouTube",
    type: "Trailer",
    official: true,
  },
]);

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb")>();
  return { ...actual, getAnimeVideos };
});

// HeroSection 等のクライアントコンポーネントが useRouter を使う（例外 3）
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/browse/studios",
}));

const { default: StudiosPage } = await import("@/app/browse/studios/page");

async function renderPage(): Promise<HTMLElement> {
  const { container } = render(await StudiosPage());
  const dom = container.cloneNode(true) as HTMLElement; // cloneNode の戻り値は Node 型
  cleanup();
  return dom;
}

function headings(root: HTMLElement): string[] {
  return [...root.querySelectorAll("h2")].map((h) => h.textContent ?? "");
}

function indexOfRow(all: string[], title: string): number {
  return all.findIndex((h) => h.includes(title));
}

function rowOf(root: HTMLElement, title: string): HTMLElement | null {
  const h = [...root.querySelectorAll("h2")].find((x) =>
    (x.textContent ?? "").includes(title),
  );
  return h?.parentElement ?? null;
}

function seeAllOf(root: HTMLElement, title: string): string | undefined {
  const h = [...root.querySelectorAll("h2")].find((x) =>
    (x.textContent ?? "").includes(title),
  );
  const a = [...(h?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])].find(
    (x) => /すべて見る/.test(x.textContent ?? ""),
  );
  return a?.getAttribute("href") ?? undefined;
}

function pillsOf(root: HTMLElement): HTMLAnchorElement[] {
  const nav = root.querySelector('[aria-label="制作会社一覧"]');
  return [...(nav?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])];
}

// 初回の描画はクライアントコンポーネントの読み込みで時間がかかる
beforeAll(async () => {
  await renderPage();
}, 30_000);

afterEach(() => {
  currentHome = HOME;
  getAnimeVideos.mockClear();
});

describe("制作会社ホーム", { timeout: 30_000 }, () => {
  it("全社へのピルを定義の順に並べ、各社の一覧ページへ飛ばす", async () => {
    const pills = pillsOf(await renderPage());

    expect(pills.map((a) => a.getAttribute("href"))).toEqual(
      ANIME_STUDIOS.map((s) => `/browse/studio/${s.id}`),
    );
    for (const [i, a] of pills.entries()) {
      expect(a.textContent, ANIME_STUDIOS[i].name).toContain(
        ANIME_STUDIOS[i].name,
      );
    }
  });

  it("ピルは各社の色で塗る", async () => {
    const pills = pillsOf(await renderPage());

    for (const [i, a] of pills.entries()) {
      const s = ANIME_STUDIOS[i];
      for (const cls of s.color.split(" ")) {
        expect(a.className, s.name).toContain(cls);
      }
    }
  });

  it("各社 1 行を定義の順に、`${emoji} ${name}` の見出しで並べる", async () => {
    const all = headings(await renderPage());

    const positions = ANIME_STUDIOS.map((s) =>
      indexOfRow(all, `${s.emoji} ${s.name}`),
    );
    for (const [i, p] of positions.entries()) {
      expect(p, ANIME_STUDIOS[i].name).toBeGreaterThanOrEqual(0);
    }
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("「すべて見る」は各社の一覧ページへ", async () => {
    const dom = await renderPage();

    for (const s of ANIME_STUDIOS) {
      expect(seeAllOf(dom, s.name), s.name).toBe(`/browse/studio/${s.id}`);
    }
  });

  it("行のカードは TV アニメの詳細ページへ飛び、20 件並ぶ", async () => {
    const dom = await renderPage();
    const row = rowOf(dom, ANIME_STUDIOS[0].name);
    expect(row).not.toBeNull();
    const hrefs = [...(row?.querySelectorAll("a[href]") ?? [])]
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.startsWith("/anime/"));

    expect(hrefs).toHaveLength(20);
    expect(hrefs[0]).toBe("/anime/1000");
  });

  it("作品が 0 件の社は行を出さない（ピルは残す）", async () => {
    currentHome = {
      ...HOME,
      rows: HOME.rows.map((row, i) =>
        i % 2 === 0 ? row : { ...row, anime: [] },
      ),
    };
    const dom = await renderPage();
    const all = headings(dom);

    for (const [i, s] of ANIME_STUDIOS.entries()) {
      const shown = indexOfRow(all, s.name) >= 0;
      expect(shown, s.name).toBe(i % 2 === 0);
    }
    expect(pillsOf(dom)).toHaveLength(ANIME_STUDIOS.length);
  });

  it("カルーセルに作品を流し、予告編を作品ごとに引く", async () => {
    const dom = await renderPage();

    expect(dom.textContent).toContain(HOME.hero[0].name);
    expect(dom.querySelector('[aria-label="次のスライド"]')).not.toBeNull();
    expect(getAnimeVideos.mock.calls.map(([id]) => id)).toEqual(
      HOME.hero.map((a) => a.id),
    );
  });

  it("予告編の取得が失敗してもページは落ちない", async () => {
    getAnimeVideos.mockRejectedValueOnce(new Error("TMDb 500"));

    const dom = await renderPage();

    expect(dom.textContent).toContain(HOME.hero[0].name);
    expect(headings(dom).length).toBeGreaterThan(0);
  });

  it("全行・カルーセルが空でもページは出る（ピルだけ残る）", async () => {
    currentHome = {
      hero: [],
      rows: HOME.rows.map((row) => ({ ...row, anime: [] })),
    };
    const dom = await renderPage();

    expect(pillsOf(dom)).toHaveLength(ANIME_STUDIOS.length);
    expect(getAnimeVideos).not.toHaveBeenCalled();
  });
});
