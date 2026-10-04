import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  AniListCastEdge,
  AniListCastMedia,
  AniListFeaturedCharacter,
  AniListStaff,
} from "@/types/anilist";
import type { TMDbAnime } from "@/types/tmdb";
import type { CharacterRow } from "@/types/character-home";
import { ANIME_FRANCHISES } from "@/lib/franchises";

/**
 * キャラクターページ（`/characters`）の行の組み立て（#104）。
 *
 * `@/lib/anilist` / `@/lib/seasonal-anime` は自前の lib なのでモックする
 * （fetch は素でモックしない）。声優ページ（#102）と同じ取得元（今期・前クールのキャスト、
 * シリーズのキャスト）は同じ関数・同じ引数で引き、キャッシュを共有する。
 */

// ──────────────────────────────────────────
// テストデータ
// ──────────────────────────────────────────

function voiceActor(id: number): AniListStaff {
  return {
    id,
    name: { full: `Seiyuu ${id}`, native: `声優${id}` },
    image: { large: null },
    languageV2: "Japanese",
    primaryOccupations: ["Voice Actor"],
    yearsActive: [2010],
    favourites: 10,
    dateOfBirth: { year: null, month: null, day: null },
  };
}

interface EdgeInit {
  favourites?: number | null;
  image?: string | null;
  cv?: number | null;
}

function edge(
  role: "MAIN" | "SUPPORTING" | "BACKGROUND",
  id: number,
  name: string,
  init: EdgeInit = {},
): AniListCastEdge {
  return {
    role,
    node: {
      id,
      name: { full: `Chara ${id}`, native: name },
      image: {
        large:
          init.image === undefined
            ? `https://s4.anilist.co/file/anilistcdn/character/large/c${id}.jpg`
            : init.image,
      },
      favourites: init.favourites === undefined ? 10 : init.favourites,
    },
    voiceActors: init.cv === null ? [] : [voiceActor(init.cv ?? id + 10000)],
  };
}

function media(
  id: number,
  title: string,
  edges: AniListCastEdge[],
  startYear = 2026,
): AniListCastMedia {
  return {
    id,
    title: { native: title, romaji: null, english: null },
    coverImage: { extraLarge: null, large: null },
    bannerImage: null,
    popularity: 1000 - id,
    startDate: { year: startYear, month: 4, day: 1 },
    characters: { edges },
  };
}

// 今期: 7 作品（作品C はキャラ未登録。作品G は人気 6 番手なので特集に入らない）
const CURRENT_SEASON: AniListCastMedia[] = [
  media(1, "作品A", [
    edge("MAIN", 101, "主人公A", { favourites: 500 }),
    edge("MAIN", 102, "ヒロインA", { favourites: 900 }),
    edge("SUPPORTING", 103, "脇役A", { favourites: 50 }),
  ]),
  media(2, "作品B", [
    edge("MAIN", 201, "主人公B", { favourites: 300 }),
    edge("SUPPORTING", 202, "脇役B", { favourites: 1000 }),
    // 作品A の主人公がゲスト出演（キャラの重複は 1 枚にまとめる）
    edge("SUPPORTING", 101, "主人公A", { favourites: 500 }),
  ]),
  media(3, "作品C", []),
  media(4, "作品D", [edge("MAIN", 401, "主人公D", { favourites: 40 })]),
  media(5, "作品E", [
    edge("SUPPORTING", 501, "脇役E", {
      favourites: 30,
      image:
        "https://s4.anilist.co/file/anilistcdn/character/large/default.jpg",
    }),
  ]),
  media(6, "作品F", [edge("MAIN", 601, "主人公F", { favourites: 20 })]),
  media(7, "作品G", [edge("MAIN", 701, "主人公G", { favourites: null })]),
];

// 前クール: 「人気」の境界はお気に入り 100（99 は入らない）
const PREVIOUS_SEASON: AniListCastMedia[] = [
  media(11, "前作品A", [
    edge("MAIN", 1101, "前主人公A", { favourites: 150 }),
    edge("SUPPORTING", 1102, "境界99", { favourites: 99 }),
  ]),
  media(12, "前作品B", [
    edge("MAIN", 1201, "境界100", { favourites: 100 }),
    edge("SUPPORTING", 1202, "前人気B", { favourites: 2000 }),
  ]),
];

