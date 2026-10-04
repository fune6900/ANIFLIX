// 特集の行（声優ページ #102・キャラクターページ #104）の共通部分
//
// 両ページは「Hero + 横スクロールの行 + 「すべて見る」の専用ページ」の同じ構成を取る。
// ここには両者が共有するものだけを置く:
//   - 取得元（今期の作品一覧・今期 / 前クールのキャスト・シリーズのキャスト）。
//     両ページが同じ関数を同じ引数で呼ぶので、Next の Data Cache を共有する
//     （片方のページを開けば、もう片方の同じ取得元は AniList へ問い合わせない）
//   - 1 描画につき 1 回だけ引くメモ化（`once`）と、行単位の失敗の隔離（`safeRow`）
//   - 専用ページの slug のホワイトリスト照合（`loadCollectionRow`）

import {
  getAniListFranchiseCast,
  getAniListSeasonCast,
  toAniListSeason,
} from "@/lib/anilist";
import { fetchSeasonalAnime } from "@/lib/seasonal-anime";
import { getRecentSeasons, type AnimeSeason } from "@/lib/seasons";
import { findFranchise, type AnimeFranchise } from "@/lib/franchises";
import type { AniListCastEdge, AniListCastMedia } from "@/types/anilist";
import type { PortraitRow } from "@/types/portrait-card";
import type { TMDbAnime } from "@/types/tmdb";

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────

/** カルーセルの枚数（トップ画面と同じ） */
export const FEATURED_HERO_SIZE = 6;

/** 「今期人気作品の特集」の行数 */
export const FEATURED_WORK_COUNT = 5;

/**
 * 今期の作品一覧（TMDb の作品に照合済み）を何件まで照合するか。
 * 両ページで同じ値にして、TMDb のタイトル検索のキャッシュを共有する
 */
const SEASONAL_WORK_LIMIT = 30;

/** AniList の既定画像（画像の未登録）。`.../large/default.jpg` */
const ANILIST_DEFAULT_IMAGE = "/default.";

/** 特集の slug。作品 id は AniList の Media id（先頭 0 と桁数の暴走を弾く） */
const WORK_SLUG_PATTERN = /^work-([1-9]\d{0,8})$/;

const FRANCHISE_SLUG_PREFIX = "franchise-";

// ──────────────────────────────────────────
// slug
// ──────────────────────────────────────────

export function workRowSlug(aniListMediaId: number): string {
  return `work-${aniListMediaId}`;
}

export function franchiseRowSlug(franchise: AnimeFranchise): string {
  return `${FRANCHISE_SLUG_PREFIX}${franchise.slug}`;
}

// ──────────────────────────────────────────
// 日付
// ──────────────────────────────────────────

export interface JstDate {
  year: number;
  month: number;
  day: number;
  /** `YYYY-MM-DD` */
  key: string;
}

/** 日本時間の今日。誕生日・活動年数・公開日は日本の日付で数える */
export function todayJst(): JstDate {
  const key = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day, key };
}

// ──────────────────────────────────────────
// 取得元（1 描画につき 1 回だけ引く）
// ──────────────────────────────────────────

/** 最初の呼び出しの Promise を使い回す */
export function once<T>(load: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null;
  return () => {
    cached ??= load();
    return cached;
  };
}

/** 声優ページとキャラクターページが共有する取得元 */
export interface SharedCastSources {
  currentSeason: AnimeSeason;
  previousSeason: AnimeSeason;
  today: JstDate;
  /** 今期の人気作品（TMDb の TV 作品。Hero に使う） */
  seasonalAnime(): Promise<TMDbAnime[]>;
  /** 今期の人気作品のキャスト（キャラ + 日本語の声優） */
  currentSeasonCast(): Promise<AniListCastMedia[]>;
  previousSeasonCast(): Promise<AniListCastMedia[]>;
  franchiseCast(franchise: AnimeFranchise): Promise<AniListCastMedia[]>;
}

/**
 * 共有の取得元を作る。各取得元は呼ばれた時に初めて引き、以降は同じ結果を返す。
 * 専用ページでは、その行が使う取得元だけが引かれる
 */
