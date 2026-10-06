export interface AnimeStudio {
  /**
   * TMDb の company id。名前検索の先頭ヒットは同名の空エントリや子会社のことが
   * 多いため、`/discover/tv?with_companies=ID&with_genres=16&with_origin_country=JP`
   * の件数で実在を確かめた id を固定する（2026-10-07 実測。#116）
   */
  id: number;
  name: string;
  emoji: string;
  /** 代表作 2 作（読点区切り） */
  description: string;
  /** Tailwind グラデーション（genres / eras と同じ形） */
  color: string;
}

export const ANIME_STUDIOS: AnimeStudio[] = [
  {
    id: 10342,
    name: "スタジオジブリ",
    emoji: "🌿",
    description: "もののけ姫、千と千尋の神隠し",
    color: "from-green-950 via-emerald-900 to-teal-950",
  },
  {
    id: 5542,
    name: "東映アニメーション",
    emoji: "⚔️",
    description: "ドラゴンボール、ワンピース",
    color: "from-red-950 via-orange-900 to-amber-950",
  },
  {
    id: 529,
    name: "Production I.G",
    emoji: "🧠",
    description: "攻殻機動隊、ハイキュー!!",
    color: "from-sky-950 via-blue-900 to-slate-950",
  },
  {
    id: 3464,
    name: "MADHOUSE",
    emoji: "♟️",
    description: "DEATH NOTE、ハンター×ハンター",
    color: "from-zinc-900 via-neutral-800 to-stone-950",
  },
  {
    id: 5438,
    name: "京都アニメーション",
    emoji: "🎨",
    description: "けいおん！、ヴァイオレット・エヴァーガーデン",
    color: "from-rose-950 via-pink-900 to-fuchsia-950",
  },
  {
    id: 13113,
    name: "A-1 Pictures",
    emoji: "🎭",
    description: "ソードアート・オンライン、かぐや様",
    color: "from-indigo-950 via-blue-900 to-cyan-950",
  },
  {
    id: 3153,
    name: "サンライズ",
    emoji: "🤖",
    description: "ガンダム、コードギアス",
    color: "from-orange-950 via-amber-900 to-yellow-950",
  },
  {
    id: 31058,
    name: "WIT STUDIO",
    emoji: "⚡",
    description: "進撃の巨人、ヴィンランド・サガ",
    color: "from-yellow-950 via-lime-900 to-green-950",
  },
  {
    id: 21444,
    name: "MAPPA",
    emoji: "🔥",
    description: "呪術廻戦、進撃の巨人 完結編",
    color: "from-red-950 via-rose-900 to-neutral-950",
  },
  {
    id: 2849,
    name: "ボンズ",
    emoji: "💎",
    description: "鋼の錬金術師FA、僕のヒーローアカデミア",
    color: "from-cyan-950 via-sky-900 to-indigo-950",
  },
  {
    id: 5887,
    name: "ufotable",
    emoji: "🗡️",
    description: "鬼滅の刃、Fate/stay night",
    color: "from-slate-950 via-indigo-900 to-violet-950",
  },
  {
    id: 7164,
    name: "TMS Entertainment",
    emoji: "🎬",
    description: "名探偵コナン、メガロボクス",
    color: "from-blue-950 via-sky-900 to-blue-950",
  },
  {
    id: 121589,
    name: "CloverWorks",
    emoji: "🍀",
    description: "SPY×FAMILY、その着せ替え人形は恋をする",
    color: "from-emerald-950 via-green-900 to-lime-950",
  },
  {
    id: 6689,
    name: "シャフト",
    emoji: "🌀",
    description: "化物語、魔法少女まどか☆マギカ",
    color: "from-fuchsia-950 via-purple-900 to-rose-950",
  },
  {
    id: 50908,
    name: "TRIGGER",
    emoji: "💥",
    description: "キルラキル、サイバーパンク エッジランナーズ",
    color: "from-pink-950 via-red-900 to-orange-950",
  },
  {
    id: 20867,
    name: "P.A.WORKS",
    emoji: "🌸",
    description: "SHIROBAKO、Charlotte",
    color: "from-teal-950 via-cyan-900 to-sky-950",
  },
  {
    id: 99494,
    name: "サイエンスSARU",
    emoji: "🐒",
    description: "ダンダダン、夜は短し歩けよ乙女",
    color: "from-lime-950 via-yellow-900 to-amber-950",
  },
  {
    id: 10868,
    name: "STUDIO 4℃",
    emoji: "🌌",
    description: "鉄コン筋クリート、海獣の子供",
    color: "from-violet-950 via-indigo-900 to-slate-950",
  },
  {
    id: 11884,
    name: "J.C.STAFF",
    emoji: "🪄",
    description: "とある科学の超電磁砲、ダンジョンに出会いを求めるのは間違っているだろうか",
    color: "from-blue-950 via-indigo-900 to-purple-950",
  },
  {
    id: 41996,
    name: "動画工房",
    emoji: "🎀",
    description: "【推しの子】、ちいかわ",
    color: "from-pink-950 via-fuchsia-900 to-purple-950",
  },
  {
    id: 42811,
    name: "Lerche",
    emoji: "📚",
    description: "暗殺教室、ようこそ実力至上主義の教室へ",
    color: "from-amber-950 via-yellow-900 to-orange-950",
  },
  {
    id: 45188,
    name: "david production",
    emoji: "🌟",
    description: "ジョジョの奇妙な冒険、はたらく細胞",
    color: "from-purple-950 via-violet-900 to-fuchsia-950",
  },
  {
    id: 5141,
    name: "シンエイ動画",
    emoji: "🐱",
    description: "ドラえもん、クレヨンしんちゃん",
    color: "from-sky-950 via-cyan-900 to-teal-950",
  },
  {
    id: 3234,
    name: "ぴえろ",
    emoji: "🍥",
    description: "NARUTO、BLEACH",
    color: "from-orange-950 via-red-900 to-rose-950",
  },
  {
    id: 5372,
    name: "OLM",
    emoji: "🎒",
    description: "ポケットモンスター、薬屋のひとりごと",
    color: "from-red-950 via-red-900 to-zinc-950",
  },
  {
    id: 3756,
    name: "コミックス・ウェーブ・フィルム",
    emoji: "☄️",
    description: "君の名は。、すずめの戸締まり",
    color: "from-indigo-950 via-sky-900 to-cyan-950",
  },
];

export function findStudio(id: number): AnimeStudio | undefined {
  return ANIME_STUDIOS.find((s) => s.id === id);
}