function franchiseMedia(base: number, search: string): AniListCastMedia[] {
  return [
    media(base + 1, `${search} シリーズ${base}`, [
      edge("MAIN", base + 1, `主人公${base}`),
      edge("SUPPORTING", base + 2, `脇役${base}`),
    ]),
    media(base + 2, `${search} シリーズ${base} 第2作`, [
      edge("MAIN", base + 1, `主人公${base}`),
      edge("MAIN", base + 3, `新主人公${base}`),
    ]),
    // AniList の曖昧検索で混ざった別作品（タイトルに検索語を含まない）
    media(base + 9, "無関係な作品", [edge("MAIN", base + 9, "無関係")]),
  ];
}

interface CharacterInit {
  favourites?: number;
  birth?: { year: number | null; month: number | null; day: number | null };
  work?: string | null;
  country?: string;
  image?: string | null;
}

function character(
  id: number,
  init: CharacterInit = {},
): AniListFeaturedCharacter {
  const work = init.work === undefined ? `代表作${id}` : init.work;
  return {
    id,
    name: { full: `Chara ${id}`, native: `キャラ${id}` },
    image: {
      large:
        init.image === undefined
          ? `https://s4.anilist.co/file/anilistcdn/character/large/c${id}.jpg`
          : init.image,
    },
    favourites: init.favourites ?? 100,
    dateOfBirth: init.birth ?? { year: null, month: 1, day: 1 },
    media: {
      nodes:
        work === null
          ? []
          : [
              {
                id: id + 50000,
                title: { native: work, romaji: null, english: null },
                countryOfOrigin: init.country ?? "JP",
              },
            ],
    },
  };
}

const POPULAR_CHARACTERS: AniListFeaturedCharacter[] = [
  character(31, { favourites: 90000, work: "呪術廻戦" }),
  // 日本のアニメに出ていないキャラ（漫画のみ）は出さない
  character(32, { favourites: 80000, work: null }),
  // 海外のアニメのキャラは出さない
  character(33, { favourites: 70000, country: "US" }),
  character(34, { favourites: 60000 }),
  character(35, {
    favourites: 50000,
    image: "https://s4.anilist.co/file/anilistcdn/character/large/default.jpg",
  }),
];

// 最新アニメ映画: 12 本（先頭はキャラ未登録）。キャラの付いた新しい順に 10 本だけ使う
const LATEST_MOVIES: AniListCastMedia[] = [
  media(900, "映画0", []),
  ...Array.from({ length: 11 }, (_, i) =>
    media(901 + i, `映画${i + 1}`, [
      edge("MAIN", 9010 + i, `映画キャラ${i + 1}`),
    ]),
  ),
];

const TRENDING: AniListCastMedia[] = [
  media(21, "トレンドA", [
    edge("MAIN", 2101, "トレンド主人公A"),
    edge("SUPPORTING", 2102, "トレンド脇役A"),
  ]),
  media(22, "トレンドB", [
    edge("MAIN", 2201, "トレンド主人公B"),
    // 前作の主人公が続編にも出る
    edge("SUPPORTING", 2101, "トレンド主人公A"),
  ]),
];

// 年代: 各年代の作品は年代の境界の前後を含む（1989 年・2000 年開始は 90 年代に入らない）
const DECADES = new Map<number, AniListCastMedia[]>([
  [
    1990,
    [
      media(
        31,
        "90年代作品A",
        [
          edge("MAIN", 3101, "90主人公A", { favourites: 100 }),
          edge("SUPPORTING", 3102, "90脇役A", { favourites: 9000 }),
        ],
        1990,
      ),
      media(
        32,
        "90年代作品B",
        [edge("MAIN", 3201, "90主人公B", { favourites: 5000 })],
        1999,
      ),
      media(
        33,
        "境界1989",
        [edge("MAIN", 3301, "80年代の主人公", { favourites: 99999 })],
        1989,
      ),
      media(
        34,
        "境界2000",
        [edge("MAIN", 3401, "00年代の主人公", { favourites: 99999 })],
        2000,
      ),
    ],
  ],
  [2000, [media(41, "00年代作品", [edge("MAIN", 4101, "00主人公")], 2005)]],
  [
    2010,
    [
      media(51, "10年代作品", [edge("MAIN", 5101, "10主人公")], 2015),
      // タイトルに年が入っている作品（HUNTER×HUNTER (2011) など）
      media(
        52,
        "リメイク (2011)",
        [edge("MAIN", 5201, "リメイク主人公", { favourites: 1 })],
        2011,
      ),
    ],
  ],
]);

