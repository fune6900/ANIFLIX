// アニメ診断ロジック
// ムード（気分） × 長さ × 年代 を入力に、TMDb discover で候補を取得し
// 相性度（0-100）を算出して上位を返す

import { discoverAnime } from "@/lib/tmdb";
import type { TMDbAnime, TMDbSearchResponse } from "@/types/tmdb";

// ──────────────────────────────────────────
// 入力モデル
// ──────────────────────────────────────────

export type Mood = "moving" | "funny" | "exciting" | "healing";
export type LengthChoice = "1cour" | "2cour" | "long";
export type EraChoice = "2020s" | "2010s" | "2000s" | "all";

export interface MoodOption {
  id: Mood;
  label: string;
  emoji: string;
  description: string;
  color: string;
  /** スコアリングで一致を加点する TMDb ジャンル ID（複数 = OR） */
  preferredGenreIds: number[];
}

export const MOODS: MoodOption[] = [
  {
    id: "moving",
    label: "感動したい",
    emoji: "🥺",
    description: "心揺さぶる物語に浸りたい",
    color: "from-blue-950 via-indigo-900 to-purple-950",
    preferredGenreIds: [18], // Drama
  },
  {
    id: "funny",
    label: "笑いたい",
    emoji: "😄",
    description: "気楽に笑える作品が観たい",
    color: "from-yellow-950 via-amber-900 to-orange-950",
    preferredGenreIds: [35], // Comedy
  },
  {
    id: "exciting",
    label: "アドレナリン出したい",
    emoji: "🔥",
    description: "熱いバトルと冒険でハマりたい",
    color: "from-red-950 via-rose-900 to-orange-950",
    preferredGenreIds: [10759, 10765], // Action & Adventure, Sci-Fi & Fantasy
  },
  {
    id: "healing",
    label: "癒されたい",
    emoji: "🌿",
    description: "穏やかな時間を過ごしたい",
    color: "from-teal-950 via-emerald-900 to-green-950",
    preferredGenreIds: [10751], // Family
  },
];

export interface LengthOption {
  id: LengthChoice;
  label: string;
  emoji: string;
  description: string;
}

export const LENGTHS: LengthOption[] = [
  {
    id: "1cour",
    label: "1クール",
    emoji: "⚡",
    description: "サクッと観たい（〜13話相当）",
  },
  {
    id: "2cour",
    label: "2クール",
    emoji: "🎯",
    description: "じっくり観たい（〜26話相当）",
  },
  {
    id: "long",
    label: "長期OK",
    emoji: "🏔️",
    description: "腰を据えて没入したい",
  },
];

export interface EraOption {
  id: EraChoice;
  label: string;
  emoji: string;
  yearFrom?: number;
  yearTo?: number;
}

export const ERAS: EraOption[] = [
  { id: "2020s", label: "2020年代", emoji: "✨", yearFrom: 2020, yearTo: 2029 },
  { id: "2010s", label: "2010年代", emoji: "⚔️", yearFrom: 2010, yearTo: 2019 },
  { id: "2000s", label: "2000年代", emoji: "🔥", yearFrom: 2000, yearTo: 2009 },
  { id: "all", label: "年代問わず", emoji: "🌐" },
];

export interface DiagnosisInput {
  mood: Mood;
  length: LengthChoice;
  era: EraChoice;
}

// ──────────────────────────────────────────
// 入力検証
// ──────────────────────────────────────────

const MOOD_IDS = new Set<Mood>(MOODS.map((m) => m.id));
const LENGTH_IDS = new Set<LengthChoice>(LENGTHS.map((l) => l.id));
const ERA_IDS = new Set<EraChoice>(ERAS.map((e) => e.id));

export function parseDiagnosisInput(params: {
  mood?: string | null;
  length?: string | null;
  era?: string | null;
}): DiagnosisInput | null {
  const { mood, length, era } = params;
  if (!mood || !MOOD_IDS.has(mood as Mood)) return null;
  if (!length || !LENGTH_IDS.has(length as LengthChoice)) return null;
  if (!era || !ERA_IDS.has(era as EraChoice)) return null;
  return {
    mood: mood as Mood,
    length: length as LengthChoice,
    era: era as EraChoice,
  };
}

