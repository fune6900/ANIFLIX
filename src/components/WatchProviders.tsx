import Image from "next/image";
import { getImageUrl } from "@/lib/tmdb";
import type { TMDbWatchProvider, TMDbWatchProviderCountry } from "@/types/tmdb";

interface WatchProvidersProps {
  country: TMDbWatchProviderCountry | undefined;
  /** 検索 URL を組み立てるための作品タイトル */
  title: string;
  /** マッピング外プロバイダのフォールバック用 TMDb 集約 watch ページ */
  fallbackLink?: string;
}

interface ProviderGroup {
  label: string;
  badgeClass: string;
  providers: TMDbWatchProvider[];
}

/** 提供国別ロケール: 日本配信を優先 */
export function pickProviderCountry(
  results: Record<string, TMDbWatchProviderCountry> | undefined,
): TMDbWatchProviderCountry | undefined {
  if (!results) return undefined;
  return results.JP ?? results.US ?? Object.values(results)[0];
}

/** TMDb 由来の外部 URL を https + themoviedb.org に限定して検証する */
function sanitizeTmdbLink(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (!u.hostname.endsWith("themoviedb.org")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * provider_name → 各サービスの「作品名検索 URL ビルダ」マッピング。
 * 完全一致 / 前方一致のいずれかで判定。マッピング外は TMDb 集約ページにフォールバック。
 *
 * 注: TMDb の watch providers API は各サービスの作品詳細直リンクを返さないため、
 * 検索結果ページに飛ばすのが現実的な代替策。
 */
const PROVIDER_SEARCH_BUILDERS: Array<{
  match: (name: string) => boolean;
  build: (title: string) => string;
}> = [
  {
    match: (n) => n.startsWith("Netflix"),
    build: (t) => `https://www.netflix.com/search?q=${encodeURIComponent(t)}`,
  },
  {
    match: (n) => n.startsWith("Amazon Prime Video") || n === "Prime Video",
    build: (t) =>
      `https://www.amazon.co.jp/s?k=${encodeURIComponent(t)}&i=instant-video`,
  },
  {
    // "Crunchyroll Amazon Channel" 等の複合名は各サービス側に寄せるため、
    // ここは Amazon 単体の表記のみ拾う
    match: (n) => n === "Amazon Video" || n === "Amazon Channel",
    build: (t) =>
      `https://www.amazon.co.jp/s?k=${encodeURIComponent(t)}&i=instant-video`,
  },
  {
    match: (n) => n.startsWith("Disney"),
    build: (t) =>
      `https://www.disneyplus.com/ja-jp/search?q=${encodeURIComponent(t)}`,
  },
  {
    match: (n) => n === "U-Next" || n === "U-NEXT",
    build: (t) =>
      `https://video.unext.jp/freeword?query=${encodeURIComponent(t)}`,
  },
  {
    match: (n) => n.startsWith("dAnime") || n.startsWith("d Anime"),
    build: (t) =>
      `https://anime.dmkt-sp.jp/animestore/sch_pc?searchKey=${encodeURIComponent(t)}&vodTypeList=svod_tvod`,
  },
  {
    match: (n) => n === "FOD" || n.startsWith("FOD"),
    build: (t) =>
      `https://fod.fujitv.co.jp/title/?searchWord=${encodeURIComponent(t)}`,
  },
  {
    match: (n) => n === "Hulu",
    build: (t) => `https://www.hulu.jp/search?q=${encodeURIComponent(t)}`,
  },
  {
    match: (n) =>
      n === "Apple TV" || n === "Apple TV Plus" || n === "Apple TV+",
    build: (t) =>
      `https://tv.apple.com/jp/search?term=${encodeURIComponent(t)}`,
  },
  {
    match: (n) => n.startsWith("YouTube"),
    build: (t) =>
      `https://www.youtube.com/results?search_query=${encodeURIComponent(t)}`,
  },
  {
    match: (n) => n === "Google Play Movies" || n === "Google Play",
    build: (t) =>
      `https://play.google.com/store/search?q=${encodeURIComponent(t)}&c=movies`,
  },
  {
    match: (n) => n === "ABEMA" || n === "Abema TV",
    build: (t) => `https://abema.tv/search?q=${encodeURIComponent(t)}`,
  },
  {
    // "Crunchyroll Amazon Channel" のような複合名も Crunchyroll に寄せる
    match: (n) => n.startsWith("Crunchyroll"),
    build: (t) =>
      `https://www.crunchyroll.com/search?q=${encodeURIComponent(t)}`,
  },
  {
    match: (n) => n === "Bandai Channel",
    build: (t) =>
      `https://www.b-ch.com/list/keyword.php?ima=2000&p_word=${encodeURIComponent(t)}`,
  },
  {
    match: (n) => n === "TELASA",
    build: (t) => `https://www.telasa.jp/search?q=${encodeURIComponent(t)}`,
  },
];

function buildProviderLink(
  providerName: string,
  title: string,
  fallbackLink: string | null,
): string | null {
  const builder = PROVIDER_SEARCH_BUILDERS.find((b) => b.match(providerName));
  if (builder) return builder.build(title);
  return fallbackLink;
}

export default function WatchProviders({
  country,
  title,
  fallbackLink,
}: WatchProvidersProps) {
  if (!country) return null;
  const safeFallback = sanitizeTmdbLink(fallbackLink ?? country.link);
  const seen = new Set<number>();

  const groups: ProviderGroup[] = [
    {
      label: "見放題",
      badgeClass: "bg-green-700/70 text-green-100 border-green-500/40",
      providers: country.flatrate ?? [],
    },
    {
      label: "無料",
      badgeClass: "bg-sky-700/70 text-sky-100 border-sky-500/40",
      providers: country.free ?? [],
    },
    {
      label: "広告付き無料",
      badgeClass: "bg-cyan-700/70 text-cyan-100 border-cyan-500/40",
      providers: country.ads ?? [],
    },
    {
      label: "レンタル",
      badgeClass: "bg-amber-700/70 text-amber-100 border-amber-500/40",
      providers: country.rent ?? [],
    },
    {
      label: "購入",
      badgeClass: "bg-rose-700/70 text-rose-100 border-rose-500/40",
      providers: country.buy ?? [],
    },
  ];

  // 重複プロバイダ（買い切り＆見放題両方など）は最上位グループに寄せる
  const dedupedGroups = groups
    .map((g) => ({
      ...g,
      providers: g.providers.filter((p) => {
        if (seen.has(p.provider_id)) return false;
        seen.add(p.provider_id);
        return true;
      }),
    }))
    .filter((g) => g.providers.length > 0);

  if (dedupedGroups.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-white font-bold text-lg mb-3">配信中のサービス</h2>

      <div className="space-y-4">
        {dedupedGroups.map((group) => (
          <div key={group.label}>
            <p
              className={`inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border mb-2 ${group.badgeClass}`}
            >
              {group.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.providers.map((provider) => {
                const chipClass =
                  "group flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-full pl-1 pr-3 py-1 transition-all";
                const link = buildProviderLink(
                  provider.provider_name,
                  title,
                  safeFallback,
                );
                const chipTitle = `${provider.provider_name} で「${title}」を探す`;
                const inner = (
                  <>
                    <span className="relative block w-7 h-7 rounded-full overflow-hidden bg-gray-900 flex-shrink-0">
                      {provider.logo_path ? (
                        <Image
                          src={getImageUrl(provider.logo_path, "w185")}
                          alt={provider.provider_name}
                          fill
                          sizes="28px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
                          {provider.provider_name.slice(0, 2)}
                        </span>
                      )}
                    </span>
                    <span className="text-white text-xs font-semibold group-hover:underline whitespace-nowrap">
                      {provider.provider_name}
                    </span>
                  </>
                );
                return link ? (
                  <a
                    key={provider.provider_id}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={chipClass}
                    title={chipTitle}
                  >
                    {inner}
                  </a>
                ) : (
                  <div
                    key={provider.provider_id}
                    className={chipClass}
                    title={chipTitle}
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
