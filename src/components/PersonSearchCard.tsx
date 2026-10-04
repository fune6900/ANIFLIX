import Image from "next/image";
import Link from "next/link";
import { getImageUrl } from "@/lib/tmdb";
import type { TMDbPerson } from "@/types/tmdb";

interface PersonSearchCardProps {
  person: TMDbPerson;
}

/** 声優の検索結果カード（`/search/voice-actors`）。旧 `/voice-actors?q=` の見た目を引き継ぐ */
export default function PersonSearchCard({ person }: PersonSearchCardProps) {
  const knownForTitles = person.known_for
    ?.map((k) => k.name ?? k.title)
    .filter(Boolean)
    .slice(0, 2)
    .join(" / ");

  return (
    <Link href={`/voice-actors/${person.id}`} className="group block">
      <div className="relative aspect-[2/3] rounded-sm overflow-hidden bg-gray-900">
        {person.profile_path ? (
          <Image
            src={getImageUrl(person.profile_path, "w342")}
            alt={person.name}
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
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 to-transparent" />
        <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5">
          <span className="text-[#54b9c5] text-xs font-bold">
            ★ {person.popularity.toFixed(1)}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-white text-xs font-semibold truncate leading-tight">
            {person.name}
          </p>
          {knownForTitles && (
            <p className="text-gray-400 text-[11px] mt-0.5 truncate">
              {knownForTitles}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
