// 配信サービスの判定（詳細ページの「配信中のサービス」と一覧のフィルターで共有）

import type {
  TMDbWatchProvider,
  TMDbWatchProvidersResponse,
} from "@/types/tmdb";

export interface StreamingService {
  /** URL クエリに載せる識別子 */
  slug: string;
  label: string;
  /** TMDb の provider_name がこのサービスか（表記ゆれを吸収する） */
  match: (providerName: string) => boolean;
}

/**
 * 一覧のフィルターで選べる配信サービス（日本で主要な定額見放題）。
 * provider_name は同じサービスでも表記がゆれるので、判定はここ 1 か所で持つ
 */
export const STREAMING_SERVICES: readonly StreamingService[] = [
  {
    slug: "netflix",
    label: "Netflix",
    match: (n) => n.startsWith("Netflix"),
  },
  {
    slug: "prime-video",
    label: "Amazon Prime Video",
    // "Crunchyroll Amazon Channel" のような複合名は各サービス側に寄せる
    match: (n) => n.startsWith("Amazon Prime Video") || n === "Prime Video",
  },
  {
    slug: "u-next",
    label: "U-NEXT",
    match: (n) => n === "U-Next" || n === "U-NEXT",
  },
  {
    slug: "d-anime",
    label: "dアニメストア",
    match: (n) => n.startsWith("dAnime") || n.startsWith("d Anime"),
  },
  {
    slug: "disney-plus",
    label: "Disney+",
    match: (n) => n.startsWith("Disney"),
  },
  {
    slug: "hulu",
    label: "Hulu",
    match: (n) => n === "Hulu",
  },
  {
    slug: "abema",
    label: "ABEMA",
    match: (n) => n === "ABEMA" || n === "Abema TV",
  },
  {
    slug: "dmm-tv",
    label: "DMM TV",
    match: (n) => n === "DMM TV",
  },
];

/** slug から引く（未知の値・プロトタイプのキーは undefined） */
export function findStreamingService(
  slug: string,
): StreamingService | undefined {
  return STREAMING_SERVICES.find((s) => s.slug === slug);
}

export function matchesStreamingService(
  slug: string,
  providerName: string,
): boolean {
  return findStreamingService(slug)?.match(providerName) ?? false;
}

/**
 * 日本リージョンで「配信中」（見放題・広告付き・無料）のサービスの slug。
 * レンタル・購入だけのサービスは数えない
 */
export function streamingServicesIn(
  res: TMDbWatchProvidersResponse,
): Set<string> {
  const jp = res.results?.JP;
  const providers: TMDbWatchProvider[] = [
    ...(jp?.flatrate ?? []),
    ...(jp?.ads ?? []),
    ...(jp?.free ?? []),
  ];
  const slugs = new Set<string>();
  for (const p of providers) {
    for (const s of STREAMING_SERVICES) {
      if (s.match(p.provider_name)) slugs.add(s.slug);
    }
  }
  return slugs;
}
