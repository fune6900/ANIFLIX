import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPersonDetail, getImageUrl } from "@/lib/tmdb";
import VoicedCharacters from "@/components/VoicedCharacters";
import type { TMDbPersonCreditCast } from "@/types/tmdb";

const PER_PAGE = 30;

interface VoiceActorDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string | string[];
    cpage?: string | string[];
  }>;
}

// アニメ出演作カード
function AnimeWorkCard({ credit }: { credit: TMDbPersonCreditCast }) {
  const title = credit.name ?? credit.title ?? "不明";
  const year = (credit.first_air_date ?? credit.release_date ?? "").split(
    "-",
  )[0];
  const href = credit.media_type === "tv" ? `/anime/${credit.id}` : `#`;

  return (
    <Link
      href={href}
      className={`group block ${credit.media_type !== "tv" ? "pointer-events-none" : ""}`}
    >
      <div className="relative aspect-[2/3] rounded-sm overflow-hidden bg-gray-900">
        {credit.poster_path ? (
          <Image
            src={getImageUrl(credit.poster_path, "w342")}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-white text-xs font-bold text-center leading-tight">
              {title}
            </span>
          </div>
        )}

        {/* 下グラデーション */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 to-transparent" />

        {/* スコア */}
        {credit.vote_average > 0 && (
          <div className="absolute top-1.5 right-1.5 bg-black/70 rounded px-1 py-0.5">
            <span className="text-green-400 text-[10px] font-bold">
              ★ {credit.vote_average.toFixed(1)}
            </span>
          </div>
        )}

        {/* タイトル・役名 */}
        <div className="absolute bottom-0 left-0 right-0 p-2 xl:p-2.5">
          <p className="text-white text-[11px] xl:text-sm font-semibold truncate">
            {title}
          </p>
          {credit.character && (
            <p className="text-gray-400 text-[10px] xl:text-xs truncate">
              {credit.character}
            </p>
          )}
          {year && (
            <p className="text-gray-500 text-[10px] xl:text-xs">{year}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

function WorksPagination({
  personId,
  currentPage,
  totalPages,
}: {
  personId: number;
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const pageUrl = (p: number) => `/voice-actors/${personId}?page=${p}`;

  const range = 2;
  const pages: number[] = [];
  for (
    let i = Math.max(1, currentPage - range);
    i <= Math.min(totalPages, currentPage + range);
    i++
  ) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-8 flex-wrap">
      {currentPage > 1 && (
        <Link
          href={pageUrl(currentPage - 1)}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
        >
          ← 前へ
        </Link>
      )}
      {pages[0] > 1 && (
        <>
          <Link
            href={pageUrl(1)}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
          >
            1
          </Link>
          {pages[0] > 2 && <span className="text-gray-500 px-1">…</span>}
        </>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={pageUrl(p)}
          className={`px-3 py-2 rounded text-sm transition ${
            p === currentPage
              ? "bg-[#E50914] text-white font-bold"
              : "bg-gray-800 hover:bg-gray-700 text-white"
          }`}
        >
          {p}
        </Link>
      ))}
      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span className="text-gray-500 px-1">…</span>
          )}
          <Link
            href={pageUrl(totalPages)}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
          >
            {totalPages}
          </Link>
        </>
      )}
      {currentPage < totalPages && (
        <Link
          href={pageUrl(currentPage + 1)}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition"
        >
          次へ →
        </Link>
      )}
    </div>
  );
}

