import Link from "next/link";
import type { CharacterSearchResult } from "@/types/anilist";

interface CharacterSearchCardProps {
  character: CharacterSearchResult;
}

/** キャラの検索結果カード（`/search/characters`） */
export default function CharacterSearchCard({
  character,
}: CharacterSearchCardProps) {
  const { work, voiceActor, characterImageUrl } = character;

  // キャラ画像を優先。AniList の default 画像は lib 側で除外済みのため null になる場合は作品ポスターで代替
  const cardImage = characterImageUrl ?? work?.posterUrl;

  return (
    <Link href={`/characters/${character.id}`} className="group block">
      <div className="relative aspect-[2/3] bg-gray-900 rounded overflow-hidden">
        {cardImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cardImage}
            alt={character.name}
            className="w-full h-full object-cover object-top transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
            No Image
          </div>
        )}
      </div>

      <div className="mt-2 px-0.5">
        <p className="text-white text-sm font-bold leading-tight line-clamp-2">
          {character.name}
        </p>
        {work && (
          <p className="text-gray-500 text-[11px] mt-1 line-clamp-1">
            {work.title}
            {work.seasonYear ? ` (${work.seasonYear})` : ""}
          </p>
        )}
        {voiceActor && (
          <p className="text-gray-400 text-[11px] mt-0.5 line-clamp-1">
            CV: {voiceActor.name}
          </p>
        )}
      </div>
    </Link>
  );
}
