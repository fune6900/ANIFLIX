import HeroSection from "@/components/HeroSection";
import type { HeroItem } from "@/components/HeroSection";
import ContentRow from "@/components/ContentRow";
import type { ContentRowItem } from "@/components/ContentRow";
import { getAnimeVideos } from "@/lib/tmdb";
import {
  characterCollectionHref,
  loadCharacterHome,
  type CharacterHeroItem,
} from "@/lib/character-home";
import type { CharacterCard } from "@/types/character-home";

/** キャラカード → 横スクロールの縦長カード（名前は画像の中に出る） */
function toRowItem(card: CharacterCard): ContentRowItem {
  return {
    id: card.id,
    title: card.name,
    year: card.note,
    rating: "キャラ",
    gradient: "linear-gradient(135deg, #2a1a2e 0%, #553b24 100%)",
    posterPath: null,
    backdropPath: null,
    imageUrl: card.imageUrl,
    isPortrait: true,
    href: card.href,
  };
}

/** Hero のあらすじの頭に主要キャラを添える */
function heroOverview(item: CharacterHeroItem): string {
  if (item.mainCharacters.length === 0) return item.anime.overview;
  return `🧑‍🤝‍🧑 主要キャラ: ${item.mainCharacters.join("、")}　${item.anime.overview}`;
}

/**
 * キャラクターページは毎リクエストでレンダリングする（声優ページと同じ理由）。
 * 個々の fetch はキャッシュするが、静的プリレンダに倒れると誕生日の行が
 * ビルドした日のまま凍結する
 */
export const dynamic = "force-dynamic";

/**
 * キャラクターページ。トップ画面・声優ページと同じ Hero + 特集の行（#104）。
 * 検索はヘッダーに一本化した（#101）。キャラの検索結果は `/search/characters`
 */
export default async function CharactersPage() {
  const home = await loadCharacterHome();

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
            allHref={characterCollectionHref(row.slug)}
          />
        ))}
        {rows.length === 0 && (
          <p className="site-container text-gray-400 text-sm">
            キャラクターの情報を取得できませんでした。時間をおいて再度お試しください。
          </p>
        )}
      </div>
    </div>
  );
}