export function createSharedCastSources(): SharedCastSources {
  const [currentSeason, previousSeason] = getRecentSeasons(2);
  const franchises = new Map<string, Promise<AniListCastMedia[]>>();

  return {
    currentSeason,
    previousSeason,
    today: todayJst(),
    seasonalAnime: once(async () => {
      const result = await fetchSeasonalAnime(
        currentSeason.year,
        currentSeason.season,
        { limit: SEASONAL_WORK_LIMIT },
      );
      return result.items;
    }),
    currentSeasonCast: once(() =>
      getAniListSeasonCast(
        currentSeason.year,
        toAniListSeason(currentSeason.season),
      ),
    ),
    previousSeasonCast: once(() =>
      getAniListSeasonCast(
        previousSeason.year,
        toAniListSeason(previousSeason.season),
      ),
    ),
    franchiseCast: (franchise) => {
      let cached = franchises.get(franchise.slug);
      if (!cached) {
        cached = getAniListFranchiseCast(
          franchise.search,
          franchise.castPerWork,
        );
        franchises.set(franchise.slug, cached);
      }
      return cached;
    },
  };
}

// ──────────────────────────────────────────
// AniList のキャスト
// ──────────────────────────────────────────

export function castEdgesOf(media: AniListCastMedia): AniListCastEdge[] {
  return media.characters?.edges ?? [];
}

export function isMainRole(edge: AniListCastEdge): boolean {
  return edge.role === "MAIN";
}

export function castWorkTitle(media: {
  id: number;
  title: {
    native: string | null;
    romaji: string | null;
    english: string | null;
  };
}): string {
  return (
    media.title.native ??
    media.title.romaji ??
    media.title.english ??
    `(id:${media.id})`
  );
}

/** AniList の画像。既定画像（未登録）は画像として扱わない */
export function aniListImage(url: string | null): string | null {
  return url && !url.includes(ANILIST_DEFAULT_IMAGE) ? url : null;
}

/** カルーセルに使える作品（名前・あらすじ・背景画像が揃っている） */
export function isHeroReady(a: TMDbAnime): boolean {
  return Boolean(a.backdrop_path && a.name && a.overview);
}

// ──────────────────────────────────────────
// 行
// ──────────────────────────────────────────

/** 取得に失敗した行は空にする（1 行の失敗でページ全体を落とさない） */
export async function safeRow(
  logTag: string,
  slug: string,
  title: string,
  load: () => Promise<PortraitRow>,
): Promise<PortraitRow> {
  try {
    return await load();
  } catch (error) {
    // 行は黙って消えるので、AniList の 429 などを追えるようログには残す
    console.error(`[${logTag}] row "${slug}" failed:`, error);
    return { slug, title, cards: [] };
  }
}

/** 「すべて見る」の専用ページの行の定義（ページごとに渡す） */
export interface CollectionDefinition<S> {
  createSources(): S;
  /** 作品・シリーズ以外の行（slug → 組み立て）。slug のホワイトリストを兼ねる */
  staticRows: ReadonlyMap<string, (src: S) => Promise<PortraitRow>>;
  loadFranchiseRow(src: S, franchise: AnimeFranchise): Promise<PortraitRow>;
  loadFeaturedWorkRows(src: S): Promise<PortraitRow[]>;
}

/**
 * 「すべて見る」の専用ページの 1 行。定義に無い slug は null（ページ側で 404）。
 *
 * - 固定の行は `Map` で照合する（`constructor` / `__proto__` のようなプロトタイプのキーを通さない）
 * - シリーズは `src/lib/franchises.ts` の定義に有るものだけ
 * - 作品特集（`work-{AniList id}`）は、今期の特集に入っている作品の id だけを受け付ける。
 *   中身は今期のキャスト（固定のキャッシュキー）から切り出すので、URL の id が
 *   そのまま AniList への問い合わせやキャッシュキーに載ることは無い
 */
export async function loadCollectionRow<S>(
  slug: string,
  def: CollectionDefinition<S>,
): Promise<PortraitRow | null> {
  const loadStatic = def.staticRows.get(slug);
  if (loadStatic) return loadStatic(def.createSources());

  if (slug.startsWith(FRANCHISE_SLUG_PREFIX)) {
    const franchise = findFranchise(slug.slice(FRANCHISE_SLUG_PREFIX.length));
    return franchise
      ? def.loadFranchiseRow(def.createSources(), franchise)
      : null;
  }

  if (WORK_SLUG_PATTERN.test(slug)) {
    const rows = await def.loadFeaturedWorkRows(def.createSources());
    return rows.find((r) => r.slug === slug) ?? null;
  }

  return null;
}
