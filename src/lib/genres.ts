export interface AnimeGenre {
  id: number;
  name: string;
  emoji: string;
  color: string;
  /** genre  → TMDb genre ID でフィルタ
   *  keyword → TMDb keyword でフィルタ */
  filterType: "genre" | "keyword";
  /** filterType === "keyword" のときに検索するキーワード文字列（検索画面の名前検索用） */
  keyword?: string;
  /** 追加キーワード（OR 検索。検索画面の名前検索用）*/
  extraKeywords?: string[];
  /**
   * filterType === "keyword" のときに使う TMDb のキーワード ID（OR）。
   * 名前で検索して先頭ヒットを使うと、先頭に別物が来た時に静かに 0 件になる
   * （2026-10-04 実測: "mecha" → 0 件の「mecha!」、"horror" → 0 件の「b-horror」）。
   * そのため ID を固定し、タグ付けが少ないジャンルは同義のキーワードを足して OR で引く
   */
  keywordIds?: readonly number[];
}

// ──────────────────────────────────────────────
// TMDb ジャンル ID ベース（既存8ジャンル）
// ──────────────────────────────────────────────
const GENRE_BASED: AnimeGenre[] = [
  {
    id: 10759,
    filterType: "genre",
    name: "アクション・冒険",
    emoji: "⚔️",
    color: "from-red-950 via-red-900 to-orange-950",
  },
  {
    id: 35,
    filterType: "genre",
    name: "コメディ",
    emoji: "😄",
    color: "from-yellow-950 via-amber-900 to-yellow-950",
  },
  {
    id: 18,
    filterType: "genre",
    name: "ドラマ",
    emoji: "🎭",
    color: "from-blue-950 via-blue-900 to-indigo-950",
  },
  {
    id: 10765,
    filterType: "genre",
    name: "SF・ファンタジー",
    emoji: "🔮",
    color: "from-purple-950 via-violet-900 to-indigo-950",
  },
  {
    id: 9648,
    filterType: "genre",
    name: "ミステリー",
    emoji: "🔍",
    color: "from-slate-900 via-gray-800 to-zinc-950",
  },
  {
    id: 10751,
    filterType: "genre",
    name: "ファミリー",
    emoji: "🏠",
    color: "from-green-950 via-emerald-900 to-teal-950",
  },
  {
    id: 10762,
    filterType: "genre",
    name: "キッズ",
    emoji: "⭐",
    color: "from-cyan-950 via-sky-900 to-blue-950",
  },
  {
    id: 10768,
    filterType: "genre",
    name: "戦争・政治",
    emoji: "🗡️",
    color: "from-zinc-900 via-stone-800 to-neutral-950",
  },
];

// ──────────────────────────────────────────────
// TMDb キーワードベース（ニッチ10ジャンル）
// カスタム ID は 9001〜 を使用（TMDb と衝突しない範囲）
//
// keywordIds は 2026-10-04 に /search/keyword と /discover で、日本のアニメに
// 実際に付いていることを確かめた ID。意味が広すぎる語（robot / reincarnation /
// samurai / martial arts など）は別ジャンルの作品を大量に拾うので入れていない
// ──────────────────────────────────────────────
const KEYWORD_BASED: AnimeGenre[] = [
  {
    id: 9001,
    filterType: "keyword",
    keyword: "isekai",
    keywordIds: [
      237451, // isekai
      213756, // another world
      227624, // other world
      33465, // parallel world
      291482, // reverse isekai
    ],
    name: "異世界転生",
    emoji: "🌀",
    color: "from-violet-950 via-purple-900 to-fuchsia-950",
  },
  {
    id: 9002,
    filterType: "keyword",
    keyword: "mecha",
    keywordIds: [
      10046, // mecha
      10891, // giant robot
      291181, // transforming mecha
      207473, // cyber & mecha
    ],
    name: "メカ・ロボット",
    emoji: "🤖",
    color: "from-sky-950 via-cyan-900 to-blue-950",
  },
  {
    id: 9003,
    filterType: "keyword",
    keyword: "magical girl",
    keywordIds: [
      292887, // magical girl
      358020, // magical girls
    ],
    name: "魔法少女",
    emoji: "✨",
    color: "from-pink-950 via-rose-900 to-fuchsia-950",
  },
  {
    id: 9004,
    filterType: "keyword",
    keyword: "sports",
    extraKeywords: ["sport", "baseball", "basketball", "volleyball", "soccer"],
    keywordIds: [
      6075, // sports
      333328, // sport
      300423, // team sports
      1480, // baseball
      6496, // basketball
      5605, // volleyball
      13042, // football (soccer)
      579, // american football
      7912, // rugby
      1488, // tennis
      276964, // table tennis
      209476, // boxing
      15058, // swimming
      10671, // figure skating
      180491, // cycling
    ],
    name: "スポーツ",
    emoji: "🏆",
    color: "from-orange-950 via-amber-900 to-yellow-950",
  },
  {
    id: 9005,
    filterType: "keyword",
    keyword: "horror",
    keywordIds: [
      315058, // horror
      325319, // j-horror
      256183, // supernatural horror
      295907, // psychological horror
      50009, // survival horror
    ],
    name: "ホラー",
    emoji: "👻",
    color: "from-gray-950 via-red-950 to-black",
  },
  {
    id: 9006,
    filterType: "keyword",
    keyword: "slice of life",
    keywordIds: [
      9914, // slice of life
      291483, // iyashikei
    ],
    name: "日常・スライスオブライフ",
    emoji: "☕",
    color: "from-teal-950 via-emerald-900 to-green-950",
  },
  {
    id: 9007,
    filterType: "keyword",
    keyword: "superpower",
    keywordIds: [
      33637, // super power
      251513, // supernatural power
      291469, // psychic powers
      235199, // espers
      235578, // superhuman abilities
    ],
    name: "超能力・能力者バトル",
    emoji: "⚡",
    color: "from-yellow-950 via-orange-900 to-red-950",
  },
  {
    id: 9008,
    filterType: "keyword",
    keyword: "historical",
    keywordIds: [
      15126, // historical
      12995, // historical fiction
      15060, // period drama
      186753, // jidaigeki
      198754, // feudal japan
      194424, // sengoku period
      190446, // edo period
      230462, // meiji period
    ],
    name: "歴史・時代劇",
    emoji: "📜",
    color: "from-amber-950 via-stone-900 to-neutral-950",
  },
  {
    id: 9009,
    filterType: "keyword",
    keyword: "idol",
    keywordIds: [
      287664, // idol
      251523, // idol group
      306009, // virtual idol
    ],
    name: "アイドル",
    emoji: "🎤",
    color: "from-fuchsia-950 via-pink-900 to-rose-950",
  },
  {
    id: 9010,
    filterType: "keyword",
    keyword: "cooking",
    keywordIds: [
      1918, // cooking
      10637, // food
      209125, // gourmet
      264731, // gourmet food
      18293, // chef
      1946, // restaurant
    ],
    name: "料理・グルメ",
    emoji: "🍜",
    color: "from-red-950 via-orange-900 to-amber-950",
  },
];

export const ANIME_GENRES: AnimeGenre[] = [...GENRE_BASED, ...KEYWORD_BASED];

export function findGenre(id: number): AnimeGenre | undefined {
  return ANIME_GENRES.find((g) => g.id === id);
}

/** キーワード由来のジャンルの TMDb キーワード ID（TMDb ジャンルのジャンルは空） */
export function genreKeywordIds(genre: AnimeGenre): readonly number[] {
  return genre.filterType === "keyword" ? (genre.keywordIds ?? []) : [];
}