async function seasonCast(
  year: number,
  season: string,
): Promise<AniListCastMedia[]> {
  return year === 2026 && season === "FALL" ? CURRENT_SEASON : PREVIOUS_SEASON;
}

const anilist = {
  getAniListSeasonCast: vi.fn(seasonCast),
  getAniListFranchiseCast: vi.fn(
    async (search: string): Promise<AniListCastMedia[]> => {
      const i = ANIME_FRANCHISES.findIndex((f) => f.search === search);
      return franchiseMedia((i + 1) * 1000, search);
    },
  ),
  getAniListPopularCharacters: vi.fn(
    async (): Promise<AniListFeaturedCharacter[]> => POPULAR_CHARACTERS,
  ),
  getAniListBirthdayCharacters: vi.fn(
    async (_dateKey: string): Promise<AniListFeaturedCharacter[]> => [
      character(41, { birth: { year: null, month: 10, day: 4 } }),
      // 日本のアニメに出ていないキャラは出さない
      character(42, { birth: { year: null, month: 10, day: 4 }, work: null }),
      character(43, { birth: { year: null, month: 10, day: 4 } }),
    ],
  ),
  getAniListLatestMovieCast: vi.fn(
    async (_dateKey: string): Promise<AniListCastMedia[]> => LATEST_MOVIES,
  ),
  getAniListTrendingCast: vi.fn(
    async (): Promise<AniListCastMedia[]> => TRENDING,
  ),
  getAniListDecadeCast: vi.fn(
    async (_decades: readonly number[]) => new Map(DECADES),
  ),
};

vi.mock("@/lib/anilist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/anilist")>();
  return { ...actual, ...anilist };
});

function anime(id: number, init: Partial<TMDbAnime> = {}): TMDbAnime {
  return {
    id,
    name: `アニメ${id}`,
    original_name: `Anime ${id}`,
    overview: "あらすじ",
    poster_path: `/p${id}.jpg`,
    backdrop_path: `/b${id}.jpg`,
    first_air_date: "2026-10-01",
    vote_average: 8,
    vote_count: 10,
    genre_ids: [16],
    origin_country: ["JP"],
    ...init,
  };
}

const SEASONAL_ITEMS: TMDbAnime[] = [
  // AniList の「作品A」と同じ作品（主要キャラを添える）
  anime(501, { name: "作品A" }),
  anime(502, { backdrop_path: null }),
  anime(503, { name: "作品B" }),
  anime(504, { overview: "" }),
  // 前クールから続く作品（AniList では前クールのキャストに居る）
  anime(505, { name: "前作品A" }),
  anime(506),
  anime(507),
  anime(508),
];

const fetchSeasonalAnime = vi.fn(async () => ({ items: SEASONAL_ITEMS }));

vi.mock("@/lib/seasonal-anime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seasonal-anime")>();
  return { ...actual, fetchSeasonalAnime };
});

const home = await import("@/lib/character-home");

