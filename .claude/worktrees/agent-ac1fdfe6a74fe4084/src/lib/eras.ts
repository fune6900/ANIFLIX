export interface AnimeEra {
  decade: number;   // 1960, 1970, …, 2020（URL パラメータにも使用）
  label: string;    // "1960年代"
  shortLabel: string; // "60年代"
  emoji: string;
  color: string;    // Tailwind グラデーション
  description: string; // 代表作・時代の特徴
}

export const ANIME_ERAS: AnimeEra[] = [
  {
    decade: 1960,
    label: "1960年代",
    shortLabel: "60年代",
    emoji: "📺",
    color: "from-stone-800 via-amber-950 to-stone-900",
    description: "鉄腕アトム・巨人の星",
  },
  {
    decade: 1970,
    label: "1970年代",
    shortLabel: "70年代",
    emoji: "🤖",
    color: "from-orange-950 via-red-950 to-stone-900",
    description: "マジンガーZ・ヤマト",
  },
  {
    decade: 1980,
    label: "1980年代",
    shortLabel: "80年代",
    emoji: "🚀",
    color: "from-blue-950 via-indigo-950 to-slate-900",
    description: "ガンダム・北斗の拳",
  },
  {
    decade: 1990,
    label: "1990年代",
    shortLabel: "90年代",
    emoji: "⚡",
    color: "from-yellow-950 via-orange-950 to-red-950",
    description: "ドラゴンボール・セーラームーン",
  },
  {
    decade: 2000,
    label: "2000年代",
    shortLabel: "00年代",
    emoji: "🔥",
    color: "from-red-950 via-rose-950 to-pink-950",
    description: "NARUTO・ハガレン・涼宮ハルヒ",
  },
  {
    decade: 2010,
    label: "2010年代",
    shortLabel: "10年代",
    emoji: "⚔️",
    color: "from-purple-950 via-violet-950 to-indigo-950",
    description: "進撃の巨人・SAO・Re:ゼロ",
  },
  {
    decade: 2020,
    label: "2020年代",
    shortLabel: "20年代",
    emoji: "✨",
    color: "from-cyan-950 via-teal-950 to-emerald-950",
    description: "鬼滅・呪術廻戦・SPY×FAMILY",
  },
];

export function findEra(decade: number): AnimeEra | undefined {
  return ANIME_ERAS.find((e) => e.decade === decade);
}
