import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  AniListCastEdge,
  AniListCastMedia,
  AniListStaff,
} from "@/types/anilist";
import type { TMDbAnime, TMDbCastMember, TMDbMovie } from "@/types/tmdb";
import type { VoiceActorRow } from "@/types/voice-actor-home";
import { ANIME_FRANCHISES } from "@/lib/franchises";

/**
 * 声優ページ（`/voice-actors`）の行の組み立て（#102）。
 *
 * `@/lib/anilist` / `@/lib/tmdb` / `@/lib/seasonal-anime` は自前の lib なのでモックする
 * （fetch は素でモックしない）。`@/lib/seasonal-cast` は実物を使う（TMDb の credits を
 * 集約するだけの純粋な処理なので、`@/lib/tmdb` のモック越しに検証できる）。
 */

// ──────────────────────────────────────────
// テストデータ
// ──────────────────────────────────────────

interface StaffInit {
  native?: string | null;
  full?: string;
  language?: string;
  occupations?: string[];
  years?: number[];
  favourites?: number;
  birth?: { year: number | null; month: number | null; day: number | null };
  image?: string | null;
}

function staff(id: number, init: StaffInit = {}): AniListStaff {
  return {
    id,
    name: {
      full: init.full ?? `Seiyuu ${id}`,
      native: init.native === undefined ? `声優${id}` : init.native,
    },
    image: {
      large:
        init.image === undefined
          ? `https://s4.anilist.co/file/anilistcdn/staff/large/n${id}.jpg`
          : init.image,
    },
    languageV2: init.language ?? "Japanese",
    primaryOccupations: init.occupations ?? ["Voice Actor"],
    yearsActive: init.years ?? [2005],
    favourites: init.favourites ?? 100,
    dateOfBirth: init.birth ?? { year: 1990, month: 1, day: 1 },
  };
}

function edge(
  role: "MAIN" | "SUPPORTING" | "BACKGROUND",
  character: string,
  voiceActors: AniListStaff[],
): AniListCastEdge {
  return {
    role,
    node: {
      id: voiceActors[0]?.id ?? 0,
      name: { full: character, native: character },
      image: { large: null },
    },
    voiceActors,
  };
}

function media(
  id: number,
  title: string,
  edges: AniListCastEdge[],
): AniListCastMedia {
  return {
    id,
    title: { native: title, romaji: null, english: null },
    coverImage: { extraLarge: null, large: null },
    bannerImage: null,
    popularity: 1000 - id,
    startDate: { year: 2026, month: 10, day: 1 },
    characters: { edges },
  };
}

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

function movie(id: number): TMDbMovie {
  return {
    id,
    title: `映画${id}`,
    original_title: `Movie ${id}`,
    overview: "あらすじ",
    poster_path: `/p${id}.jpg`,
    backdrop_path: `/b${id}.jpg`,
    release_date: "2026-09-01",
    vote_average: 7,
    vote_count: 10,
    genre_ids: [16],
  };
}

function cast(
  id: number,
  order: number,
  character = `役${id}`,
): TMDbCastMember {
  return {
    id,
    name: `TMDb声優${id}`,
    original_name: `TMDb Seiyuu ${id}`,
    character,
    profile_path: `/v${id}.jpg`,
    order,
  };
}

// 今期: 7 作品（先頭 6 作品に声優が付き、7 作品目は未発表でキャストが空）
const CURRENT_SEASON: AniListCastMedia[] = [
  media(1, "作品A", [
    edge("MAIN", "主人公A", [staff(11, { years: [2020] })]),
    edge("MAIN", "ヒロインA", [staff(12)]),
    edge("SUPPORTING", "脇役A", [staff(13, { years: [1985] })]),
  ]),
  media(2, "作品B", [
    edge("MAIN", "主人公B", [staff(11, { years: [2020] })]),
    edge("SUPPORTING", "脇役B", [staff(14)]),
  ]),
  media(3, "作品C", []),
  media(4, "作品D", [edge("MAIN", "主人公D", [staff(15)])]),
  media(5, "作品E", [edge("SUPPORTING", "脇役E", [staff(16)])]),
  media(6, "作品F", [edge("MAIN", "主人公F", [staff(17)])]),
  media(7, "作品G", [edge("MAIN", "主人公G", [staff(18)])]),
];