beforeEach(() => {
  vi.clearAllMocks();
  // 失敗を差し込んだテストが途中で落ちても、次のテストへ持ち越さない
  anilist.getAniListSeasonCast.mockImplementation(seasonCast);
  // 失敗した行のログ（console.error）でテストの出力を埋めない
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["Date"] });
  // 2026 秋クール・日本時間 10/4
  vi.setSystemTime(new Date("2026-10-04T12:00:00+09:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

function rowOf(rows: CharacterRow[], slug: string): CharacterRow {
  const row = rows.find((r) => r.slug === slug);
  if (!row) throw new Error(`row ${slug} not found`);
  return row;
}

function names(row: { cards: { name: string }[] }): string[] {
  return row.cards.map((c) => c.name);
}

// ──────────────────────────────────────────
// ホーム
// ──────────────────────────────────────────

describe("loadCharacterHome: 行の構成", () => {
  it("ISSUE の 10 種（特集 ×5・シリーズ ×5・年代 ×3 を含む）を決められた順に並べる", async () => {
    const { rows } = await home.loadCharacterHome();

    expect(rows.map((r) => r.slug)).toEqual([
      "airing",
      "leads",
      "work-1",
      "work-2",
      "work-4",
      "work-5",
      "work-6",
      ...ANIME_FRANCHISES.map((f) => `franchise-${f.slug}`),
      "ranking",
      "birthdays",
      "previous-season",
      "latest-movies",
      "trending",
      "era-1990",
      "era-2000",
      "era-2010",
    ]);
  });

  it("各行のタイトル", async () => {
    const { rows } = await home.loadCharacterHome();

    expect(rowOf(rows, "airing").title).toContain("今期放送中アニメのキャラ");
    expect(rowOf(rows, "leads").title).toContain("今期の主人公");
    expect(rowOf(rows, "work-1").title).toContain("『作品A』のキャラクター");
    expect(rowOf(rows, "franchise-pokemon").title).toContain(
      "ポケモンシリーズのキャラ",
    );
    expect(rowOf(rows, "ranking").title).toContain("人気キャラランキング");
    expect(rowOf(rows, "birthdays").title).toContain("今日が誕生日のキャラ");
    expect(rowOf(rows, "previous-season").title).toContain(
      "2026年夏の人気キャラ",
    );
    expect(rowOf(rows, "latest-movies").title).toContain(
      "最新アニメ映画のキャラ",
    );
    expect(rowOf(rows, "trending").title).toContain("今週トレンド作品のキャラ");
    expect(rowOf(rows, "era-1990").title).toContain("90年代の名作キャラ");
    expect(rowOf(rows, "era-2000").title).toContain("00年代の名作キャラ");
    expect(rowOf(rows, "era-2010").title).toContain("10年代の名作キャラ");
  });
});

describe("loadCharacterHome: 各行の中身", () => {
  it("カードはキャラ詳細（AniList のキャラ id）へ飛び、AniList の画像を使う", async () => {
    const { rows } = await home.loadCharacterHome();
    const card = rowOf(rows, "leads").cards[0];

    expect(card).toMatchObject({
      id: 101,
      name: "主人公A",
      href: "/characters/101",
      imageUrl:
        "https://s4.anilist.co/file/anilistcdn/character/large/c101.jpg",
      note: "作品A",
    });
  });

  it("今期放送中: 今期作品の全キャラをお気に入り数順に、重複なく全件", async () => {
    const { rows } = await home.loadCharacterHome();

    expect(names(rowOf(rows, "airing"))).toEqual([
      "脇役B",
      "ヒロインA",
      "主人公A",
      "主人公B",
      "脇役A",
      "主人公D",
      "脇役E",
      "主人公F",
      "主人公G",
    ]);
  });

  it("AniList の既定画像（画像なし）は画像として扱わない", async () => {
    const { rows } = await home.loadCharacterHome();
    const card = rowOf(rows, "airing").cards.find((c) => c.name === "脇役E");

    expect(card?.imageUrl).toBeNull();
  });

  it("今期の主人公: MAIN キャラだけを作品の人気順に、重複なく", async () => {
    const { rows } = await home.loadCharacterHome();

    expect(names(rowOf(rows, "leads"))).toEqual([
      "主人公A",
      "ヒロインA",
      "主人公B",
      "主人公D",
      "主人公F",
      "主人公G",
    ]);
  });

  it("今期人気作品の特集: キャラの付いた人気上位 5 作品。各行は作品の全キャラと声優", async () => {
    const { rows } = await home.loadCharacterHome();

    // 作品C はキャラ未登録なので飛ばし、作品G（6 番目）は入らない
    expect(rows.filter((r) => r.slug.startsWith("work-"))).toHaveLength(5);
    const work = rowOf(rows, "work-1");
    expect(names(work)).toEqual(["主人公A", "ヒロインA", "脇役A"]);
    expect(work.cards[0].note).toBe("CV: 声優10101");
  });

  it("定番シリーズ: シリーズの全作品を通したキャラ。出演作品数の多い順", async () => {
    const { rows } = await home.loadCharacterHome();

    // ONE PIECE（MAIN 以外も含める）: 2 作品に出る主人公が先頭、脇役も入る
    const onePiece = rowOf(rows, "franchise-one-piece");
    expect(names(onePiece)).toEqual(["主人公3000", "脇役3000", "新主人公3000"]);
    expect(onePiece.cards[0].note).toContain("2作品");

    // プリキュア（作品が多いので MAIN だけ）: 脇役は入らない
    expect(names(rowOf(rows, "franchise-precure"))).toEqual([
      "主人公5000",
      "新主人公5000",
    ]);
  });

  it("定番シリーズ: タイトルに検索語を含まない作品（曖昧検索の混入）のキャラは入れない", async () => {
    const { rows } = await home.loadCharacterHome();

    for (const f of ANIME_FRANCHISES) {
      expect(names(rowOf(rows, `franchise-${f.slug}`)), f.name).not.toContain(
        "無関係",
      );
    }
  });

  it("定番シリーズは声優ページと同じ検索語・同じ件数で引く（キャッシュを共有する）", async () => {
    await home.loadCharacterHome();

    for (const f of ANIME_FRANCHISES) {
      expect(anilist.getAniListFranchiseCast).toHaveBeenCalledWith(
        f.search,
        f.castPerWork,
      );
    }
  });

  it("人気キャラランキング: 日本のアニメのキャラだけをお気に入り数順に、順位付きで", async () => {
    const { rows } = await home.loadCharacterHome();
    const row = rowOf(rows, "ranking");

    expect(names(row)).toEqual(["キャラ31", "キャラ34", "キャラ35"]);
    expect(row.cards[0].note).toBe("1位 · 呪術廻戦");
    expect(row.cards[1].note).toContain("2位");
    expect(row.cards[2].imageUrl).toBeNull();
  });

  it("今日が誕生日: 日本時間の日付をキャッシュキーに渡し、日本のアニメのキャラを並べる", async () => {
    const { rows } = await home.loadCharacterHome();
    const row = rowOf(rows, "birthdays");

    expect(anilist.getAniListBirthdayCharacters).toHaveBeenCalledWith(
      "2026-10-04",
    );
    expect(row.title).toBe("🎂 今日が誕生日のキャラ");
    expect(names(row)).toEqual(["キャラ41", "キャラ43"]);
    expect(row.cards[0].note).toBe("代表作41");
  });

  it("誕生日: 返ってきた誕生日が日本の今日でなければ、見出しにその日付を出す", async () => {
    anilist.getAniListBirthdayCharacters.mockResolvedValueOnce([
      character(44, { birth: { year: null, month: 10, day: 3 } }),
    ]);

    const row = rowOf((await home.loadCharacterHome()).rows, "birthdays");

    expect(row.title).toBe("🎂 10月3日が誕生日のキャラ");
    expect(names(row)).toEqual(["キャラ44"]);
  });

  it("前クールの人気キャラ: お気に入り 100 以上を多い順に（99 は入らない）", async () => {
    const { rows } = await home.loadCharacterHome();

    expect(anilist.getAniListSeasonCast).toHaveBeenCalledWith(2026, "SUMMER");
    expect(names(rowOf(rows, "previous-season"))).toEqual([
      "前人気B",
      "前主人公A",
      "境界100",
    ]);
  });

  it("最新アニメ映画: 日本時間の今日より前の映画のうち、キャラの付いた新しい 10 本", async () => {
    const { rows } = await home.loadCharacterHome();
    const row = rowOf(rows, "latest-movies");

    expect(anilist.getAniListLatestMovieCast).toHaveBeenCalledWith(
      "2026-10-04",
    );
    expect(names(row)).toEqual(
      Array.from({ length: 10 }, (_, i) => `映画キャラ${i + 1}`),
    );
    expect(row.cards[0].note).toBe("映画1");
  });

  it("今週トレンド作品: トレンド順の作品のキャラを、重複なく", async () => {
    const { rows } = await home.loadCharacterHome();

    expect(names(rowOf(rows, "trending"))).toEqual([
      "トレンド主人公A",
      "トレンド脇役A",
      "トレンド主人公B",
    ]);
  });

  it("年代別名作: 年代の人気作の MAIN キャラをお気に入り数順に", async () => {
    const { rows } = await home.loadCharacterHome();

    expect(anilist.getAniListDecadeCast).toHaveBeenCalledWith([
      1990, 2000, 2010,
    ]);
    const row = rowOf(rows, "era-1990");
    // 脇役は入らない
    expect(names(row)).toEqual(["90主人公B", "90主人公A"]);
    expect(row.cards[0].note).toBe("90年代作品B (1999)");
    expect(names(rowOf(rows, "era-2000"))).toEqual(["00主人公"]);
    const era2010 = rowOf(rows, "era-2010");
    expect(names(era2010)).toEqual(["10主人公", "リメイク主人公"]);
    // タイトルに年が入っていれば重ねない
    expect(era2010.cards[1].note).toBe("リメイク (2011)");
  });

  it("年代の境界: 1989 年・2000 年に始まった作品は 90 年代に入らない", async () => {
    const row = rowOf((await home.loadCharacterHome()).rows, "era-1990");

    expect(names(row)).not.toContain("80年代の主人公");
    expect(names(row)).not.toContain("00年代の主人公");
  });
});

describe("loadCharacterHome: Hero", () => {
  it("今期人気作品のうち背景画像・あらすじの揃った 6 件と、その主要キャラ", async () => {
    const { hero } = await home.loadCharacterHome();

    expect(hero.map((h) => h.anime.id)).toEqual([501, 503, 505, 506, 507, 508]);
    // AniList の同じ作品の MAIN キャラ（TMDb の役名は英語なので使わない）
    expect(hero[0].mainCharacters).toEqual(["主人公A", "ヒロインA"]);
    expect(hero[1].mainCharacters).toEqual(["主人公B"]);
    // 前クールから続く 2 クール作品は前クールのキャストから引く
    expect(hero[2].mainCharacters).toEqual(["前主人公A"]);
    // AniList に同じ作品が無ければ添えない
    expect(hero[3].mainCharacters).toEqual([]);
  });

  it("今期のキャストが取れなくても Hero は出す（主要キャラを添えないだけ）", async () => {
    anilist.getAniListSeasonCast.mockImplementation(async (year, season) => {
      if (year === 2026 && season === "FALL") throw new Error("boom");
      return PREVIOUS_SEASON;
    });

    const { hero } = await home.loadCharacterHome();

    expect(hero).toHaveLength(6);
    expect(hero[0].mainCharacters).toEqual([]);
    // 前クールのキャストは取れているので、前クールから続く作品には添える
    expect(hero[2].mainCharacters).toEqual(["前主人公A"]);

  });
});

describe("loadCharacterHome: 失敗の隔離と問い合わせ回数", () => {
  it("1 行の取得が失敗しても他の行は残る", async () => {
    anilist.getAniListFranchiseCast.mockRejectedValueOnce(new Error("boom"));
    anilist.getAniListBirthdayCharacters.mockRejectedValueOnce(
      new Error("boom"),
    );
    anilist.getAniListDecadeCast.mockRejectedValueOnce(new Error("boom"));

    const { rows } = await home.loadCharacterHome();

    expect(rowOf(rows, "franchise-pokemon").cards).toEqual([]);
    expect(rowOf(rows, "birthdays").cards).toEqual([]);
    expect(rowOf(rows, "era-1990").cards).toEqual([]);
    expect(rowOf(rows, "era-2010").cards).toEqual([]);
    expect(rowOf(rows, "franchise-conan").cards.length).toBeGreaterThan(0);
    expect(rowOf(rows, "ranking").cards.length).toBeGreaterThan(0);
    expect(rowOf(rows, "trending").cards.length).toBeGreaterThan(0);
  });

  it("今期の取得が失敗すると、特集行は出さずに他の行を返す", async () => {
    anilist.getAniListSeasonCast.mockImplementation(async (year, season) => {
      if (year === 2026 && season === "FALL") throw new Error("boom");
      return PREVIOUS_SEASON;
    });

    const { rows } = await home.loadCharacterHome();

    expect(rows.some((r) => r.slug.startsWith("work-"))).toBe(false);
    expect(rowOf(rows, "airing").cards).toEqual([]);
    expect(rowOf(rows, "leads").cards).toEqual([]);
    expect(rowOf(rows, "previous-season").cards.length).toBeGreaterThan(0);

  });

  it("同じ取得元は 1 回だけ引く（AniList は 1 描画 12 回 + シーズン一覧）", async () => {
    await home.loadCharacterHome();

    // 今期・前クールのキャストは声優ページと同じ引数（= 同じキャッシュ）
    expect(anilist.getAniListSeasonCast).toHaveBeenCalledTimes(2);
    expect(anilist.getAniListSeasonCast.mock.calls).toEqual([
      [2026, "FALL"],
      [2026, "SUMMER"],
    ]);
    expect(anilist.getAniListFranchiseCast).toHaveBeenCalledTimes(
      ANIME_FRANCHISES.length,
    );
    expect(anilist.getAniListPopularCharacters).toHaveBeenCalledTimes(1);
    expect(anilist.getAniListBirthdayCharacters).toHaveBeenCalledTimes(1);
    expect(anilist.getAniListLatestMovieCast).toHaveBeenCalledTimes(1);
    expect(anilist.getAniListTrendingCast).toHaveBeenCalledTimes(1);
    // 3 つの年代は 1 回の問い合わせにまとめる
    expect(anilist.getAniListDecadeCast).toHaveBeenCalledTimes(1);
    expect(fetchSeasonalAnime).toHaveBeenCalledTimes(1);
    // 声優ページと同じ件数で引く（TMDb の照合結果のキャッシュを共有する）
    expect(fetchSeasonalAnime).toHaveBeenCalledWith(2026, "fall", {
      limit: 30,
    });
  });
});

// ──────────────────────────────────────────
// 「すべて見る」の専用ページ
// ──────────────────────────────────────────

describe("loadCharacterCollection", () => {
  it("ホームの行と同じ中身を返す（行は全件表示なので一致する）", async () => {
    const { rows } = await home.loadCharacterHome();
    for (const slug of [
      "airing",
      "leads",
      "ranking",
      "birthdays",
      "previous-season",
      "latest-movies",
      "trending",
      "era-1990",
      "era-2010",
      "work-1",
      "franchise-precure",
    ]) {
      const collection = await home.loadCharacterCollection(slug);
      expect(collection, slug).toEqual(rowOf(rows, slug));
    }
  });

  it("未知の slug は null（ページ側で 404）", async () => {
    for (const slug of [
      "unknown",
      "franchise-naruto",
      "franchise-",
      "work-abc",
      "work-01",
      "work-1/../x",
      "era-1980",
      "era-2020",
      "era-199",
      "era-1990x",
    ]) {
      expect(await home.loadCharacterCollection(slug), slug).toBeNull();
    }
  });

  it("プロトタイプのキー（constructor / __proto__ / toString）は null", async () => {
    for (const slug of [
      "constructor",
      "__proto__",
      "toString",
      "hasOwnProperty",
      "franchise-constructor",
      "franchise-__proto__",
    ]) {
      expect(await home.loadCharacterCollection(slug), slug).toBeNull();
    }
    expect(anilist.getAniListSeasonCast).not.toHaveBeenCalled();
    expect(anilist.getAniListFranchiseCast).not.toHaveBeenCalled();
  });

  it("特集に入っていない作品 id は null。id を AniList へ渡さない", async () => {
    // 作品G（7）は人気上位 5 作品の外、99999 は今期に存在しない
    expect(await home.loadCharacterCollection("work-7")).toBeNull();
    expect(await home.loadCharacterCollection("work-99999")).toBeNull();

    expect(anilist.getAniListSeasonCast.mock.calls.length).toBeGreaterThan(0);
    for (const call of anilist.getAniListSeasonCast.mock.calls) {
      expect(call).toEqual([2026, "FALL"]);
    }
  });

  it("その行に要る取得元だけを引く", async () => {
    await home.loadCharacterCollection("franchise-conan");

    expect(anilist.getAniListFranchiseCast).toHaveBeenCalledTimes(1);
    expect(anilist.getAniListSeasonCast).not.toHaveBeenCalled();
    expect(anilist.getAniListDecadeCast).not.toHaveBeenCalled();
    expect(fetchSeasonalAnime).not.toHaveBeenCalled();

    vi.clearAllMocks();
    await home.loadCharacterCollection("era-2000");

    expect(anilist.getAniListDecadeCast).toHaveBeenCalledTimes(1);
    expect(anilist.getAniListSeasonCast).not.toHaveBeenCalled();
    expect(anilist.getAniListFranchiseCast).not.toHaveBeenCalled();
  });

  it("専用ページの URL", () => {
    expect(home.characterCollectionHref("ranking")).toBe(
      "/characters/collections/ranking",
    );
  });
});
