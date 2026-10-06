// ホームの「シーズン / 年代 / 制作会社 / ジャンルで探す」の行を組み立てる

import {
  getAnimeByEra,
  getAnimeByGenre,
  getAnimeByKeyword,
  getAnimeByStudio,
} from "@/lib/tmdb";
import { fetchSeasonalAnime } from "@/lib/seasonal-anime";
import { ANIME_ERAS } from "@/lib/eras";
import type { AnimeEra } from "@/lib/eras";
import { genreKeywordIds } from "@/lib/genres";
import type { AnimeGenre } from "@/lib/genres";
import { ANIME_STUDIOS } from "@/lib/studios";
import type { AnimeStudio } from "@/lib/studios";
import type { SeasonSlug } from "@/lib/seasons";
import type { TMDbAnime, TMDbSearchResponse } from "@/types/tmdb";

/** 1 行に並べる件数。TMDb の 1 ページ（20 件）では足りないので 2 ページ取る */
export const HOME_ROW_SIZE = 30;

/**
 * シーズン行の数。ピル列（8 クール）を全部行にすると縦に長すぎるため直近だけ。
 * 各行が AniList + TMDb の名前検索を伴うので、ここを増やすと往復が線形に増える
 */
export const HOME_SEASON_ROW_COUNT = 4;

/**
 * シーズン行で fetchSeasonalAnime に渡す候補数。
 * limit は TMDb と突き合わせる前の AniList 候補数に効き、TMDb に無い作品・
 * 劇場版・重複ヒットが後から落ちる。30 件ちょうどを頼むと行が 30 件を割るため、
 * 現クール（TOP10 と共用）と同じ 50 件を頼んでから切る
 */
const SEASON_CANDIDATE_LIMIT = 50;

/** 年代行の数。ピル列（全年代）とは別に、直近の年代だけ行にする */
export const HOME_ERA_ROW_COUNT = 3;

/**
 * 制作会社行の数。ピル列（全社）とは別に、表示ごとにランダムな数社だけ行にする
 */
export const HOME_STUDIO_ROW_COUNT = 3;

/**
 * 制作会社行に出す最低件数。日本の TV アニメが数本しか無い会社
 * （スタジオジブリ 1 件・コミックス・ウェーブ・フィルム 8 件。2026-10 実測）は
 * 行にすると寂しいので飛ばし、次の候補で埋める。
 * これ以上・30 件未満の会社はあるだけ並べる（行が 30 件に満たないことがある）
 */
export const HOME_STUDIO_MIN_ITEMS = 10;

/**
 * 制作会社行の候補を何社まで取りに行くか。HOME_STUDIO_ROW_COUNT 社ずつの束で
 * 並列に取り、3 行そろった束で止める。最悪でも 9 社 = TMDb 18 往復
 * （通常は最初の束で足りて 6 往復。どれも 1800 秒キャッシュ）
 */
export const HOME_STUDIO_MAX_CANDIDATES = 9;

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
 * 制作会社行の候補順。全社を表示ごとにランダムに並べる（重複なし）。
 * 年代と違い「直近」のような自然な順が無いため、毎回入れ替えて全社に出番を作る。
 * 先頭から fetchStudioRows が件数の足りる会社を拾う
 */
export function pickHomeStudios(): AnimeStudio[] {
  return shuffle(ANIME_STUDIOS);
}

/**
 * 連続 2 ページを並列で取り、重複を除いて 1 行分に揃える。
 * 片方のページが落ちても残りで返し、両方落ちたら空配列（ホーム全体を落とさない）
 */
async function fetchTwoPages(
  fetchPage: (page: number) => Promise<TMDbSearchResponse<TMDbAnime>>,
  maxStartPage = MAX_START_PAGE,
): Promise<TMDbAnime[]> {
  const start = randomPage(maxStartPage);
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
  if (genre.filterType === "keyword") {
    // 固定のキーワード ID（同義語込み）で引く。名前の先頭ヒットは別物に当たりうる（#99）
    const ids = genreKeywordIds(genre);
    return fetchTwoPages((page) => getAnimeByKeyword(ids, page));
  }
  return fetchTwoPages((page) => getAnimeByGenre(genre.id, page));
}

/** 年代 1 件分の行 */
export function fetchEraRow(decade: number): Promise<TMDbAnime[]> {
  return fetchTwoPages((page) => getAnimeByEra(decade, page));
}

/**
 * 制作会社 1 社分の行。作品の少ない会社が多く（数十件で尽きる）、
 * 2 ページ目から始めると空振りするため、開始ページは常に 1
 */
export function fetchStudioRow(studio: AnimeStudio): Promise<TMDbAnime[]> {
  return fetchTwoPages((page) => getAnimeByStudio(studio.id, page), 1);
}

export interface HomeStudioRow {
  studio: AnimeStudio;
  items: TMDbAnime[];
}

/**
 * 候補順に制作会社を見て、HOME_STUDIO_MIN_ITEMS 件以上ある最初の
 * HOME_STUDIO_ROW_COUNT 社の行を返す。
 * HOME_STUDIO_ROW_COUNT 社ずつの束で並列に取り、そろった束で止める。
 * 取るのは先頭 HOME_STUDIO_MAX_CANDIDATES 社まで（TMDb の往復を有限に保つ）。
 * fetchStudioRow は失敗を [] に丸めるので、落ちた会社も「薄い会社」として飛ばす
 */
export async function fetchStudioRows(
  candidates: AnimeStudio[],
): Promise<HomeStudioRow[]> {
  const pool = candidates.slice(0, HOME_STUDIO_MAX_CANDIDATES);
  const rows: HomeStudioRow[] = [];
  for (
    let i = 0;
    i < pool.length && rows.length < HOME_STUDIO_ROW_COUNT;
    i += HOME_STUDIO_ROW_COUNT
  ) {
    const batch = pool.slice(i, i + HOME_STUDIO_ROW_COUNT);
    const fetched = await Promise.all(
      batch.map(async (studio) => ({
        studio,
        items: await fetchStudioRow(studio),
      })),
    );
    for (const row of fetched) {
      if (rows.length >= HOME_STUDIO_ROW_COUNT) break;
      if (row.items.length >= HOME_STUDIO_MIN_ITEMS) rows.push(row);
    }
  }
  return rows;
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
      limit: SEASON_CANDIDATE_LIMIT,
    });
    return items.slice(0, HOME_ROW_SIZE);
  } catch {
    return [];
  }
}

interface SeasonKey {
  year: number;
  season: SeasonSlug;
}

/**
 * 複数シーズンの行を **1 シーズンずつ順に** 取る。
 *
 * キャッシュが冷えていると 1 シーズンで AniList を最大 8 回（2 系統 × 4 ページ）叩く。
 * 全部並列にすると、同じ段で走る現クールの取得（TOP10・Hero・人気声優の元）まで
 * AniList の分間制限に巻き込まれて TMDb フォールバックに落ちる。
 * AniList のシーズン取得は 6 時間キャッシュされるので、直列で遅くなるのは冷えた時だけ
 */
export async function fetchSeasonRows(
  seasons: SeasonKey[],
): Promise<TMDbAnime[][]> {
  const rows: TMDbAnime[][] = [];
  for (const s of seasons) {
    rows.push(await fetchSeasonRow(s.year, s.season));
  }
  return rows;
}
