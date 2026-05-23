// アニメ・映画のキーワード検索を「揺らぎ吸収 + AniList フォールバック」で強化するヘルパ。
//
// 解決する問題:
//   1. ユーザー入力に「4期」「第N期」「Season N」等のシーズン suffix が付くと
//      TMDb がベース作品を返さない（TMDb はシリーズ本体に Season N を集約しているため）
//      → getSearchTitleVariants で suffix を剥がしたバリアントも同時検索
//   2. TMDb に登録されていない略称（"転スラ" / "リゼロ" 等）でゼロヒットになる
//      → AniList で fuzzy 検索し、ヒットした作品の native / synonyms で TMDb を再検索
//
// 使用箇所:
//   - /search/page.tsx (キーワードモード)
//   - /browse/movies/page.tsx (キーワードモード)
//   - /api/search/route.ts, /api/search/movies/route.ts
//
// ページネーション方針:
//   - TMDb 原文検索の total_pages を「主結果」のものとして使う
//   - 揺らぎバリアント・AniList フォールバックの結果は page=1 でのみ追加し、重複排除
//   - ページ2以降は原文検索のみで進む（バリアントの結果は1ページ目で出し切る）

import {
  isJapaneseAnimeMovie,
  isJapaneseAnimeTV,
  searchAnime,
  searchMovie,
  searchTVByPage,
} from "@/lib/tmdb";
import { pickAniListTitleCandidates, searchAniListMedia } from "@/lib/anilist";
import { getSearchTitleVariants } from "@/lib/title-strip";
import type { TMDbAnime, TMDbMovie } from "@/types/tmdb";

interface SearchResult<T> {
  results: T[];
  totalResults: number;
  totalPages: number;
}

/** TMDb 名前検索で「日本のアニメ TV」を取得。ページ指定対応 */
async function searchAnimeRaw(
  query: string,
  page = 1,
): Promise<SearchResult<TMDbAnime>> {
  const data =
    page === 1 ? await searchAnime(query) : await searchTVByPage(query, page);
  const filtered = data.results.filter(isJapaneseAnimeTV);
  return {
    results: filtered,
    totalResults: data.total_results,
    totalPages: data.total_pages,
  };
}

/** TMDb 名前検索で「日本のアニメ映画」を取得（TMDb の映画検索はページネーション固定） */
async function searchMovieRaw(query: string): Promise<SearchResult<TMDbMovie>> {
  const data = await searchMovie(query);
  const filtered = data.results.filter(isJapaneseAnimeMovie);
  return {
    results: filtered,
    totalResults: data.total_results,
    totalPages: data.total_pages,
  };
}

/**
 * アニメ（TV）のキーワード検索を揺らぎ吸収 + AniList フォールバックで実行する。
 *
 * @param query 元クエリ（sanitize 済み）
 * @param page  TMDb 原文検索のページ番号
 * @returns 主結果（TMDb 原文）の total / pages を保持しつつ、補強結果は page=1 のみ追加
 */
export async function searchAnimeKeyword(
  query: string,
  page = 1,
): Promise<SearchResult<TMDbAnime>> {
  const variants = getSearchTitleVariants(query);

  // 主結果: 原文での TMDb 検索（ページネーションの基準になる）
  const primary = await searchAnimeRaw(query, page).catch(() => ({
    results: [],
    totalResults: 0,
    totalPages: 1,
  }));

  // page=1 でのみバリアント・AniList フォールバックを差し込む
  if (page > 1) return primary;

  const seenIds = new Set(primary.results.map((r) => r.id));
  const merged: TMDbAnime[] = [...primary.results];

  // (a) suffix 剥がしバリアント
  for (const variant of variants.slice(1)) {
    try {
      const sub = await searchAnimeRaw(variant, 1);
      for (const item of sub.results) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          merged.push(item);
        }
      }
    } catch {
      // バリアント検索の失敗は無視（主結果が取れているなら問題ない）
    }
  }

  // (b) ヒットが少ない / ゼロなら AniList フォールバック
  if (merged.length < 3) {
    try {
      const aniMedia = await searchAniListMedia(query, "ANIME", 5);
      for (const media of aniMedia) {
        const candidates = pickAniListTitleCandidates(media);
        for (const candidate of candidates) {
          try {
            const sub = await searchAnimeRaw(candidate, 1);
            for (const item of sub.results) {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                merged.push(item);
              }
            }
            if (sub.results.length > 0) break; // 1 候補ヒットしたら次の AniList 作品へ
          } catch {
            // 候補単位の失敗は次へ
          }
        }
      }
    } catch {
      // AniList 失敗は無視
    }
  }

  return {
    results: merged,
    totalResults: Math.max(primary.totalResults, merged.length),
    totalPages: Math.max(primary.totalPages, 1),
  };
}

/**
 * アニメ映画版。`searchMovie` の TMDb API はページ番号を直接取れないため、
 * このヘルパは常に「page=1 を補強した単一ページ結果」を返す。呼び出し側のページャが
 * 2ページ目以降を要求しても同じ結果を繰り返さないよう、totalPages は常に 1 に固定し、
 * totalResults は merged 件数に揃える。
 */
export async function searchMovieKeyword(
  query: string,
): Promise<SearchResult<TMDbMovie>> {
  const variants = getSearchTitleVariants(query);

  const primary = await searchMovieRaw(query).catch(() => ({
    results: [],
    totalResults: 0,
    totalPages: 1,
  }));

  const seenIds = new Set(primary.results.map((r) => r.id));
  const merged: TMDbMovie[] = [...primary.results];

  for (const variant of variants.slice(1)) {
    try {
      const sub = await searchMovieRaw(variant);
      for (const item of sub.results) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          merged.push(item);
        }
      }
    } catch {}
  }

  if (merged.length < 3) {
    try {
      const aniMedia = await searchAniListMedia(query, "MOVIE", 5);
      for (const media of aniMedia) {
        const candidates = pickAniListTitleCandidates(media);
        for (const candidate of candidates) {
          try {
            const sub = await searchMovieRaw(candidate);
            for (const item of sub.results) {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                merged.push(item);
              }
            }
            if (sub.results.length > 0) break;
          } catch {}
        }
      }
    } catch {}
  }

  return {
    results: merged,
    totalResults: merged.length,
    totalPages: 1,
  };
}
