export interface AnimeGenre {
  id: number;
  name: string;
  emoji: string;
  color: string;
  /** genre  → TMDb genre ID でフィルタ
   *  keyword → TMDb keyword 検索でフィルタ */
  filterType: "genre" | "keyword";
  /** filterType === "keyword" のときに検索するキーワード文字列 */
  keyword?: string;
  /** 追加キーワード（OR 検索）*/
  extraKeywords?: string[];
}

// ──────────────────────────────────────────────
// TMDb ジャンル ID ベース（既存8ジャンル）
// ──────────────────────────────────────────────
const GENRE_BASED: AnimeGenre[] = [
  { id: 10759, filterType: "genre", name: "アクション・冒険", emoji: "⚔️",  color: "from-red-950 via-red-900 to-orange-950" },
  { id: 35,    filterType: "genre", name: "コメディ",        emoji: "😄",  color: "from-yellow-950 via-amber-900 to-yellow-950" },
  { id: 18,    filterType: "genre", name: "ドラマ",          emoji: "🎭",  color: "from-blue-950 via-blue-900 to-indigo-950" },
  { id: 10765, filterType: "genre", name: "SF・ファンタジー", emoji: "🔮",  color: "from-purple-950 via-violet-900 to-indigo-950" },
  { id: 9648,  filterType: "genre", name: "ミステリー",      emoji: "🔍",  color: "from-slate-900 via-gray-800 to-zinc-950" },
  { id: 10751, filterType: "genre", name: "ファミリー",      emoji: "🏠",  color: "from-green-950 via-emerald-900 to-teal-950" },
  { id: 10762, filterType: "genre", name: "キッズ",          emoji: "⭐",  color: "from-cyan-950 via-sky-900 to-blue-950" },
  { id: 10768, filterType: "genre", name: "戦争・政治",      emoji: "🗡️",  color: "from-zinc-900 via-stone-800 to-neutral-950" },
];

// ──────────────────────────────────────────────
// TMDb キーワードベース（ニッチ10ジャンル）
// カスタム ID は 9001〜 を使用（TMDb と衝突しない範囲）
// ──────────────────────────────────────────────
const KEYWORD_BASED: AnimeGenre[] = [
  {
    id: 9001, filterType: "keyword", keyword: "isekai",
    name: "異世界転生",   emoji: "🌀",
    color: "from-violet-950 via-purple-900 to-fuchsia-950",
  },
  {
    id: 9002, filterType: "keyword", keyword: "mecha",
    name: "メカ・ロボット", emoji: "🤖",
    color: "from-sky-950 via-cyan-900 to-blue-950",
  },
  {
    id: 9003, filterType: "keyword", keyword: "magical girl",
    name: "魔法少女",     emoji: "✨",
    color: "from-pink-950 via-rose-900 to-fuchsia-950",
  },
  {
    id: 9004, filterType: "keyword", keyword: "sports",
    extraKeywords: ["sport", "baseball", "basketball", "volleyball", "soccer"],
    name: "スポーツ",     emoji: "🏆",
    color: "from-orange-950 via-amber-900 to-yellow-950",
  },
  {
    id: 9005, filterType: "keyword", keyword: "horror",
    name: "ホラー",       emoji: "👻",
    color: "from-gray-950 via-red-950 to-black",
  },
  {
    id: 9006, filterType: "keyword", keyword: "slice of life",
    name: "日常・スライスオブライフ", emoji: "☕",
    color: "from-teal-950 via-emerald-900 to-green-950",
  },
  {
    id: 9007, filterType: "keyword", keyword: "superpower",
    name: "超能力・能力者バトル", emoji: "⚡",
    color: "from-yellow-950 via-orange-900 to-red-950",
  },
  {
    id: 9008, filterType: "keyword", keyword: "historical",
    name: "歴史・時代劇", emoji: "📜",
    color: "from-amber-950 via-stone-900 to-neutral-950",
  },
  {
    id: 9009, filterType: "keyword", keyword: "idol",
    name: "アイドル",     emoji: "🎤",
    color: "from-fuchsia-950 via-pink-900 to-rose-950",
  },
  {
    id: 9010, filterType: "keyword", keyword: "cooking",
    name: "料理・グルメ", emoji: "🍜",
    color: "from-red-950 via-orange-900 to-amber-950",
  },
];

export const ANIME_GENRES: AnimeGenre[] = [...GENRE_BASED, ...KEYWORD_BASED];

export function findGenre(id: number): AnimeGenre | undefined {
  return ANIME_GENRES.find((g) => g.id === id);
}