// 前クール: 21 は 2 作品、22 は 1 作品
const PREVIOUS_SEASON: AniListCastMedia[] = [
  media(101, "前作品A", [
    edge("MAIN", "前主人公A", [staff(21, { years: [2018] })]),
    edge("SUPPORTING", "前脇役A", [staff(22)]),
  ]),
  media(102, "前作品B", [
    edge("SUPPORTING", "前脇役B", [staff(21, { years: [2018] })]),
  ]),
];

const POPULAR_PAGES: Record<number, AniListStaff[]> = {
  1: [
    staff(31, { favourites: 900, years: [1995] }),
    // 漫画家は声優ではない
    staff(32, { favourites: 800, occupations: ["Mangaka"] }),
    // 日本語の声優ではない
    staff(33, { favourites: 700, language: "English" }),
    staff(34, { favourites: 600, years: [1980] }),
  ],
  2: [
    staff(35, { favourites: 500, years: [2019] }),
    staff(36, {
      favourites: 400,
      image: "https://s4.anilist.co/file/anilistcdn/staff/large/default.jpg",
    }),
  ],
};

function franchiseMedia(base: number): AniListCastMedia[] {
  return [
    media(base + 1, `シリーズ${base}`, [
      edge("MAIN", `主人公${base}`, [staff(base + 1)]),
      edge("SUPPORTING", `脇役${base}`, [staff(base + 2)]),
    ]),
    media(base + 2, `シリーズ${base} 第2作`, [
      edge("MAIN", `主人公${base}`, [staff(base + 1)]),
      edge("MAIN", `新主人公${base}`, [staff(base + 3)]),
    ]),
  ];
}

const anilist = {
  getAniListSeasonCast: vi.fn(
    async (year: number, season: string): Promise<AniListCastMedia[]> =>
      year === 2026 && season === "FALL" ? CURRENT_SEASON : PREVIOUS_SEASON,
  ),
  getAniListFranchiseCast: vi.fn(
    async (search: string): Promise<AniListCastMedia[]> => {
      const i = ANIME_FRANCHISES.findIndex((f) => f.search === search);
      // シリーズの作品名は検索語を含む（含まない作品は除外される）
      return franchiseMedia((i + 1) * 1000).map((m) => ({
        ...m,
        title: { ...m.title, native: `${search} ${m.title.native}` },
      }));
    },
  ),
  getAniListPopularStaff: vi.fn(
    async (page: number): Promise<AniListStaff[]> => POPULAR_PAGES[page] ?? [],
  ),
  getAniListBirthdayStaff: vi.fn(
    async (_dateKey: string): Promise<AniListStaff[]> => [
      staff(41, { birth: { year: 1996, month: 10, day: 4 } }),
      staff(42, {
        birth: { year: null, month: 10, day: 4 },
        occupations: ["Director"],
      }),
      staff(43, { birth: { year: null, month: 10, day: 4 } }),
    ],
  ),
};

vi.mock("@/lib/anilist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/anilist")>();
  return { ...actual, ...anilist };
});

const SEASONAL_ITEMS: TMDbAnime[] = [
  anime(501),
  anime(502, { backdrop_path: null }),
  anime(503),
  anime(504, { overview: "" }),
  anime(505),
  anime(506),
  anime(507),
  anime(508),
  anime(509),
];

const fetchSeasonalAnime = vi.fn(async () => ({ items: SEASONAL_ITEMS }));

vi.mock("@/lib/seasonal-anime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seasonal-anime")>();
  return { ...actual, fetchSeasonalAnime };
});

const LATEST_MOVIES: TMDbMovie[] = [
  movie(801),
  { ...movie(802), poster_path: null },
  movie(803),
];

const tmdb = {
  getAnimeCredits: vi.fn(async (id: number) => ({
    // 出演順を逆に入れておき、順位で並べ直すことを確かめる
    cast: [
      cast(id * 10 + 3, 3),
      cast(id * 10 + 2, 2),
      cast(id * 10 + 1, 1),
      cast(7, 0, "常連 (voice)"),
    ],
  })),
  getMovieCredits: vi.fn(async (id: number) => ({
    cast: [cast(id * 10 + 1, 0), cast(9, 1, "映画常連")],
  })),
  getLatestAnimeMovies: vi.fn(async (_page: number) => ({
    page: 1,
    total_pages: 1,
    total_results: LATEST_MOVIES.length,
    results: LATEST_MOVIES,
  })),
};

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb")>();
  return { ...actual, ...tmdb };
});

