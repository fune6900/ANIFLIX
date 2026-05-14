// AniList を「シーズン作品リスト源」、TMDb を「表示データ源」として橋渡しするヘルパ
//
// TMDb は2期エピソードが1期に統合されているなどシーズン管理に不備があるため、
// AniList から正確な季別タイトル一覧を取得し、各タイトルを TMDb 名前検索で解決して
// TMDb 側の作品データ（poster/backdrop/score/詳細リンク）を返す。
//
// 使用箇所:
//   - /browse/season/[year]/[season]
//   - /browse/airing
//   - ホーム「現クール TOP10」

import {
  getAniListSeasonAnime,
  toAniListSeason,
  type AniListMedia,
} from "@/lib/anilist";
import { getAnimeBySeason, searchAnime } from "@/lib/tmdb";
import { getSeasonDateRange, type SeasonSlug } from "@/lib/seasons";
import type { TMDbAnime } from "@/types/tmdb";

// ──────────────────────────────────────────
// 公開 API
// ──────────────────────────────────────────

export interface SeasonalAnimeOptions {
  /** 最終的に返す作品数の上限 (default: 100) */
  limit?: number;
  /** TMDb 名前検索の並列度 (default: 4) */
  concurrency?: number;
  /** AniList 失敗時に TMDb の discover フォールバックを使うか (default: true) */
  fallbackToTmdbDiscover?: boolean;
}

export interface SeasonalAnimeResult {
  /** TMDb の作品データ（マッチした分のみ）。AniList の人気順を維持 */
  items: TMDbAnime[];
  /** 取得経路 */
  source: "anilist+tmdb" | "tmdb-fallback" | "empty";
  /** AniList から取れたタイトル総数（参考） */
  anilistTotal: number;
  /** TMDb マッチに失敗したタイトル（観測用） */
  unmatchedTitles: string[];
}

/**
 * 指定シーズンの作品を AniList ベースで取得し、TMDb の作品データで返す。
 *
 * 流れ:
 *   1. AniList の季別人気作品リストを取得（最大 limit 件、2ページ並列）
 *   2. 同季の TMDb プールも並列で取得（Step A 一次マッチ用）
 *   3. 各 AniList 作品を TMDb と突き合わせ:
 *      A. TMDb プール内で title 完全一致を探す
 *      B. ヒット無ければ /search/tv で名前検索 → 結果を検証して採用
 *      C. それでも不一致は表示しない
 *   4. AniList 人気順を維持して TMDbAnime[] を返す
 *
 * AniList が失敗した場合は fallbackToTmdbDiscover=true なら従来通り TMDb discover に倒す。
 */
