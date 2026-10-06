// 制作会社ホーム（/browse/studios）の行とカルーセルを組み立てる（#117）
//
// 構成はアニメ映画画面（`src/lib/movie-home-rows.ts`）と同じ「Hero + 横スクロールの行」。
// TMDb 呼び出しは 1 描画あたり各社 1 回（`ANIME_STUDIOS` の社数ぶん）だけで、
// カルーセルも同じ取得結果から選ぶ（追加の問い合わせをしない）。

import { getAnimeByStudio } from "@/lib/tmdb";
import { ANIME_STUDIOS } from "@/lib/studios";
import type { AnimeStudio } from "@/lib/studios";
import { FEATURED_HERO_SIZE, isHeroReady } from "@/lib/featured-rows";
import { shuffle } from "@/lib/home-rows";
import type { TMDbAnime } from "@/types/tmdb";

/** 1 行の件数。26 社ぶん並ぶので TMDb 1 ページ（20 件）に留める */
export const STUDIO_ROW_SIZE = 20;

export interface StudioRow {
  studio: AnimeStudio;
  /** 人気順。取得に失敗した社は空 */
  anime: TMDbAnime[];
}

export interface StudioHome {
  /** カルーセル（背景画像・あらすじのある作品。社が偏らないように選ぶ） */
  hero: TMDbAnime[];
  /** `ANIME_STUDIOS` と同順。空の行も含む（描画側で隠す） */
  rows: StudioRow[];
}

/** 1 社分の行（人気順の 1 ページ目） */
async function fetchStudioRow(studio: AnimeStudio): Promise<TMDbAnime[]> {
  const res = await getAnimeByStudio(studio.id, 1);
  return res.results.slice(0, STUDIO_ROW_SIZE);
}

/** 取得に失敗した行は空にする（1 社の失敗でページ全体を落とさない） */
async function safeStudioRow(studio: AnimeStudio): Promise<TMDbAnime[]> {
  try {
    return await fetchStudioRow(studio);
  } catch (error) {
    // 行は黙って消えるので、TMDb の 429 などを追えるようログには残す
    console.error(`[studio-home] row "${studio.id}" failed:`, error);
    return [];
  }
}

/**
 * カルーセルの作品を選ぶ。
 *
 * 社の順をシャッフルし、各社の一番人気 → 二番手 … の順に 1 件ずつ取る（ラウンドロビン）。
 * 先頭の社から 6 件を取ると 1 社の作品で埋まるため。共同制作（例: 進撃の巨人 =
 * WIT STUDIO / MAPPA）で同じ作品が複数社に出るので id で重複を落とす
 */
function pickHero(rows: TMDbAnime[][]): TMDbAnime[] {
  const candidates = shuffle(rows.map((row) => row.filter(isHeroReady)));
  const depth = Math.max(0, ...candidates.map((c) => c.length));
  const seen = new Set<number>();
  const hero: TMDbAnime[] = [];

  for (let rank = 0; rank < depth; rank++) {
    for (const list of candidates) {
      const a = list[rank];
      if (!a || seen.has(a.id)) continue;
      seen.add(a.id);
      hero.push(a);
      if (hero.length >= FEATURED_HERO_SIZE) return hero;
    }
  }
  return hero;
}

/** 全社の行を並列に取る。各行は失敗しても空配列になり、ページは落ちない */
export async function loadStudioHome(): Promise<StudioHome> {
  const rows = await Promise.all(ANIME_STUDIOS.map(safeStudioRow));

  return {
    hero: pickHero(rows),
    rows: ANIME_STUDIOS.map((studio, i) => ({ studio, anime: rows[i] })),
  };
}
