import Link from "next/link";
import { notFound } from "next/navigation";
import VoiceActorGridCard from "@/components/VoiceActorGridCard";
import { loadVoiceActorCollection } from "@/lib/voice-actor-home";

interface VoiceActorCollectionPageProps {
  params: Promise<{ slug: string }>;
}

/** 誕生日・今期の行は日によって変わるので、静的プリレンダに倒さない */
export const dynamic = "force-dynamic";

/**
 * 声優ページの行の「すべて見る」（#102）。行と同じ全件をグリッドで出す。
 * slug は `src/lib/voice-actor-home.ts` のホワイトリストで照合し、無ければ 404
 */
export default async function VoiceActorCollectionPage({
  params,
}: VoiceActorCollectionPageProps) {
  const { slug } = await params;
  const row = await loadVoiceActorCollection(slug);
  if (!row) notFound();

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-24">
      <div className="site-container">
        <div className="mb-8">
          <Link
            href="/voice-actors"
            className="text-[#54b9c5] text-xs md:text-sm font-semibold hover:text-white transition"
          >
            ← 声優
          </Link>
          <h1 className="text-white text-2xl font-bold mt-2">{row.title}</h1>
          {row.cards.length > 0 && (
            <p className="text-gray-400 text-sm mt-1">{row.cards.length}名</p>
          )}
        </div>

        {row.cards.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 md:gap-4 xl:gap-5">
            {row.cards.map((card) => (
              <VoiceActorGridCard key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">
            声優が見つかりませんでした。時間をおいて再度お試しください。
          </p>
        )}
      </div>
    </div>
  );
}
