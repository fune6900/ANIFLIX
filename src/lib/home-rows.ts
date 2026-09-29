// ホームの「シーズン / 年代 / ジャンルで探す」の行を組み立てる

import { getAnimeByEra, getAnimeByGenre, getAnimeByKeywords } from "@/lib/tmdb";
import { fetchSeasonalAnime } from "@/lib/seasonal-anime";
import { ANIME_ERAS } from "@/lib/eras";
import type { AnimeEra } from "@/lib/eras";
import type { AnimeGenre } from "@/lib/genres";
import type { SeasonSlug } from "@/lib/seasons";
import type { TMDbAnime, TMDbSearchResponse } from "@/types/tmdb";

/** 1 行に並べる件数。TMDb の 1 ページ（20 件）では足りないので 2 ページ取る */
export const HOME_ROW_SIZE = 30;

/**
 * シーズン行の数。ピル列（8 クール）を全部行にすると縦に長すぎるため直近だけ。
 * 各行が AniList + TMDb の名前検索を伴うので、ここを増やすと往復が線形に増える
 */
export const HOME_SEASON_ROW_COUNT = 4;

/** 年代行の数。ピル列（全年代）とは別に、直近の年代だけ行にする */
export const HOME_ERA_ROW_COUNT = 3;

/**
 * 連続 2 ページの開始ページの上限。
 * 開始を 1〜2 でずらして表示の多様性を出す（= 別キャッシュエントリ）。
 * 3 ページ目より深いと人気の薄い作品が混ざるため、そこで止める
 */
const MAX_START_PAGE = 2;

/** Fisher-Yates シャッフル（破壊なし） */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 1〜max のランダムページ番号 */
export function randomPage(max = 3): number {
  return Math.floor(Math.random() * max) + 1;
}

/** 直近の年代を新しい順に count 件 */
export function pickHomeEras(count = HOME_ERA_ROW_COUNT): AnimeEra[] {
  return [...ANIME_ERAS].sort((a, b) => b.decade - a.decade).slice(0, count);
}

/**
 * 連続 2 ページを並列で取り、重複を除いて 1 行分に揃える。
 * 片方のページが落ちても残りで返し、両方落ちたら空配列（ホーム全体を落とさない）
 */
async function fetchTwoPages(
  fetchPage: (page: number) => Promise<TMDbSearchResponse<TMDbAnime>>,
): Promise<TMDbAnime[]> {
  const start = randomPage(MAX_START_PAGE);
  const settled = await Promise.allSettled([
    fetchPage(start),
    fetchPage(start + 1),
  ]);

  const seen = new Set<number>();
  const pool: TMDbAnime[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const anime of r.value.results) {
      if (seen.has(anime.id)) continue;
      seen.add(anime.id);
      pool.push(anime);
    }
  }
  return shuffle(pool).slice(0, HOME_ROW_SIZE);
}

/** ジャンル 1 件分の行（TMDb ジャンル / キーワードの両方に対応） */
export function fetchGenreRow(genre: AnimeGenre): Promise<TMDbAnime[]> {
  if (genre.filterType === "keyword" && genre.keyword) {
    const keywords = [genre.keyword, ...(genre.extraKeywords ?? [])];
    return fetchTwoPages((page) => getAnimeByKeywords(keywords, page));
  }
  return fetchTwoPages((page) => getAnimeByGenre(genre.id, page));
}

/** 年代 1 件分の行 */
export function fetchEraRow(decade: number): Promise<TMDbAnime[]> {
  return fetchTwoPages((page) => getAnimeByEra(decade, page));
}

/**
 * シーズン 1 件分の行。AniList を一次ソースにして TMDb の取りこぼしを防ぐ。
 * 人気順そのものに意味があるため shuffle しない
 */
export async function fetchSeasonRow(
  year: number,
  season: SeasonSlug,
): Promise<TMDbAnime[]> {
  try {
    const { items } = await fetchSeasonalAnime(year, season, {
      limit: HOME_ROW_SIZE,
    });
    return items.slice(0, HOME_ROW_SIZE);
  } catch {
    return [];
  }
}
