// 声優詳細ページで「この声優が演じたキャラ一覧」を AniList 経由で表示する Server Component。
//
// 経緯:
//   TMDb の person credits は character を文字列で持つだけで、キャラ画像も詳細リンクも無い。
//   AniList の staff.characters エッジには画像と AniList Character ID が乗っているので、
//   そこから /characters/[id] への遷移リンクを張れる。
//
// 名前解決:
//   1) TMDb の原名 (original_name) を優先（漢字 / カナの本名で AniList と一致しやすい）
//   2) ヒットしなければ TMDb の翻訳名 (name) で再検索

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAniListStaffCharactersByName } from "@/lib/anilist";
import Pagination from "@/components/Pagination";
import type {
  AniListPageInfo,
  AniListStaffCharacterEdge,
} from "@/types/anilist";

interface VoicedCharactersProps {
  /** TMDb の表示名（language=ja-JP で翻訳済み） */
  name: string;
  /** TMDb の原名（未翻訳）。漢字 / カナの本名がここに残る */
  originalName?: string | null;
  /** TMDb の別名候補 */
  alsoKnownAs?: string[] | null;
  /** 現在のページ番号（1 始まり） */
  currentPage?: number;
  /** 1ページあたり件数 */
  perPage?: number;
  /** ページ番号 → URL を組み立てる関数（呼び出し側でアンカー・既存クエリを管理） */
  pageUrl: (page: number) => string;
  /** ページネーション位置からスクロール対象にするためのアンカー id */
  sectionId?: string;
}

function pickCharacterName(edge: AniListStaffCharacterEdge): string {
  return edge.node.name.native || edge.node.name.full || "?";
}

function pickCharacterImage(edge: AniListStaffCharacterEdge): string | null {
  const img = edge.node.image.large || edge.node.image.medium;
  return img && !img.includes("/default.") ? img : null;
}

function pickMediaTitle(
  media: AniListStaffCharacterEdge["media"][number],
): string {
  return media.title.native || media.title.romaji || media.title.english || "";
}

/** edge.media は配列で popularity 順保証なし → 最も人気のあるメディアを「代表作」として選ぶ */
function pickRepresentativeMedia(
  edge: AniListStaffCharacterEdge,
): AniListStaffCharacterEdge["media"][number] | null {
  if (!edge.media || edge.media.length === 0) return null;
  return edge.media.reduce((acc, cur) =>
    (cur.popularity ?? 0) > (acc.popularity ?? 0) ? cur : acc,
  );
}

async function resolveStaffCharacters(
  candidates: string[],
  page: number,
  perPage: number,
): Promise<{
  staffName: string;
  edges: AniListStaffCharacterEdge[];
  pageInfo: AniListPageInfo;
} | null> {
  const tried = new Set<string>();
  for (const candidate of candidates) {
    const q = candidate.trim();
    if (!q || tried.has(q)) continue;
    tried.add(q);
    try {
      const hit = await getAniListStaffCharactersByName(q, page, perPage);
      if (hit && hit.pageInfo.total > 0) {
        return {
          staffName: hit.staffName,
          edges: hit.edges,
          pageInfo: hit.pageInfo,
        };
      }
    } catch {
      // 個別失敗は次の候補へ
    }
  }
  return null;
}

export default async function VoicedCharacters({
  name,
  originalName,
  alsoKnownAs,
  currentPage = 1,
  perPage = 24,
  pageUrl,
  sectionId = "voiced-characters",
}: VoicedCharactersProps) {
  // 名前候補: 原名 → 表示名 → 別名上位3つ
  const candidates: string[] = [];
  if (originalName) candidates.push(originalName);
  if (name && name !== originalName) candidates.push(name);
  for (const alias of (alsoKnownAs ?? []).slice(0, 3)) {
    if (alias) candidates.push(alias);
  }

  const hit = await resolveStaffCharacters(candidates, currentPage, perPage);
  if (!hit) return null;

  // URL の cpage が実在ページ数を超えていたら最終ページにリダイレクト（空表示防止）
  if (hit.pageInfo.lastPage >= 1 && currentPage > hit.pageInfo.lastPage) {
    redirect(pageUrl(hit.pageInfo.lastPage));
  }

  return (
    <section id={sectionId} className="mt-10 scroll-mt-24">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-white font-bold text-lg">演じたキャラクター</h2>
        <span className="text-gray-500 text-sm">{hit.pageInfo.total}件</span>
        {hit.pageInfo.lastPage > 1 && (
          <span className="text-gray-500 text-sm">
            · {currentPage} / {hit.pageInfo.lastPage} ページ
          </span>
        )}
      </div>
      {hit.edges.length === 0 ? (
        <p className="text-gray-500 text-sm">
          このページに表示するキャラはない
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {hit.edges.map((edge) => {
            const name = pickCharacterName(edge);
            const img = pickCharacterImage(edge);
            const media = pickRepresentativeMedia(edge);
            const mediaTitle = media ? pickMediaTitle(media) : "";
            return (
              <Link
                key={`${edge.node.id}-${media?.id ?? "x"}`}
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
                {mediaTitle && (
                  <p className="text-gray-500 text-[10px] truncate mt-0.5">
                    {mediaTitle}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
      <Pagination
        currentPage={currentPage}
        totalPages={hit.pageInfo.lastPage}
        pageUrl={pageUrl}
      />
    </section>
  );
}
