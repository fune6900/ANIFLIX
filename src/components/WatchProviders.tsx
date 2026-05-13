import Image from "next/image";
import { getImageUrl } from "@/lib/tmdb";
import type { TMDbWatchProvider, TMDbWatchProviderCountry } from "@/types/tmdb";

interface WatchProvidersProps {
  country: TMDbWatchProviderCountry | undefined;
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

export default function WatchProviders({ country }: WatchProvidersProps) {
  if (!country) return null;
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
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-white font-bold text-lg">配信中のサービス</h2>
        {country.link && (
          <a
            href={country.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#54b9c5] hover:text-white text-xs font-semibold transition-colors flex items-center gap-1"
          >
            TMDb で全件を見る
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </a>
        )}
      </div>

      <div className="space-y-4">
        {dedupedGroups.map((group) => (
          <div key={group.label}>
            <p
              className={`inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border mb-2 ${group.badgeClass}`}
            >
              {group.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.providers.map((provider) => (
                <a
                  key={provider.provider_id}
                  href={country.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-full pl-1 pr-3 py-1 transition-all"
                  title={`${provider.provider_name}（TMDb watch ページに遷移）`}
                >
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
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-gray-600 text-[10px] mt-3">
        配信状況の出典: JustWatch / TMDb
      </p>
    </section>
  );
}
