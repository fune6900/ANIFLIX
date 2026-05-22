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
import { stripSeasonSuffix } from "@/lib/title-strip";
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
    .replace(/[\s　:：!！?？・,、。.「」『』()（）\-－–—~〜～]/g, "")
    .normalize("NFKC");
}

/** 比較用キー: フル正規化 + サフィックス剥がし正規化のセットを返す（AniList 候補側で使用） */
function buildCompareKeys(title: string): { full: string; stripped: string } {
  const full = normalizeTitle(title);
  const stripped = normalizeTitle(stripSeasonSuffix(title));
  return { full, stripped };
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
 *
 * TMDb は新クール作品を独立したエントリではなく本体作品の Season N として登録する
 * ため（例: 「転スラ第4期」のエピソードが「転生したらスライムだった件」(id 82684) の
 * Season 4 に入る）、AniList のシーズン番号サフィックスを剥がしてから比較する。
 *
 * 比較は非対称: AniList 側のみ「フル + サフィックス剥がし」両方をキー化し、
 * TMDb 側は **フル正規化のみ** で照合する。これは AniList「進撃の巨人」(親) ×
 * TMDb プール「進撃の巨人 Final Season」が同居した場合に、TMDb 側も strip して
 * しまうと AniList 親が TMDb 続編エントリに誤マッチするため。
 *
 * Step A: TMDb プール内で完全一致（TMDb はフルのみ・AniList はフル / 剥がし両方）
 * Step B: TMDb /search/tv をフル / サフィックス剥がしクエリ両方で検索し、結果を再検証
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

  // 候補タイトル全てに対してフル正規化キー + サフィックス剥がしキーを集約
  // （Set なのでフル == 剥がしの場合は自動で重複排除される）
  const candidateKeys = new Set<string>();
  for (const c of candidates) {
    const { full, stripped } = buildCompareKeys(c);
    candidateKeys.add(full);
    if (stripped) candidateKeys.add(stripped);
  }

  // TMDb 側はフル正規化のみで照合（非対称比較で逆方向誤マッチを防ぐ）
  const matchesCandidate = (tmdbName: string): boolean => {
    return candidateKeys.has(normalizeTitle(tmdbName));
  };

  // Step A: ローカルプールと突き合わせ
  const direct = tmdbPool.find((a) => {
    const tmdbNames = [a.name, a.original_name].filter((s): s is string => !!s);
    return tmdbNames.some(matchesCandidate);
  });
  if (direct) return direct;

  // Step B: TMDb 名前検索
  // primary そのまま検索 → ヒット無ければサフィックス剥がし版で再検索。
  // 例: 「転スラ第4期」では原文ゼロヒットなので「転スラ」にして本体作品(82684)を取りに行く
  const primary =
    media.title.native ?? media.title.romaji ?? media.title.english;
  if (!primary) return null;

  const stripped = stripSeasonSuffix(primary);
  const queries =
    stripped && stripped !== primary ? [primary, stripped] : [primary];

  for (const query of queries) {
    try {
      // ヘルパ経由は 24h キャッシュ
      const sr = await searchAnime(query, 86400);
      const verified = sr.results.find((r) => {
        const names = [r.name, r.original_name].filter((s): s is string => !!s);
        return names.some(matchesCandidate);
      });
      if (verified) return verified;
    } catch {
      // 個別失敗は次のクエリへ
    }
  }
  return null;
}
