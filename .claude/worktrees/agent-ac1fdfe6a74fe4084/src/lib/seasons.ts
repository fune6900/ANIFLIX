export type SeasonSlug = "winter" | "spring" | "summer" | "fall";

export interface AnimeSeason {
  year: number;
  season: SeasonSlug;
  label: string;
  shortLabel: string;
  emoji: string;
  dateFrom: string;
  dateTo: string;
  href: string;
}

export const SEASON_LABELS: Record<SeasonSlug, string> = {
  winter: "冬",
  spring: "春",
  summer: "夏",
  fall: "秋",
};

export const SEASON_EMOJIS: Record<SeasonSlug, string> = {
  winter: "❄️",
  spring: "🌸",
  summer: "☀️",
  fall: "🍂",
};

export const SEASON_COLORS: Record<SeasonSlug, string> = {
  winter: "from-blue-900 to-slate-900",
  spring: "from-pink-900 to-rose-950",
  summer: "from-orange-900 to-yellow-950",
  fall: "from-amber-900 to-orange-950",
};

export function getSeasonDateRange(
  year: number,
  season: SeasonSlug
): { from: string; to: string } {
  const ranges: Record<SeasonSlug, { from: string; to: string }> = {
    winter: { from: `${year}-01-01`, to: `${year}-03-31` },
    spring: { from: `${year}-04-01`, to: `${year}-06-30` },
    summer: { from: `${year}-07-01`, to: `${year}-09-30` },
    fall:   { from: `${year}-10-01`, to: `${year}-12-31` },
  };
  return ranges[season];
}

function monthToSeason(month: number): SeasonSlug {
  if (month <= 3) return "winter";
  if (month <= 6) return "spring";
  if (month <= 9) return "summer";
  return "fall";
}

function makeSeason(year: number, season: SeasonSlug): AnimeSeason {
  const { from, to } = getSeasonDateRange(year, season);
  return {
    year,
    season,
    label: `${year}年${SEASON_LABELS[season]}`,
    shortLabel: SEASON_LABELS[season],
    emoji: SEASON_EMOJIS[season],
    dateFrom: from,
    dateTo: to,
    href: `/browse/season/${year}/${season}`,
  };
}

/** 直近 N クールを新しい順に返す */
export function getRecentSeasons(count = 8): AnimeSeason[] {
  const order: SeasonSlug[] = ["winter", "spring", "summer", "fall"];
  const now = new Date();
  let year = now.getFullYear();
  let season = monthToSeason(now.getMonth() + 1);

  const result: AnimeSeason[] = [];
  for (let i = 0; i < count; i++) {
    result.push(makeSeason(year, season));
    const idx = order.indexOf(season);
    if (idx === 0) {
      season = "fall";
      year--;
    } else {
      season = order[idx - 1];
    }
  }
  return result;
}

export function findSeason(year: number, slug: SeasonSlug): AnimeSeason {
  return makeSeason(year, slug);
}

export function isValidSeason(slug: string): slug is SeasonSlug {
  return ["winter", "spring", "summer", "fall"].includes(slug);
}
