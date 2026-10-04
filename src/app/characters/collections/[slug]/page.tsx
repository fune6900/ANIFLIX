import Link from "next/link";
import { notFound } from "next/navigation";
import PortraitGridCard from "@/components/PortraitGridCard";
import { loadCharacterCollection } from "@/lib/character-home";

interface CharacterCollectionPageProps {
  params: Promise<{ slug: string }>;
}

/** 誕生日・今期の行は日によって変わるので、静的プリレンダに倒さない */
export const dynamic = "force-dynamic";

/**
 * キャラクターページの行の「すべて見る」（#104）。行と同じ全件をグリッドで出す。
 * slug は `src/lib/character-home.ts` のホワイトリストで照合し、無ければ 404
 */
export default async function CharacterCollectionPage({
  params,
}: CharacterCollectionPageProps) {
  const { slug } = await params;
  const row = await loadCharacterCollection(slug);
  if (!row) notFound();

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-24">
      <div className="site-container">
        <div className="mb-8">
          <Link
            href="/characters"
            className="text-[#54b9c5] text-xs md:text-sm font-semibold hover:text-white transition"
          >
            ← キャラクター
          </Link>
          <h1 className="text-white text-2xl font-bold mt-2">{row.title}</h1>
          {row.cards.length > 0 && (
            <p className="text-gray-400 text-sm mt-1">{row.cards.length}人</p>
          )}
        </div>

        {row.cards.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 3xl:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3 md:gap-4 xl:gap-5">
            {row.cards.map((card) => (
              <PortraitGridCard key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">
            キャラクターが見つかりませんでした。時間をおいて再度お試しください。
          </p>
        )}
      </div>
    </div>
  );
}