export async function fetchSeasonalAnime(
  year: number,
  season: SeasonSlug,
  options: SeasonalAnimeOptions = {},
): Promise<SeasonalAnimeResult> {
  const limit = options.limit ?? 100;
  const concurrency = options.concurrency ?? 4;
  const fallbackToTmdbDiscover = options.fallbackToTmdbDiscover ?? true;

  const { from, to } = getSeasonDateRange(year, season);

  // 1 & 2. AniList と TMDb プールを並列取得
  const [anilistP1, anilistP2, tmdbP1, tmdbP2] = await Promise.allSettled([
    getAniListSeasonAnime(year, toAniListSeason(season), 1, 50),
    getAniListSeasonAnime(year, toAniListSeason(season), 2, 50),
    // TMDb プールはマッチ用に 6h キャッシュ
    getAnimeBySeason(from, to, 1, 21600),
    getAnimeBySeason(from, to, 2, 21600),
  ]);

  const anilistResults: AniListMedia[] = [];
  if (anilistP1.status === "fulfilled") {
    anilistResults.push(...anilistP1.value.results);
  }
  if (anilistP2.status === "fulfilled") {
    anilistResults.push(...anilistP2.value.results);
  }
  const anilistTotal = anilistResults.length;

  const tmdbPool: TMDbAnime[] = [
    ...(tmdbP1.status === "fulfilled" ? tmdbP1.value.results : []),
    ...(tmdbP2.status === "fulfilled" ? tmdbP2.value.results : []),
  ];

  // AniList が両方失敗 → フォールバック判定
  if (anilistResults.length === 0) {
    if (fallbackToTmdbDiscover && tmdbPool.length > 0) {
      return {
        items: tmdbPool.slice(0, limit),
        source: "tmdb-fallback",
        anilistTotal: 0,
        unmatchedTitles: [],
      };
    }
    return {
      items: [],
      source: "empty",
      anilistTotal: 0,
      unmatchedTitles: [],
    };
  }

  // 3. 各 AniList 作品を TMDb と突き合わせ
  const resolved = await pMapLimit(
    anilistResults.slice(0, limit),
    concurrency,
    async (media): Promise<{ anime: TMDbAnime | null; title: string }> => {
      const title = pickDisplayTitle(media);
      const anime = await matchAniListToTmdb(media, tmdbPool);
      return { anime, title };
    },
  );

  // 4. 重複排除（同じ TMDb id に複数 AniList 作品がマッチした場合は先着優先）
  const dedupedMap = new Map<number, TMDbAnime>();
  const unmatchedTitles: string[] = [];
  for (const { anime, title } of resolved) {
    if (anime) {
      if (!dedupedMap.has(anime.id)) {
        dedupedMap.set(anime.id, anime);
      }
    } else {
      unmatchedTitles.push(title);
    }
  }

  return {
    items: Array.from(dedupedMap.values()),
    source: "anilist+tmdb",
    anilistTotal,
    unmatchedTitles,
  };
}

// ──────────────────────────────────────────
// 内部ヘルパ
// ──────────────────────────────────────────

/** 同時実行数を制限する並列 mapper（レートリミット対策） */
async function pMapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i]);
    }
  }
  const concurrent = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: concurrent }, () => run()));
  return results;
}

/** タイトル比較用の正規化: 大文字/全角/記号/空白の差異を吸収する */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s　:：!！?？・,、。.「」『』()（）\-]/g, "")
    .normalize("NFKC");
}

function pickDisplayTitle(media: AniListMedia): string {
  return (
    media.title.native ??
    media.title.romaji ??
    media.title.english ??
    `(anilist:${media.id})`
  );
}

/**
 * AniList の作品を TMDb の作品に紐付けて返す。
 * Step A: TMDb プール内で完全一致
 * Step B: TMDb /search/tv で検索し、結果を再検証
 * 不一致なら null
 */
async function matchAniListToTmdb(
  media: AniListMedia,
  tmdbPool: TMDbAnime[],
): Promise<TMDbAnime | null> {
  const candidates = [
    media.title.native,
    media.title.romaji,
    media.title.english,
    ...(media.synonyms ?? []),
  ].filter((s): s is string => !!s);

  const normalizedCandidates = new Set(candidates.map(normalizeTitle));

  // Step A: ローカルプールと突き合わせ
  const direct = tmdbPool.find((a) => {
    const tmdbNames = [a.name, a.original_name].filter((s): s is string => !!s);
    return tmdbNames.some((n) => normalizedCandidates.has(normalizeTitle(n)));
  });
  if (direct) return direct;

  // Step B: TMDb 名前検索 → 結果を normalizedCandidates で再検証して誤マッチを排除
  const primary =
    media.title.native ?? media.title.romaji ?? media.title.english;
  if (!primary) return null;
  try {
    // ヘルパ経由は 24h キャッシュ
    const sr = await searchAnime(primary, 86400);
    const verified = sr.results.find((r) => {
      const names = [r.name, r.original_name].filter((s): s is string => !!s);
      return names.some((n) => normalizedCandidates.has(normalizeTitle(n)));
    });
    return verified ?? null;
  } catch {
    return null;
  }
}
