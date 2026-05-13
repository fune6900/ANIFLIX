import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAnimeBySeason, searchAnime } from "@/lib/tmdb";
import {
  findSeason,
  getRecentSeasons,
  isValidSeason,
  SEASON_COLORS,
  type SeasonSlug,
} from "@/lib/seasons";
import {
  getAniListSeasonAnime,
  pickAniListTitle,
  toAniListSeason,
  type AniListMedia,
} from "@/lib/anilist";
import type { TMDbAnime } from "@/types/tmdb";

interface SeasonPageProps {
  params: Promise<{ year: string; season: string }>;
}

interface MergedSeasonItem {
  key: string;
  title: string;
  year?: string;
  score: number;
  posterPath: string | null;
  backdropPath: string | null;
  externalCoverUrl: string | null;
  externalBannerUrl: string | null;
  href: string;
  /** TMDb 側で確実に検出できたか（false の場合は AniList 一次情報のみ）*/
  matchedInTmdb: boolean;
  format: string | null;
  anilistUrl?: string;
}

function normalizeTitleForMatch(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s　:：!！?？・,、。.「」『』()（）\-]/g, "")
    .normalize("NFKC");
}

/** AniList の作品を、TMDb の同シーズン作品リストとマッチさせて detail href を解決する */
async function resolveTmdbId(
  media: AniListMedia,
  tmdbPool: TMDbAnime[],
): Promise<TMDbAnime | null> {
  const candidates = [
    media.title.native,
    media.title.romaji,
    media.title.english,
    ...(media.synonyms ?? []),
  ].filter((s): s is string => !!s);

  const normalizedCandidates = candidates.map(normalizeTitleForMatch);

  // 1. シーズンの TMDb プールと突き合わせ（ローカル一致）
  const direct = tmdbPool.find((a) => {
    const tmdbNames = [a.name, a.original_name].filter((s): s is string => !!s);
    return tmdbNames.some((n) =>
      normalizedCandidates.includes(normalizeTitleForMatch(n)),
    );
  });
  if (direct) return direct;

  // 2. TMDb の名前検索でフォールバック
  //    誤マッチを避けるため、検索結果も normalizedCandidates と突き合わせて検証する
  const primary =
    media.title.native ?? media.title.romaji ?? media.title.english;
  if (!primary) return null;
  try {
    const sr = await searchAnime(primary);
    const verified = sr.results.find((r) => {
      const names = [r.name, r.original_name].filter((s): s is string => !!s);
      return names.some((n) =>
        normalizedCandidates.includes(normalizeTitleForMatch(n)),
      );
    });
    return verified ?? null;
  } catch {
    return null;
  }
}

/** 上限を設けた並列実行 mapper。レートリミット対策で同時実行数を抑える */
async function pMapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i]);
    }
  }
  const concurrent = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: concurrent }, () => run()));
  return results;
}