export default async function VoiceActorDetailPage({
  params,
  searchParams,
}: VoiceActorDetailPageProps) {
  const { id } = await params;
  const { page, cpage } = await searchParams;
  const pageStr = Array.isArray(page) ? page[0] : page;
  const cpageStr = Array.isArray(cpage) ? cpage[0] : cpage;
  const numId = parseInt(id, 10);
  const requestedPage = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const charactersPage = Math.max(1, parseInt(cpageStr ?? "1", 10) || 1);

  if (isNaN(numId)) notFound();

  let person;
  try {
    person = await getPersonDetail(numId);
  } catch {
    notFound();
  }

  // アニメ出演作を抽出（ジャンル16 or tv）
  const allCredits = person.combined_credits?.cast ?? [];
  const animeWorks = allCredits
    .filter((c) => c.media_type === "tv")
    .sort((a, b) => b.vote_average - a.vote_average);

  const totalWorks = animeWorks.length;
  // URL で巨大なページ番号が来ても空グリッドにならないよう totalPages で上限クランプ
  const totalPages = Math.max(1, Math.ceil(totalWorks / PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pagedWorks = animeWorks.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE,
  );

  const age = person.birthday
    ? Math.floor(
        (Date.now() - new Date(person.birthday).getTime()) /
          (1000 * 60 * 60 * 24 * 365.25),
      )
    : null;

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* コンテンツ（背景写真は置かない。固定ヘッダーの下から始める） */}
      <div className="pt-24 pb-20">
        <div className="site-container">
          <div className="detail-block flex flex-col md:flex-row gap-6 md:gap-10 xl:gap-12">
            {/* プロフィール写真 */}
            <div className="flex-shrink-0 w-36 md:w-48 lg:w-60 xl:w-72 3xl:w-80 mx-auto md:mx-0">
              <div className="relative aspect-[2/3] rounded-md overflow-hidden shadow-2xl border border-gray-700/50">
                {person.profile_path ? (
                  <Image
                    src={getImageUrl(person.profile_path, "w500")}
                    alt={person.name}
                    fill
                    priority
                    sizes="(max-width: 767px) 144px, (max-width: 1023px) 192px, (max-width: 1279px) 240px, (max-width: 1919px) 288px, 320px"
                    className="object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center p-4">
                    <svg
                      className="w-16 h-16 text-gray-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* 情報パネル */}
            <div className="flex-1 min-w-0">
              {/* 名前 */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black mb-1 leading-tight">
                {person.name}
              </h1>
              {person.original_name && person.original_name !== person.name && (
                <p className="text-gray-400 text-base xl:text-lg mb-3">
                  {person.original_name}
                </p>
              )}

              {/* バッジ */}
              <div className="flex flex-wrap items-center gap-2 xl:gap-3 mb-5">
                <span className="border border-[#54b9c5] text-[#54b9c5] text-xs xl:text-sm px-2 xl:px-3 py-0.5 xl:py-1 rounded">
                  🎤 声優 / 俳優
                </span>
                <span className="text-gray-400 text-sm xl:text-base flex items-center gap-1">
                  ★ 人気 {person.popularity.toFixed(1)}
                </span>
                {person.birthday && (
                  <span className="text-gray-400 text-sm xl:text-base">
                    生年月日: {person.birthday}
                    {age !== null && `（${age}歳）`}
                  </span>
                )}
                {person.place_of_birth && (
                  <span className="text-gray-400 text-sm xl:text-base">
                    出身: {person.place_of_birth}
                  </span>
                )}
              </div>

              {/* 別名 */}
              {person.also_known_as && person.also_known_as.length > 0 && (
                <div className="mb-4">
                  <p className="text-gray-500 text-xs xl:text-sm">
                    別名:{" "}
                    <span className="text-gray-300">
                      {person.also_known_as.slice(0, 4).join(" / ")}
                    </span>
                  </p>
                </div>
              )}

              {/* プロフィール */}
              {person.biography && (
                <div className="mb-6">
                  <h2 className="text-white font-semibold text-base xl:text-lg mb-2">
                    プロフィール
                  </h2>
                  <p className="text-gray-300 text-sm lg:text-base 3xl:text-lg leading-relaxed max-w-3xl xl:max-w-4xl 3xl:max-w-5xl line-clamp-6">
                    {person.biography}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 出演作品 */}
          {totalWorks > 0 && (
            <section className="mt-10">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-white font-bold text-lg xl:text-xl 3xl:text-2xl">
                  出演作品
                </h2>
                <span className="text-gray-500 text-sm xl:text-base">
                  {totalWorks}件
                </span>
                {totalPages > 1 && (
                  <span className="text-gray-500 text-sm">
                    · {currentPage} / {totalPages} ページ
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 3xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2 md:gap-3">
                {pagedWorks.map((credit) => (
                  <AnimeWorkCard
                    key={`${credit.id}-${credit.character}`}
                    credit={credit}
                  />
                ))}
              </div>
              <WorksPagination
                personId={numId}
                currentPage={currentPage}
                totalPages={totalPages}
              />
            </section>
          )}

          {/* 演じたキャラクター（AniList 経由・クリックで /characters/[id] へ） */}
          {currentPage === 1 && (
            <VoicedCharacters
              name={person.name}
              originalName={person.original_name}
              alsoKnownAs={person.also_known_as}
              currentPage={charactersPage}
              pageUrl={(p) =>
                `/voice-actors/${numId}?cpage=${p}#voiced-characters`
              }
            />
          )}

          {/* 戻るボタン */}
          <div className="mt-12 flex items-center gap-4">
            <Link
              href="/voice-actors"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              声優一覧に戻る
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
