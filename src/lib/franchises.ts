// 定番シリーズ（フランチャイズ）の定義
//
// 声優ページ（/voice-actors）の「定番シリーズ特集」で使う。キャラクターページ（#104）でも
// 同じ定義を使う想定なので、声優に固有の情報は持たせない。
//
// シリーズの作品は AniList のタイトル検索（`getAniListFranchiseCast`）で引く。
// 検索語は 2026-10-04 に AniList で実測し、TV 作品が漏れなく返ることを確認している
// （ポケモン 13 作 / コナン 1 作 / ONE PIECE 2 作 / ガンダム 15 作 / プリキュア 24 作）。

export interface AnimeFranchise {
  /** URL に載る識別子（kebab-case） */
  slug: string;
  /** 表示名 */
  name: string;
  emoji: string;
  /** AniList のタイトル検索語。作品名にこの語を含む作品だけをシリーズとして扱う */
  search: string;
  /**
   * MAIN キャラだけに絞るか。
   * 作品数の多いシリーズ（プリキュア 24 作など）は脇役まで入れると数百人になるため主役級に絞る。
   * 1 作品が長く続くシリーズ（コナン・ONE PIECE）は脇役まで入れないと数人しか残らない
   */
  mainOnly: boolean;
  /** 1 作品あたりに取るキャラ数（AniList の上限は 50） */
  castPerWork: number;
}

export const ANIME_FRANCHISES: readonly AnimeFranchise[] = [
  {
    slug: "pokemon",
    name: "ポケモン",
    emoji: "⚡",
    search: "ポケットモンスター",
    mainOnly: true,
    castPerWork: 25,
  },
  {
    slug: "conan",
    name: "名探偵コナン",
    emoji: "🔍",
    search: "名探偵コナン",
    mainOnly: false,
    castPerWork: 50,
  },
  {
    slug: "one-piece",
    name: "ONE PIECE",
    emoji: "🏴‍☠️",
    search: "ONE PIECE",
    mainOnly: false,
    castPerWork: 50,
  },
  {
    slug: "gundam",
    name: "機動戦士ガンダム",
    emoji: "🤖",
    search: "機動戦士ガンダム",
    mainOnly: true,
    castPerWork: 25,
  },
  {
    slug: "precure",
    name: "プリキュア",
    emoji: "💖",
    search: "プリキュア",
    mainOnly: true,
    castPerWork: 25,
  },
];

export function findFranchise(slug: string): AnimeFranchise | null {
  return ANIME_FRANCHISES.find((f) => f.slug === slug) ?? null;
}

interface FranchiseTitle {
  native: string | null;
  romaji: string | null;
  english: string | null;
}

/**
 * 作品がシリーズに属するか（いずれかのタイトルが検索語を含むか）。
 * AniList の検索は曖昧一致なので、検索語を含まない作品が混ざりうる
 */
export function matchesFranchiseTitle(
  franchise: AnimeFranchise,
  title: FranchiseTitle,
): boolean {
  const needle = franchise.search.toLowerCase();
  return [title.native, title.romaji, title.english].some(
    (t) => t !== null && t.toLowerCase().includes(needle),
  );
}
