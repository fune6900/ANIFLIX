import Image from "next/image";
import Link from "next/link";
import type { VoiceActorCard } from "@/types/voice-actor-home";

interface VoiceActorGridCardProps {
  card: VoiceActorCard;
}

/**
 * 声優の一覧グリッドの 1 枚（`/voice-actors/collections/[slug]`）。
 * 名前と一言（役名など）は写真の中に常に出す（ホバーの無いタッチ端末でも誰か分かる）
 */
export default function VoiceActorGridCard({ card }: VoiceActorGridCardProps) {
  return (
    <Link href={card.href} className="group block">
      <div className="relative aspect-[2/3] rounded-sm overflow-hidden bg-gray-900">
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw"
            className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-800 to-gray-900">
            <svg
              className="w-16 h-16 text-gray-600"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-white text-xs md:text-sm font-semibold truncate leading-tight">
            {card.name}
          </p>
          {card.note && (
            <p className="text-gray-400 text-[11px] mt-0.5 truncate">
              {card.note}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
