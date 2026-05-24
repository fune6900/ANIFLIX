// 作品（TMDb のアニメ TV / 映画）の関連キャラを AniList 経由で表示する Server Component。
//
// 経緯:
//   TMDb 自体は「キャラ」エンティティを持たない（credits.cast の character は文字列のみ）。
//   AniList はキャラエンティティとそれに紐付く声優・出演作を持つので、
//   TMDb の作品名を AniList で検索 → 最も popularity の高いメディアを採用 → そのキャラ一覧を取得する。
//
// ヒットしなければ null を返して非表示にする（部分的に欠落しても他の詳細ページ要素は出す）。

import Link from "next/link";
import { getAniListMediaCharacters, searchAniListMedia } from "@/lib/anilist";
import { stripSeasonSuffix } from "@/lib/title-strip";
import Pagination from "@/components/Pagination";
import type {
  AniListMediaType,
  AniListRelatedCharacterEdge,
} from "@/types/anilist";

interface RelatedCharactersProps {
  /** TMDb 側の表示タイトル（日本語） */
  title: string;
  /** TMDb 側の原題（英語 / ローマ字フォールバック）— 任意 */
  originalTitle?: string | null;
  /** TV か映画か */
  mediaType: AniListMediaType;
  /** 現在のページ番号（1 始まり） */
  currentPage?: number;
  /** 1ページあたり件数 */
  perPage?: number;
  /** ページ番号 → URL を組み立てる関数（呼び出し側でアンカー・既存クエリを管理） */
  pageUrl: (page: number) => string;
  /** ページネーション位置からスクロール対象にするためのアンカー id */
  sectionId?: string;
}

/** TMDb の表示名にだけ付く修飾語（AniList 側にはない）を剥がす */
function stripMediaPrefix(title: string): string {
  return title
    .replace(/^(劇場版|劇場アニメ|映画|アニメ映画)[\s　:：]*/, "")
    .replace(/^(THE\s+MOVIE|MOVIE)[\s　:：]+/i, "")
    .trim();
}

/**
 * AniList の native / romaji / english タイトルから「メディア ID」を解決する。
 *
 * 同じシリーズの複数期が AniList に登録されているケース（例: 「進撃の巨人」「進撃の巨人 Season 2」）が
 * あるため、popularity 最大を採用する。
 */
async function resolveAniListMediaId(
  title: string,
  originalTitle: string | null | undefined,
  mediaType: AniListMediaType,
): Promise<number | null> {
  const queries = new Set<string>();
  const addVariants = (raw: string | null | undefined) => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    queries.add(trimmed);
    const stripped = stripSeasonSuffix(trimmed);
    if (stripped && stripped !== trimmed) queries.add(stripped);
    if (mediaType === "MOVIE") {
      const noPrefix = stripMediaPrefix(trimmed);
      if (noPrefix && noPrefix !== trimmed) queries.add(noPrefix);
    }
  };
  addVariants(title);
  addVariants(originalTitle);

  for (const q of queries) {
    try {
      const media = await searchAniListMedia(q, mediaType, 10);
      if (media.length === 0) continue;
      // popularity 最大 (= シリーズ本体である可能性が高い) を採用
      const best = media.reduce((acc, cur) =>
        cur.popularity > acc.popularity ? cur : acc,
      );
      return best.id;
    } catch {
      // 個別失敗は次のクエリへ
    }
  }
  return null;
}

function pickCharacterName(edge: AniListRelatedCharacterEdge): string {
  return edge.node.name.native || edge.node.name.full || "?";
}

function pickCharacterImage(edge: AniListRelatedCharacterEdge): string | null {
  const img = edge.node.image.large || edge.node.image.medium;
  // AniList のデフォルト画像（情報無しキャラ）を除外
  return img && !img.includes("/default.") ? img : null;
}

export default async function RelatedCharacters({
  title,
  originalTitle,
  mediaType,
  currentPage = 1,
  perPage = 24,
  pageUrl,
  sectionId = "related-characters",
}: RelatedCharactersProps) {
  const mediaId = await resolveAniListMediaId(title, originalTitle, mediaType);
  if (mediaId == null) return null;

  let result: {
    edges: AniListRelatedCharacterEdge[];
    pageInfo: { lastPage: number; total: number };
  };
  try {
    result = await getAniListMediaCharacters(mediaId, currentPage, perPage);
  } catch {
    return null;
  }

  const { edges, pageInfo } = result;
  if (pageInfo.total === 0) return null;

  return (
    <section id={sectionId} className="mt-10 scroll-mt-24">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-white font-bold text-lg">関連キャラクター</h2>
        <span className="text-gray-500 text-sm">{pageInfo.total}件</span>
        {pageInfo.lastPage > 1 && (
          <span className="text-gray-500 text-sm">
            · {currentPage} / {pageInfo.lastPage} ページ
          </span>
        )}
      </div>
      {edges.length === 0 ? (
        <p className="text-gray-500 text-sm">
          このページに表示するキャラはない
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {edges.map((edge) => {
            const name = pickCharacterName(edge);
            const img = pickCharacterImage(edge);
            return (
              <Link
                key={edge.node.id}
                href={`/characters/${edge.node.id}`}
                className="group block"
              >
                <div className="relative aspect-[2/3] rounded overflow-hidden bg-gray-900">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt={name}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                      No Image
                    </div>
                  )}
                </div>
                <p className="text-white text-xs font-semibold leading-tight line-clamp-2 mt-1.5 group-hover:text-[#54b9c5] transition-colors">
                  {name}
                </p>
              </Link>
            );
          })}
        </div>
      )}
      <Pagination
        currentPage={currentPage}
        totalPages={pageInfo.lastPage}
        pageUrl={pageUrl}
      />
    </section>
  );
}