export default async function SeasonPage({ params }: SeasonPageProps) {
  const { year: yearStr, season: seasonStr } = await params;

  const year = parseInt(yearStr, 10);
  if (isNaN(year) || year < 1960 || year > 2030) notFound();
  if (!isValidSeason(seasonStr)) notFound();

  const seasonSlug = seasonStr as SeasonSlug;
  const currentSeason = findSeason(year, seasonSlug);

  // AniList（一次ソース） / TMDb（補完・遷移先）を並列取得
  const [anilist, tmdbPage1, tmdbPage2] = await Promise.all([
    getAniListSeasonAnime(year, toAniListSeason(seasonSlug), 1, 40).catch(
      () => null,
    ),
    getAnimeBySeason(currentSeason.dateFrom, currentSeason.dateTo, 1).catch(
      () => null,
    ),
    getAnimeBySeason(currentSeason.dateFrom, currentSeason.dateTo, 2).catch(
      () => null,
    ),
  ]);

  const tmdbPool: TMDbAnime[] = [
    ...(tmdbPage1?.results ?? []),
    ...(tmdbPage2?.results ?? []),
  ];

  let merged: MergedSeasonItem[] = [];

  if (anilist && anilist.results.length > 0) {
    // AniList を主軸に、TMDb で詳細ページに繋げる
    // TMDb プール未マッチ時は searchAnime にフォールバックするため、
    // 同時並列数を絞ってレートリミットを回避する
    const resolved = await pMapLimit(anilist.results, 4, async (m) => {
      const tmdb = await resolveTmdbId(m, tmdbPool);
      return { media: m, tmdb };
    });

    merged = resolved.map(({ media, tmdb }) => {
      const title = pickAniListTitle(media);
      const yearText = media.startDate.year ? String(media.startDate.year) : "";
      return {
        key: `al-${media.id}`,
        title,
        year: yearText,
        score: tmdb?.vote_average ?? (media.averageScore ?? 0) / 10,
        posterPath: tmdb?.poster_path ?? null,
        backdropPath: tmdb?.backdrop_path ?? null,
        externalCoverUrl: media.coverImage.extraLarge ?? media.coverImage.large,
        externalBannerUrl: media.bannerImage,
        href: tmdb ? `/anime/${tmdb.id}` : media.siteUrl,
        matchedInTmdb: !!tmdb,
        format: media.format,
        anilistUrl: media.siteUrl,
      };
    });
  } else {
    // AniList が取得できない場合は従来通り TMDb のみ
    merged = tmdbPool.map((a) => ({
      key: `tmdb-${a.id}`,
      title: a.name,
      year: a.first_air_date?.split("-")[0] ?? "",
      score: a.vote_average ?? 0,
      posterPath: a.poster_path,
      backdropPath: a.backdrop_path,
      externalCoverUrl: null,
      externalBannerUrl: null,
      href: `/anime/${a.id}`,
      matchedInTmdb: true,
      format: null,
    }));
  }

  const totalResults = merged.length;

  const recentSeasons = getRecentSeasons(8);
  const gradientClass = SEASON_COLORS[seasonSlug];

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* ヘッダー */}
      <div
        className={`relative bg-gradient-to-b ${gradientClass} pt-28 pb-10 px-4 md:px-12`}
      >
        <div className="relative z-10">
          <p className="text-gray-400 text-sm mb-1">シーズン別アニメ</p>
          <h1 className="text-4xl md:text-5xl font-black mb-2 flex items-center gap-3">
            <span>{currentSeason.emoji}</span>
            {currentSeason.label}アニメ
          </h1>
          <p className="text-gray-300 text-sm">
            {currentSeason.dateFrom} 〜 {currentSeason.dateTo}
            {totalResults > 0 && (
              <span className="ml-3 text-gray-400">
                {totalResults.toLocaleString()}件
              </span>
            )}
          </p>
          {anilist && (
            <p className="text-gray-500 text-[11px] mt-2">
              一次ソース:{" "}
              <a
                href="https://anilist.co"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-300"
              >
                AniList
              </a>
              （TMDb 補完）
            </p>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] to-transparent opacity-40" />
      </div>

      <div className="px-4 md:px-12 pb-24">
        {/* シーズンナビゲーション */}
        <div
          className="flex gap-2 overflow-x-auto py-4 mb-6"
          style={{ scrollbarWidth: "none" }}
        >
          {recentSeasons.map((s) => {
            const isCurrentSeason = s.year === year && s.season === seasonSlug;
            return (
              <Link
                key={s.href}
                href={s.href}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                  isCurrentSeason
                    ? "bg-white text-black"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <span>{s.emoji}</span>
                {s.label}
              </Link>
            );
          })}
        </div>

        {merged.length > 0 ? (
          <div className="max-w-[1920px] mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4 xl:gap-5">
            {merged.map((item) => (
              <SeasonCard key={item.key} item={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            このシーズンのアニメが見つかりませんでした
          </div>
        )}
      </div>
    </div>
  );
}

function SeasonCard({ item }: { item: MergedSeasonItem }) {
  const isExternal = !item.matchedInTmdb;
  const posterSrc = item.posterPath
    ? `https://image.tmdb.org/t/p/w342${item.posterPath}`
    : item.externalCoverUrl;
  const backdropSrc = item.backdropPath
    ? `https://image.tmdb.org/t/p/w780${item.backdropPath}`
    : (item.externalBannerUrl ?? item.externalCoverUrl);

  const CardInner = (
    <>
      {/* SP: 縦長カバー */}
      <div className="md:hidden relative aspect-[2/3] rounded-sm overflow-hidden bg-gray-900">
        {posterSrc ? (
          <Image
            src={posterSrc}
            alt={item.title}
            fill
            sizes="50vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-white text-xs text-center font-bold leading-tight">
              {item.title}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 to-transparent" />
        {item.score > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5">
            <span className="text-green-400 text-[11px] font-bold">
              ★ {item.score.toFixed(1)}
            </span>
          </div>
        )}
        {isExternal && (
          <div className="absolute top-2 left-2 bg-sky-700/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
            AniList
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-white text-xs font-semibold truncate leading-tight">
            {item.title}
          </p>
          {item.year && (
            <p className="text-gray-400 text-[11px]">{item.year}年</p>
          )}
        </div>
      </div>

      {/* PC: 横長キービジュアル */}
      <div className="hidden md:block relative aspect-video rounded-md overflow-hidden bg-gray-900">
        {backdropSrc ? (
          <Image
            src={backdropSrc}
            alt={item.title}
            fill
            sizes="(max-width: 1024px) 30vw, (max-width: 1536px) 22vw, 18vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-white text-base font-bold text-center leading-tight">
              {item.title}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300" />
        {item.score > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5">
            <span className="text-green-400 text-[11px] font-bold">
              ★ {item.score.toFixed(1)}
            </span>
          </div>
        )}
        {isExternal && (
          <div className="absolute top-2 left-2 bg-sky-700/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            AniList
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="text-white text-sm font-bold truncate drop-shadow-md">
            {item.title}
          </p>
          {item.year && (
            <p className="text-gray-300 text-[11px]">{item.year}年</p>
          )}
        </div>
      </div>
    </>
  );

  if (isExternal) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
        title={`${item.title}（AniList で詳細を見る）`}
      >
        {CardInner}
      </a>
    );
  }

  return (
    <Link href={item.href} className="group block">
      {CardInner}
    </Link>
  );
}