const home = await import("@/lib/voice-actor-home");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  // 2026 秋クール・日本時間 10/4
  vi.setSystemTime(new Date("2026-10-04T12:00:00+09:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

function rowOf(rows: VoiceActorRow[], slug: string): VoiceActorRow {
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

describe("loadVoiceActorHome: 行の構成", () => {
  it("ISSUE の 10 種（特集 ×5・シリーズ ×5 を含む）を決められた順に並べる", async () => {
    const { rows } = await home.loadVoiceActorHome();

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
      "new-generation",
      "legends",
    ]);
  });

  it("各行のタイトル", async () => {
    const { rows } = await home.loadVoiceActorHome();

    expect(rowOf(rows, "airing").title).toContain("今期放送中アニメの声優");
    expect(rowOf(rows, "leads").title).toContain("今期の主演声優");
    expect(rowOf(rows, "work-1").title).toContain("『作品A』の声優");
    expect(rowOf(rows, "franchise-pokemon").title).toContain("ポケモン");
    expect(rowOf(rows, "ranking").title).toContain("人気声優ランキング");
    expect(rowOf(rows, "birthdays").title).toContain("今日が誕生日の声優");
    expect(rowOf(rows, "previous-season").title).toContain(
      "2026年夏に活躍した声優",
    );
    expect(rowOf(rows, "latest-movies").title).toContain(
      "最新アニメ映画の声優",
    );
    expect(rowOf(rows, "new-generation").title).toContain("新世代の声優");
    expect(rowOf(rows, "legends").title).toContain("レジェンド声優");
  });

  it("定番シリーズは ポケモン / 名探偵コナン / ONE PIECE / 機動戦士ガンダム / プリキュア", () => {
    expect(ANIME_FRANCHISES.map((f) => f.name)).toEqual([
      "ポケモン",
      "名探偵コナン",
      "ONE PIECE",
      "機動戦士ガンダム",
      "プリキュア",
    ]);
  });
});

describe("loadVoiceActorHome: 各行の中身", () => {
  it("今期放送中: 今期作品のキャストを出演本数順に、全件（切り詰めない）", async () => {
    const { rows } = await home.loadVoiceActorHome();
    const row = rowOf(rows, "airing");

    // 9 作品 × order 0〜3 のうち、全作品に出る 7 番が先頭
    expect(row.cards[0]).toMatchObject({
      id: 7,
      name: "TMDb声優7",
      href: "/voice-actors/7",
      imageUrl: "https://image.tmdb.org/t/p/w342/v7.jpg",
    });
    expect(row.cards).toHaveLength(1 + SEASONAL_ITEMS.length * 3);
    // TMDb の役名に付く " (voice)" は落とす
    expect(row.cards[0].note).toBe("9作品 · 役: 常連");
    expect(fetchSeasonalAnime).toHaveBeenCalledWith(2026, "fall", {
      limit: 30,
    });
  });

  it("今期の主演: MAIN キャラの声優だけを作品の人気順に、重複なく", async () => {
    const { rows } = await home.loadVoiceActorHome();
    const row = rowOf(rows, "leads");

    expect(names(row)).toEqual([
      "声優11",
      "声優12",
      "声優15",
      "声優17",
      "声優18",
    ]);
    expect(row.cards[0].note).toContain("主人公A");
  });

  it("AniList の声優は TMDb の人物へ名前で解決するリンクにする", async () => {
    const { rows } = await home.loadVoiceActorHome();
    const card = rowOf(rows, "leads").cards[0];

    expect(card.href).toBe(
      `/voice-actors/resolve?name=${encodeURIComponent("声優11")}`,
    );
    expect(card.imageUrl).toBe(
      "https://s4.anilist.co/file/anilistcdn/staff/large/n11.jpg",
    );
  });

  it("今期人気作品の特集: キャストの付いた人気上位 5 作品。各行は作品の全声優", async () => {
    const { rows } = await home.loadVoiceActorHome();

    // 作品C はキャスト未発表なので飛ばし、作品G（6 番目）は入らない
    expect(rows.filter((r) => r.slug.startsWith("work-"))).toHaveLength(5);
    expect(names(rowOf(rows, "work-1"))).toEqual([
      "声優11",
      "声優12",
      "声優13",
    ]);
  });

  it("定番シリーズ: シリーズの全作品を通した声優。出演作品数の多い順", async () => {
    const { rows } = await home.loadVoiceActorHome();

    for (const f of ANIME_FRANCHISES) {
      const row = rowOf(rows, `franchise-${f.slug}`);
      expect(row.cards.length, f.name).toBeGreaterThan(0);
    }
    // ONE PIECE（MAIN 以外も含める）: 2 作品に出る主人公役が先頭、脇役も入る
    const onePiece = rowOf(rows, "franchise-one-piece");
    expect(names(onePiece)).toEqual(["声優3001", "声優3002", "声優3003"]);
    expect(onePiece.cards[0].note).toContain("2作品");

    // プリキュア（シリーズ作品が多いので MAIN だけ）: 脇役は入らない
    const precure = rowOf(rows, "franchise-precure");
    expect(names(precure)).toEqual(["声優5001", "声優5003"]);
  });

  it("人気声優ランキング: 日本語の声優だけをお気に入り数順に、順位付きで", async () => {
    const { rows } = await home.loadVoiceActorHome();
    const row = rowOf(rows, "ranking");

    expect(names(row)).toEqual(["声優31", "声優34", "声優35", "声優36"]);
    expect(row.cards[0].note).toContain("1位");
    // AniList の既定画像（写真なし）は画像として扱わない
    expect(row.cards[3].imageUrl).toBeNull();
  });

  it("今日が誕生日: 日本時間の日付をキャッシュキーに渡し、声優だけを並べる", async () => {
    const { rows } = await home.loadVoiceActorHome();
    const row = rowOf(rows, "birthdays");

    expect(anilist.getAniListBirthdayStaff).toHaveBeenCalledWith("2026-10-04");
    expect(names(row)).toEqual(["声優41", "声優43"]);
    expect(row.cards[0].note).toContain("30歳");
  });

  it("前クールに活躍: 前クールの 2 作品以上に出た声優", async () => {
    const { rows } = await home.loadVoiceActorHome();

    expect(anilist.getAniListSeasonCast).toHaveBeenCalledWith(2026, "SUMMER");
    expect(names(rowOf(rows, "previous-season"))).toEqual(["声優21"]);
  });

  it("最新アニメ映画: ポスターのある最新作のキャストを集約する", async () => {
    const { rows } = await home.loadVoiceActorHome();
    const row = rowOf(rows, "latest-movies");

    expect(tmdb.getMovieCredits).toHaveBeenCalledTimes(2);
    expect(tmdb.getMovieCredits).not.toHaveBeenCalledWith(802);
    expect(row.cards[0]).toMatchObject({ id: 9, href: "/voice-actors/9" });
  });

  it("新世代: 活動開始が直近 10 年の声優（2017 年以降）", async () => {
    const { rows } = await home.loadVoiceActorHome();
    const row = rowOf(rows, "new-generation");

    expect(names(row).sort()).toEqual(["声優11", "声優21", "声優35"].sort());
    expect(row.cards.every((c) => /\d{4}年/.test(c.note ?? ""))).toBe(true);
  });

  it("レジェンド: 活動開始が 1990 年以前の声優", async () => {
    const { rows } = await home.loadVoiceActorHome();

    expect(names(rowOf(rows, "legends")).sort()).toEqual(
      ["声優13", "声優34"].sort(),
    );
  });
});

describe("loadVoiceActorHome: Hero", () => {
  it("今期人気作品のうち背景画像・あらすじの揃った 6 件と、その主演声優", async () => {
    const { hero } = await home.loadVoiceActorHome();

    expect(hero.map((h) => h.anime.id)).toEqual([501, 503, 505, 506, 507, 508]);
    // 出演順（order）の先頭 3 名
    expect(hero[0].leadVoiceActors).toEqual([
      "TMDb声優7",
      "TMDb声優5011",
      "TMDb声優5012",
    ]);
  });
});

describe("loadVoiceActorHome: 失敗の隔離と問い合わせ回数", () => {
  it("1 行の取得が失敗しても他の行は残る", async () => {
    anilist.getAniListFranchiseCast.mockRejectedValueOnce(new Error("boom"));
    anilist.getAniListBirthdayStaff.mockRejectedValueOnce(new Error("boom"));

    const { rows } = await home.loadVoiceActorHome();

    expect(rowOf(rows, "franchise-pokemon").cards).toEqual([]);
    expect(rowOf(rows, "birthdays").cards).toEqual([]);
    expect(rowOf(rows, "franchise-conan").cards.length).toBeGreaterThan(0);
    expect(rowOf(rows, "ranking").cards.length).toBeGreaterThan(0);
  });

  it("今期の取得が失敗すると、特集行は出さずに他の行を返す", async () => {
    anilist.getAniListSeasonCast.mockImplementation(async (year, season) => {
      if (year === 2026 && season === "FALL") throw new Error("boom");
      return PREVIOUS_SEASON;
    });

    const { rows } = await home.loadVoiceActorHome();

    expect(rows.some((r) => r.slug.startsWith("work-"))).toBe(false);
    expect(rowOf(rows, "leads").cards).toEqual([]);
    expect(rowOf(rows, "ranking").cards.length).toBeGreaterThan(0);

    anilist.getAniListSeasonCast.mockImplementation(async (year, season) =>
      year === 2026 && season === "FALL" ? CURRENT_SEASON : PREVIOUS_SEASON,
    );
  });

  it("同じ取得元は 1 回だけ引く（AniList は 1 描画 10 回 + シーズン一覧）", async () => {
    await home.loadVoiceActorHome();

    expect(anilist.getAniListSeasonCast).toHaveBeenCalledTimes(2);
    expect(anilist.getAniListFranchiseCast).toHaveBeenCalledTimes(
      ANIME_FRANCHISES.length,
    );
    expect(anilist.getAniListPopularStaff).toHaveBeenCalledTimes(
      home.POPULAR_STAFF_PAGES,
    );
    expect(anilist.getAniListBirthdayStaff).toHaveBeenCalledTimes(1);
    expect(fetchSeasonalAnime).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────
// 「すべて見る」の専用ページ
// ──────────────────────────────────────────

describe("loadVoiceActorCollection", () => {
  it("ホームの行と同じ中身を返す（行は全件表示なので一致する）", async () => {
    const { rows } = await home.loadVoiceActorHome();
    for (const slug of [
      "airing",
      "leads",
      "ranking",
      "legends",
      "work-1",
      "franchise-precure",
    ]) {
      const collection = await home.loadVoiceActorCollection(slug);
      expect(collection, slug).toEqual(rowOf(rows, slug));
    }
  });

  it("未知の slug は null（ページ側で 404）", async () => {
    expect(await home.loadVoiceActorCollection("unknown")).toBeNull();
    expect(await home.loadVoiceActorCollection("franchise-naruto")).toBeNull();
    expect(await home.loadVoiceActorCollection("work-abc")).toBeNull();
    expect(await home.loadVoiceActorCollection("work-01")).toBeNull();
    expect(await home.loadVoiceActorCollection("work-1/../x")).toBeNull();
  });

  it("特集に入っていない作品 id は null。id を AniList へ渡さない", async () => {
    // 作品G（7）は人気上位 5 作品の外、99999 は今期に存在しない
    expect(await home.loadVoiceActorCollection("work-7")).toBeNull();
    expect(await home.loadVoiceActorCollection("work-99999")).toBeNull();

    for (const call of anilist.getAniListSeasonCast.mock.calls) {
      expect(call.slice(0, 2)).toEqual([2026, "FALL"]);
    }
  });

  it("その行に要る取得元だけを引く", async () => {
    await home.loadVoiceActorCollection("franchise-conan");

    expect(anilist.getAniListFranchiseCast).toHaveBeenCalledTimes(1);
    expect(anilist.getAniListSeasonCast).not.toHaveBeenCalled();
    expect(anilist.getAniListPopularStaff).not.toHaveBeenCalled();
    expect(fetchSeasonalAnime).not.toHaveBeenCalled();
  });

  it("専用ページの URL", () => {
    expect(home.voiceActorCollectionHref("ranking")).toBe(
      "/voice-actors/collections/ranking",
    );
  });
});
