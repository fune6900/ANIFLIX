import Link from "next/link";
import { searchAniListCharacters } from "@/lib/anilist";
import { searchAnnictCharacterByName } from "@/lib/annict";
import type { CharacterSearchResult } from "@/types/anilist";
import SearchPageInput from "@/components/SearchPageInput";

function sanitize(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`]/g, "")
    .trim()
    .slice(0, 100);
}

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function CharacterSearchPage({ searchParams }: PageProps) {
  const { q: rawQuery = "" } = await searchParams;
  const query = sanitize(rawQuery);

  let results: CharacterSearchResult[] = [];
  let error: string | null = null;

  if (query) {
    try {
      results = await searchAniListCharacters(query);
      // 各ヒットキャラの Annict プロフィールを並列で先取り（Next.js fetch cache に投入）
      // 詳細ページ初回アクセス時の待ち時間を短縮する。失敗は無視
      await Promise.allSettled(
        results.map((r) => searchAnnictCharacterByName(r.name)),
      );
    } catch (e) {
      console.error("[/search/characters]", e);
      error = "検索中にエラーが発生しました";
    }
  }

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-24">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="mb-8">
          <h1 className="text-white text-2xl font-bold mb-1">
            キャラクターを検索
          </h1>
          {results.length > 0 && (
            <p className="text-gray-400 text-sm">
              {results.length.toLocaleString()}件
            </p>
          )}
        </div>

        <SearchPageInput
          mode="character"
          defaultValue={query}
          formAction="/search/characters"
        />

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded mb-8">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 xl:gap-5">
            {results.map((char) => (
              <CharacterCard key={char.id} character={char} />
            ))}
          </div>
        )}

        {query && results.length === 0 && !error && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-2">
              該当キャラクターは見つかりませんでした
            </p>
            <p className="text-gray-600 text-sm">
              別のキャラクター名で試してみてください
            </p>
          </div>
        )}

        {!query && !error && (
          <div className="text-center py-20">
            <svg
              className="w-16 h-16 text-gray-700 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-gray-400 mb-2">
              キャラクター名を入力してください
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CharacterCard({ character }: { character: CharacterSearchResult }) {
  const { work, voiceActor, characterImageUrl } = character;
  const detailHref = `/characters/${character.id}`;

  // キャラ画像を優先。AniList の default 画像は lib 側で除外済みのため null になる場合は作品ポスターで代替
  const cardImage = characterImageUrl ?? work?.posterUrl;

  return (
    <Link href={detailHref} className="group block">
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
