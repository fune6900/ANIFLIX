import { redirect } from "next/navigation";
import HeroSection from "@/components/HeroSection";
import type { HeroItem } from "@/components/HeroSection";
import ContentRow from "@/components/ContentRow";
import type { ContentRowItem } from "@/components/ContentRow";
import { getAnimeVideos } from "@/lib/tmdb";
import {
  loadVoiceActorHome,
  voiceActorCollectionHref,
  type VoiceActorHeroItem,
} from "@/lib/voice-actor-home";
import { sanitizeSearchQuery, searchResultsHref } from "@/lib/search-results";
import type { VoiceActorCard } from "@/types/voice-actor-home";

interface VoiceActorsPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

/** 声優カード → 横スクロールの縦長カード（名前は写真の中に出る） */
function toRowItem(card: VoiceActorCard): ContentRowItem {
  return {
    id: card.id,
    title: card.name,
    year: card.note,
    rating: "CV",
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #243b55 100%)",
    posterPath: null,
    backdropPath: null,
    imageUrl: card.imageUrl,
    isPortrait: true,
    href: card.href,
  };
}

/** Hero のあらすじの頭に主演声優を添える */
function heroOverview(item: VoiceActorHeroItem): string {
  if (item.leadVoiceActors.length === 0) return item.anime.overview;
  return `🎤 出演: ${item.leadVoiceActors.join("・")}　${item.anime.overview}`;
}

/**
 * 声優ページは毎リクエストでレンダリングする（トップ画面と同じ理由）。
 * 個々の fetch はキャッシュするが、静的プリレンダに倒れると誕生日の行が
 * ビルドした日のまま凍結する
 */
export const dynamic = "force-dynamic";

/**
 * 声優ページ。トップ画面・アニメ映画画面と同じ Hero + 特集の行（#102）。
 * 検索はヘッダーに一本化した（#101）。旧 `?q=` は声優の検索結果へ送る
 */
export default async function VoiceActorsPage({
  searchParams,
}: VoiceActorsPageProps) {
  const query = sanitizeSearchQuery((await searchParams).q);
  if (query) redirect(searchResultsHref("voice-actors", query));

  const home = await loadVoiceActorHome();

  const trailerKeys = await Promise.all(
    home.hero.map(({ anime }) =>
      getAnimeVideos(anime.id)
        .then((vids) => vids[0]?.key ?? null)
        .catch(() => null),
    ),
  );

  const heroItems: HeroItem[] = home.hero.map((item, i) => ({
    id: item.anime.id,
    title: item.anime.name,
    overview: heroOverview(item),
    backdropPath: item.anime.backdrop_path,
    year: item.anime.first_air_date?.split("-")[0] || undefined,
    match:
      item.anime.vote_average > 0
        ? Math.round(item.anime.vote_average * 10)
        : undefined,
    href: `/anime/${item.anime.id}`,
    trailerKey: trailerKeys[i] ?? undefined,
  }));

  // 取得に失敗した行（空）は出さない
  const rows = home.rows.filter((row) => row.cards.length > 0);

  return (
    <div className="bg-[#141414] min-h-screen">
      <HeroSection items={heroItems} />
      <div
        className={`relative z-10 pb-20 ${heroItems.length > 0 ? "-mt-16 md:-mt-24" : "pt-24"}`}
      >
        {rows.map((row) => (
          <ContentRow
            key={row.slug}
            title={row.title}
            items={row.cards.map(toRowItem)}
            allHref={voiceActorCollectionHref(row.slug)}
          />
        ))}
        {rows.length === 0 && (
          <p className="site-container text-gray-400 text-sm">
            声優の情報を取得できませんでした。時間をおいて再度お試しください。
          </p>
        )}
      </div>
    </div>
  );
}