// ──────────────────────────────────────────
// 相性度算出
// 配点: ジャンル一致 50 / 年代一致 20 / レーティング 15 / 人気度 10 / 長さヒューリスティック 5 = 100
// ──────────────────────────────────────────

export function calculateCompatibility(
  anime: TMDbAnime,
  input: DiagnosisInput,
): number {
  const mood = MOODS.find((m) => m.id === input.mood);
  if (!mood) return 0;

  // 1. ジャンル一致（preferredGenreIds と genre_ids の重なり）
  const matched = anime.genre_ids.filter((id) =>
    mood.preferredGenreIds.includes(id),
  ).length;
  const genreScore = matched > 0 ? 50 : 20;

  // 2. 年代一致
  const era = ERAS.find((e) => e.id === input.era);
  let eraScore = 20;
  if (era?.yearFrom !== undefined && era.yearTo !== undefined) {
    if (anime.first_air_date) {
      const year = parseInt(anime.first_air_date.slice(0, 4), 10);
      eraScore = year >= era.yearFrom && year <= era.yearTo ? 20 : 5;
    } else {
      eraScore = 5;
    }
  }

  // 3. レーティング（0-10 → 0-15）
  const ratingScore = Math.min(15, Math.max(0, (anime.vote_average / 10) * 15));

  // 4. 人気度（log 正規化、vote_count=1000 で 6 点・10000 で 8 点程度）
  const popScore = Math.min(10, Math.log10(Math.max(1, anime.vote_count)) * 2);

  // 5. 長さヒューリスティック（discover は episode_count を返さないので推定で加点）
  //  - 1cour: 直近5年以内の新しい作品ほど 1 クール化しやすい
  //  - long: vote_count が極端に高い作品は長期作の可能性が高い
  //  - 2cour: 中庸（補正なし）
  let lengthScore = 0;
  if (anime.first_air_date) {
    const year = parseInt(anime.first_air_date.slice(0, 4), 10);
    const currentYear = new Date().getFullYear();
    if (input.length === "1cour" && currentYear - year <= 5) lengthScore = 5;
    if (input.length === "long" && anime.vote_count >= 1000) lengthScore = 5;
    if (input.length === "2cour") lengthScore = 3;
  }

  return Math.round(
    genreScore + eraScore + ratingScore + popScore + lengthScore,
  );
}

// ──────────────────────────────────────────
// 診断実行
// ──────────────────────────────────────────

export interface DiagnosisResultItem {
  anime: TMDbAnime;
  compatibility: number;
}

/** 入力からTMDb discoverで候補を取得し、相性度で並べ替えて上位5件を返す */
export async function runDiagnosis(
  input: DiagnosisInput,
  limit = 5,
): Promise<DiagnosisResultItem[]> {
  const mood = MOODS.find((m) => m.id === input.mood);
  const era = ERAS.find((e) => e.id === input.era);
  if (!mood || !era) return [];

  // 複数ジャンルがある場合は並列で取得
  const responses = await Promise.allSettled(
    mood.preferredGenreIds.map((genreId) =>
      discoverAnime({
        genreId,
        yearFrom: era.yearFrom,
        yearTo: era.yearTo,
        minScore: 6.0,
        sortBy: "popularity.desc",
        page: 1,
      }),
    ),
  );

  const all = responses
    .filter(
      (r): r is PromiseFulfilledResult<TMDbSearchResponse<TMDbAnime>> =>
        r.status === "fulfilled",
    )
    .flatMap((r) => r.value.results);

  // 重複除去
  const seen = new Set<number>();
  const unique = all.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  // スコアリング & 上位 limit 件
  const scored = unique.map((anime) => ({
    anime,
    compatibility: calculateCompatibility(anime, input),
  }));
  scored.sort((a, b) => b.compatibility - a.compatibility);
  return scored.slice(0, limit);
}
