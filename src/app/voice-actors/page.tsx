import Image from "next/image";
import Link from "next/link";
import { searchPerson, isJapaneseVoiceActor, getImageUrl } from "@/lib/tmdb";
import { fetchSeasonalAnime } from "@/lib/seasonal-anime";
import { getRecentSeasons } from "@/lib/seasons";
import {
  aggregateSeasonalCast,
  type AggregatedCast,
} from "@/lib/seasonal-cast";
import type { TMDbPerson } from "@/types/tmdb";

function sanitize(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`]/g, "")
    .trim()
    .slice(0, 100);
}

const SORT_OPTIONS = [
  { value: "popularity", label: "人気順" },
  { value: "name_asc", label: "名前順（あ→z）" },
  { value: "name_desc", label: "名前順（z→あ）" },
];

const DEPT_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "Acting", label: "俳優・声優" },
  { value: "Production", label: "プロデュース" },
  { value: "Directing", label: "監督" },
  { value: "Writing", label: "脚本・執筆" },
];

interface VoiceActorsPageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: string;
    dept?: string;
  }>;
}

function CastGridCard({ cast }: { cast: AggregatedCast }) {
  return (
    <Link href={`/voice-actors/${cast.id}`} className="group block">
      <div className="relative aspect-[2/3] rounded-sm overflow-hidden bg-gray-900">
        {cast.profilePath ? (
          <Image
            src={getImageUrl(cast.profilePath, "w342")}
            alt={cast.name}
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
            >
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 to-transparent" />
        <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5">
          <span className="text-[#54b9c5] text-xs font-bold">
            {cast.appearances}本
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-white text-xs font-semibold truncate leading-tight">
            {cast.name}
          </p>
          {cast.topCharacter && (
            <p className="text-gray-400 text-[11px] mt-0.5 truncate">
              役: {cast.topCharacter}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function PersonGridCard({ person }: { person: TMDbPerson }) {
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

function Pagination({
  query,
  sort,
  dept,
  currentPage,
  totalPages,
}: {
  query: string;
  sort: string;
  dept: string;
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  function pageUrl(p: number) {
    const params = new URLSearchParams({ q: query, page: String(p) });
    if (sort !== "popularity") params.set("sort", sort);
    if (dept) params.set("dept", dept);
    return `/voice-actors?${params.toString()}`;
  }

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
    <div className="flex items-center justify-center gap-1 mt-10 flex-wrap">
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

export default async function VoiceActorsPage({
  searchParams,
}: VoiceActorsPageProps) {
  const params = await searchParams;
  const rawQuery = params.q ?? "";
  const query = sanitize(rawQuery);
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const sort = params.sort ?? "popularity";
  const dept = params.dept ?? "";

  let results: TMDbPerson[] = [];
  let defaultCastResults: AggregatedCast[] = [];
  let totalResults = 0;
  let totalPages = 0;
  let error: string | null = null;
  let isDefaultView = false;

  if (query) {
    try {
      const data = await searchPerson(query, currentPage);
      // 日本の声優・俳優のみに限定（洋画俳優・海外人物を除外）
      let persons = data.results.filter(isJapaneseVoiceActor);

      // 部門フィルター（クライアントサイド）
      if (dept) {
        persons = persons.filter((p) => p.known_for_department === dept);
      }

      // ソート（クライアントサイド）
      if (sort === "name_asc") {
        persons = [...persons].sort((a, b) =>
          a.name.localeCompare(b.name, "ja"),
        );
      } else if (sort === "name_desc") {
        persons = [...persons].sort((a, b) =>
          b.name.localeCompare(a.name, "ja"),
        );
      }
      // popularity (default) はTMDb側でソート済み

      results = persons;
      // 件数表示はフィルタ後の現ページ件数を反映
      totalResults = persons.length;
      totalPages = Math.min(data.total_pages, 500);
    } catch {
      error = "検索中にエラーが発生しました";
    }
  } else {
    // クエリなし: 「今期人気アニメに出演している声優」を集約して表示する。
    // /person/popular はワールドワイドで Hollywood 俳優ばかり拾ってしまうため
    // (日本の声優は 100 位までに 0 名級) 信頼できない。
    // 今期トップ 30 作品のキャスト (order < 15) を出演本数順に並べる。
    isDefaultView = true;
    try {
      const currentSeason = getRecentSeasons(1)[0];
      const seasonResult = await fetchSeasonalAnime(
        currentSeason.year,
        currentSeason.season,
        { limit: 30 },
      );
      defaultCastResults = await aggregateSeasonalCast(
        seasonResult.items.slice(0, 30).map((a) => a.id),
      );
      totalResults = defaultCastResults.length;
    } catch {
      // デフォルト表示に失敗してもエラーは出さない
    }
  }

  const hasFilters = sort !== "popularity" || !!dept;

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-24">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-white text-2xl font-bold">声優を検索</h1>
          {isDefaultView && defaultCastResults.length > 0 && (
            <p className="text-gray-400 text-sm mt-1">
              🇯🇵 今期アニメに出演中の声優 ({defaultCastResults.length}名)
            </p>
          )}
          {query && totalResults > 0 && (
            <p className="text-gray-400 text-sm mt-1">
              「{query}」: {totalResults.toLocaleString()}件
              {totalPages > 1 && ` · ${currentPage} / ${totalPages} ページ`}
            </p>
          )}
          {query && results.length === 0 && !error && (
            <p className="text-gray-400 text-sm mt-1">
              「{query}」に該当する声優が見つかりませんでした
            </p>
          )}
        </div>

        {/* エラー */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded mb-8">
            {error}
          </div>
        )}

        {/* 検索フォーム */}
        <form method="GET" className="mb-6 max-w-2xl">
          <div className="flex items-center border border-gray-600 bg-[#1a1a1a] rounded overflow-hidden focus-within:border-white transition-colors mb-4">
            <svg
              className="w-5 h-5 text-gray-400 ml-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="声優・俳優名で検索（例: 花江夏樹、悠木碧）"
              maxLength={100}
              autoComplete="off"
              className="flex-1 bg-transparent text-white px-4 py-3 text-sm outline-none placeholder-gray-500"
            />
            <button
              type="submit"
              className="bg-[#E50914] text-white px-5 py-3 text-sm font-semibold hover:bg-red-700 transition"
            >
              検索
            </button>
          </div>

          {/* 絞り込み・ソートバー（デフォルト表示は集約キャストの固定順なので隠す） */}
          {!isDefaultView && (
            <>
              <div className="flex flex-wrap gap-3 items-center bg-[#1a1a1a] border border-gray-700 rounded px-4 py-3">
                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider shrink-0">
                  絞り込み:
                </span>

                <div className="flex items-center gap-2">
                  <label className="text-gray-400 text-xs">部門</label>
                  <select
                    name="dept"
                    defaultValue={dept}
                    className="bg-[#2a2a2a] border border-gray-600 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-gray-400 transition"
                  >
                    {DEPT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-gray-400 text-xs">並び順</label>
                  <select
                    name="sort"
                    defaultValue={sort}
                    className="bg-[#2a2a2a] border border-gray-600 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-gray-400 transition"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded transition"
                >
                  適用
                </button>

                {hasFilters && (
                  <Link
                    href={`/voice-actors${query ? `?q=${encodeURIComponent(query)}` : ""}`}
                    className="text-xs text-gray-500 hover:text-gray-300 transition"
                  >
                    リセット
                  </Link>
                )}
              </div>

              {/* アクティブフィルターバッジ */}
              {hasFilters && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {dept && (
                    <span className="bg-[#54b9c5]/20 text-[#54b9c5] text-xs px-2.5 py-1 rounded-full border border-[#54b9c5]/30">
                      {DEPT_OPTIONS.find((o) => o.value === dept)?.label}
                    </span>
                  )}
                  {sort !== "popularity" && (
                    <span className="bg-[#54b9c5]/20 text-[#54b9c5] text-xs px-2.5 py-1 rounded-full border border-[#54b9c5]/30">
                      {SORT_OPTIONS.find((o) => o.value === sort)?.label}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </form>

        {/* 結果グリッド */}
        {isDefaultView
          ? defaultCastResults.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-9 gap-3 md:gap-4 xl:gap-5">
                {defaultCastResults.map((cast) => (
                  <CastGridCard key={cast.id} cast={cast} />
                ))}
              </div>
            )
          : results.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 3xl:grid-cols-9 gap-3 md:gap-4 xl:gap-5">
                {results.map((person) => (
                  <PersonGridCard key={person.id} person={person} />
                ))}
              </div>
            )}

        {/* ページネーション（検索時のみ） */}
        {query && totalPages > 1 && (
          <Pagination
            query={query}
            sort={sort}
            dept={dept}
            currentPage={currentPage}
            totalPages={totalPages}
          />
        )}
      </div>
    </div>
  );
}
