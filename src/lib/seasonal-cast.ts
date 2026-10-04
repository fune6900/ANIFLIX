// アニメ作品のキャストを横断集約するヘルパ
//
// TMDb の /person/popular はワールドワイドで Hollywood 偏重のため、日本の声優の
// ランキングを得る目的では使えない。代わりに「今期人気アニメ N 本に出ているキャスト」を
// 並列取得して、出演本数の多い順に並べることで「日本でいま人気の声優」を近似する。
//
// 使用箇所:
//   - / （ホーム）の「🎤 人気声優」
//   - /voice-actors の「今期放送中アニメの声優」「最新アニメ映画の声優」

import { getAnimeCredits, getMovieCredits } from "@/lib/tmdb";
import type { TMDbCastMember } from "@/types/tmdb";

export interface AggregatedCast {
  id: number;
  name: string;
  profilePath: string | null;
  /** 集約対象アニメに何作出演しているか */
  appearances: number;
  /** その作品中での出演順（小さいほど主役寄り） */
  bestOrder: number;
  /** 最も主役寄り作品でのキャラ名 */
  topCharacter: string;
}

export interface AggregateSeasonalCastOptions {
  /** order がこの値以上のキャストは無視（default: 15） */
  maxOrder?: number;
}

const DEFAULT_MAX_ORDER = 15;

/**
 * 与えられたアニメ（TV）ID 群の credits を並列取得して主役級キャストを横断集約する。
 *
 * 並び順: 出演本数 desc → bestOrder asc → 日本語名 asc。
 */
export function aggregateSeasonalCast(
  animeIds: number[],
  options: AggregateSeasonalCastOptions = {},
): Promise<AggregatedCast[]> {
  return aggregateCredits(
    animeIds.map((id) => getAnimeCredits(id)),
    options,
  );
}

/** 映画版。与えられた映画 ID 群の credits を集約する（並び順は TV と同じ） */
export function aggregateMovieCast(
  movieIds: number[],
  options: AggregateSeasonalCastOptions = {},
): Promise<AggregatedCast[]> {
  return aggregateCredits(
    movieIds.map((id) => getMovieCredits(id)),
    options,
  );
}

/** credits の取得結果を集約する。失敗した作品は飛ばす */
async function aggregateCredits(
  requests: Promise<{ cast: TMDbCastMember[] }>[],
  options: AggregateSeasonalCastOptions,
): Promise<AggregatedCast[]> {
  const maxOrder = options.maxOrder ?? DEFAULT_MAX_ORDER;
  const responses = await Promise.allSettled(requests);

  const map = new Map<number, AggregatedCast>();
  for (const r of responses) {
    if (r.status !== "fulfilled") continue;
    for (const m of r.value.cast) {
      if (m.order >= maxOrder) continue;
      const prev = map.get(m.id);
      if (prev) {
        prev.appearances += 1;
        if (m.order < prev.bestOrder) {
          prev.bestOrder = m.order;
          prev.topCharacter = m.character;
        }
      } else {
        map.set(m.id, {
          id: m.id,
          name: m.name,
          profilePath: m.profile_path,
          appearances: 1,
          bestOrder: m.order,
          topCharacter: m.character,
        });
      }
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      b.appearances - a.appearances ||
      a.bestOrder - b.bestOrder ||
      a.name.localeCompare(b.name, "ja"),
  );
}
