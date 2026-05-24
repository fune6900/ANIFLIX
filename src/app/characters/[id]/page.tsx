import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAniListCharacter, getAniListMediaCharacters } from "@/lib/anilist";
import { searchAnnictCharacterByName } from "@/lib/annict";
import { translateManyToJa } from "@/lib/translate";
import Pagination from "@/components/Pagination";
import type {
  AniListCharacterDetail,
  AniListCharacterDetailMediaEdge,
  AniListFuzzyDate,
  AniListPageInfo,
  AniListRelatedCharacterEdge,
} from "@/types/anilist";
import type { AnnictCharacterProfile } from "@/types/annict";

const RELATED_PER_PAGE = 24;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cpage?: string | string[] }>;
}

const GENDER_MAP: Record<string, string> = {
  Male: "男性",
  Female: "女性",
  "Non-binary": "ノンバイナリー",
  Other: "その他",
};

function normalizeGender(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return GENDER_MAP[raw] ?? raw;
}

function pickName(detail: AniListCharacterDetail): string {
  return detail.name.native || detail.name.full || `(id:${detail.id})`;
}

function formatBirthday(d: AniListFuzzyDate | null): string | null {
  if (!d) return null;
  if (!d.month && !d.day && !d.year) return null;
  const m = d.month ? `${d.month}月` : "";
  const day = d.day ? `${d.day}日` : "";
  const year = d.year ? `${d.year}年` : "";
  return `${year}${m}${day}` || null;
}

function sanitizeText(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/<[^>]*>/g, "").trim();
}

function workTitle(edge: AniListCharacterDetailMediaEdge): string {
  const t = edge.node.title;
  return t.native || t.romaji || t.english || `(id:${edge.node.id})`;
}

function workHref(edge: AniListCharacterDetailMediaEdge): string {
  return `/works/resolve?title=${encodeURIComponent(workTitle(edge))}&aniListId=${edge.node.id}`;
}

function vaHref(vaName: string): string {
  return `/voice-actors/resolve?name=${encodeURIComponent(vaName)}`;
}

/** 表示用にゼロ幅・null・空文字を弾く。Annict は欠損を空文字で返す */
function hasValue(v: string | number | null | undefined): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

interface InfoRowProps {
  label: string;
  children: React.ReactNode;
}
function InfoRow({ label, children }: InfoRowProps) {
  return (
    <div className="grid grid-cols-[88px_1fr] sm:grid-cols-[120px_1fr] gap-x-3 py-2 border-b border-gray-800">
      <span className="text-gray-500 text-xs font-semibold pt-0.5">
        {label}
      </span>
      <span className="text-gray-200 text-sm leading-relaxed">{children}</span>
    </div>
  );
}

function MediaEdgeCard({ edge }: { edge: AniListCharacterDetailMediaEdge }) {
  const title = workTitle(edge);
  const poster = edge.node.coverImage.extraLarge || edge.node.coverImage.large;
  const va = edge.voiceActors[0];

  return (
    <div className="group">
      <Link
        href={workHref(edge)}
        className="block relative aspect-[2/3] rounded-sm overflow-hidden bg-gray-900"
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-white text-xs font-bold text-center leading-tight">
              {title}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-white text-[11px] font-semibold truncate">
            {title}
          </p>
          {edge.node.seasonYear && (
            <p className="text-gray-400 text-[10px]">{edge.node.seasonYear}</p>
          )}
        </div>
      </Link>
      {va && (
        <Link
          href={vaHref(va.name.native || va.name.full || "")}
          className="block mt-1 px-0.5 text-purple-300 text-[11px] truncate hover:text-purple-200 transition"
        >
          CV: {va.name.native || va.name.full}
        </Link>
      )}
    </div>
  );
}

function RelatedCharacterCard({ edge }: { edge: AniListRelatedCharacterEdge }) {
  const img = edge.node.image.large || edge.node.image.medium;
  const safeImg = img && !img.includes("/default.") ? img : null;
  const name = edge.node.name.native || edge.node.name.full || "?";

  return (
    <Link href={`/characters/${edge.node.id}`} className="group block">
      <div className="relative aspect-[2/3] rounded overflow-hidden bg-gray-900">
        {safeImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={safeImg}
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
      <p className="text-white text-xs font-semibold leading-tight line-clamp-2 mt-1.5">
        {name}
      </p>
    </Link>
  );
}

interface CharacterPageData {
  detail: AniListCharacterDetail;
  annict: AnnictCharacterProfile | null;
  related: AniListRelatedCharacterEdge[];
  relatedPageInfo: AniListPageInfo | null;
}

const EMPTY_RELATED = {
  edges: [] as AniListRelatedCharacterEdge[],
  pageInfo: null as AniListPageInfo | null,
};

async function loadCharacterPageData(
  id: number,
  relatedPage: number,
): Promise<CharacterPageData | null> {
  const detail = await getAniListCharacter(id);
  if (!detail) return null;

  const name = pickName(detail);
  const topMediaId = detail.media.edges[0]?.node.id;

  const [annict, relatedRaw] = await Promise.all([
    searchAnnictCharacterByName(name),
    topMediaId
      ? getAniListMediaCharacters(topMediaId, relatedPage, RELATED_PER_PAGE)
          .then((r) => ({ edges: r.edges, pageInfo: r.pageInfo }))
          .catch(() => EMPTY_RELATED)
      : Promise.resolve(EMPTY_RELATED),
  ]);

  // 自分自身は関連から除外
  const related = relatedRaw.edges.filter((e) => e.node.id !== id);

  return {
    detail,
    annict,
    related,
    relatedPageInfo: relatedRaw.pageInfo,
  };
}

export default async function CharacterDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id: rawId } = await params;
  const { cpage } = await searchParams;
  const cpageStr = Array.isArray(cpage) ? cpage[0] : cpage;
  const id = parseInt(rawId, 10);
  if (!Number.isFinite(id) || id <= 0) notFound();
  const charactersPage = Math.max(1, parseInt(cpageStr ?? "1", 10) || 1);

  const data = await loadCharacterPageData(id, charactersPage);
  if (!data) notFound();

  const { detail, annict, related, relatedPageInfo } = data;

  // URL の cpage が実在ページ数を超えていたら最終ページにリダイレクト（空表示防止）
  if (
    relatedPageInfo &&
    relatedPageInfo.lastPage >= 1 &&
    charactersPage > relatedPageInfo.lastPage
  ) {
    redirect(
      `/characters/${id}?cpage=${relatedPageInfo.lastPage}#related-characters`,
    );
  }
  const display = pickName(detail);
  const characterImage = detail.image.large || detail.image.medium || null;
  const safeImage =
    characterImage && !characterImage.includes("/default.")
      ? characterImage
      : null;
  const aniListBirthday = formatBirthday(detail.dateOfBirth);
  const aniListDescription = sanitizeText(detail.description);

  // Annict 値を優先、無ければ AniList で埋める（翻訳前の原文フィールド）
  const rawGender = normalizeGender(detail.gender || "");
  const rawHeight = annict?.height || "";
  const rawWeight = annict?.weight || "";
  const rawNationality = annict?.nationality || "";
  const rawDescription =
    sanitizeText(annict?.description) || aniListDescription;
  const rawAliases = (detail.name.alternative ?? []).filter(
    (a) => a && a.trim().length > 0,
  );

  // 翻訳対象テキストをまとめて DeepL へ送る
  // 順序: [height, weight, nationality, description, ...aliases]
  // 性別は GENDER_MAP で静的マッピング済みのため翻訳 API には渡さない
  const textsToTranslate = [
    rawHeight,
    rawWeight,
    rawNationality,
    rawDescription,
    ...rawAliases,
  ];
  const translated = await translateManyToJa(textsToTranslate);
  const [tHeight, tWeight, tNationality, tDescription, ...tAliases] =
    translated;

  const fields = {
    name: display,
    nameKana: annict?.nameKana || "",
    nameEn: annict?.nameEn || detail.name.full || "",
    nickname: annict?.nickname || "",
    nicknameEn: annict?.nicknameEn || "",
    birthday: annict?.birthday || aniListBirthday || "",
    age: annict?.age || detail.age || "",
    bloodType: annict?.bloodType || detail.bloodType || "",
    height: tHeight || "",
    weight: tWeight || "",
    nationality: tNationality || "",
    occupation: annict?.occupation || "",
    description: tDescription || "",
    descriptionSource: annict?.descriptionSource || "",
    gender: rawGender || "",
  };

  const aliases = tAliases;
  const edges = detail.media.edges;
  const cvFromTopWork = edges[0]?.voiceActors[0] ?? null;

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-24">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <nav className="mb-6 text-xs text-gray-500">
          <Link
            href="/search/characters"
            className="hover:text-white transition"
          >
            ← キャラクター検索
          </Link>
        </nav>

        {/* ヒーロー */}
        <section className="grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[320px_1fr] gap-6 md:gap-10 mb-12">
          {/* キャラ画像 */}
          <div className="relative aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
            {safeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={safeImage}
                alt={fields.name}
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                No Image
              </div>
            )}
          </div>

          {/* メタ */}
          <div>
            <h1 className="text-white text-3xl md:text-4xl font-extrabold leading-tight">
              {fields.name}
            </h1>
            {hasValue(fields.nameKana) && (
              <p className="text-gray-400 text-sm mt-1">{fields.nameKana}</p>
            )}
            {hasValue(fields.nameEn) && fields.nameEn !== fields.name && (
              <p className="text-gray-500 text-sm">{fields.nameEn}</p>
            )}

            {/* 詳細フィールド */}
            <div className="mt-5">
              {hasValue(fields.nickname) && (
                <InfoRow label="ニックネーム">
                  {fields.nickname}
                  {hasValue(fields.nicknameEn) && (
                    <span className="text-gray-500">
                      （{fields.nicknameEn}）
                    </span>
                  )}
                </InfoRow>
              )}
              {hasValue(fields.gender) && (
                <InfoRow label="性別">{fields.gender}</InfoRow>
              )}
              {hasValue(fields.age) && (
                <InfoRow label="年齢">{fields.age}</InfoRow>
              )}
              {hasValue(fields.birthday) && (
                <InfoRow label="誕生日">{fields.birthday}</InfoRow>
              )}
              {hasValue(fields.bloodType) && (
                <InfoRow label="血液型">{fields.bloodType}</InfoRow>
              )}
              {hasValue(fields.height) && (
                <InfoRow label="身長">{fields.height}</InfoRow>
              )}
              {hasValue(fields.weight) && (
                <InfoRow label="体重">{fields.weight}</InfoRow>
              )}
              {hasValue(fields.nationality) && (
                <InfoRow label="国籍">{fields.nationality}</InfoRow>
              )}
              {hasValue(fields.occupation) && (
                <InfoRow label="肩書き">{fields.occupation}</InfoRow>
              )}
              {cvFromTopWork && (
                <InfoRow label="声優">
                  <Link
                    href={vaHref(
                      cvFromTopWork.name.native ||
                        cvFromTopWork.name.full ||
                        "",
                    )}
                    className="text-purple-300 hover:text-purple-200 transition"
                  >
                    {cvFromTopWork.name.native || cvFromTopWork.name.full}
                  </Link>
                </InfoRow>
              )}
              {aliases.length > 0 && (
                <InfoRow label="別名">{aliases.join(" / ")}</InfoRow>
              )}
            </div>

            {/* キャラ紹介 */}
            {hasValue(fields.description) && (
              <div className="mt-6">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  キャラ紹介
                </p>
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {fields.description}
                </p>
                {hasValue(fields.descriptionSource) && (
                  <p className="text-gray-500 text-[11px] mt-2">
                    引用元: {fields.descriptionSource}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 出演作品 */}
        <section className="mb-12">
          <h2 className="text-white text-xl font-bold mb-4">
            出演作品
            <span className="text-gray-500 text-sm font-normal ml-2">
              {edges.length}件
            </span>
          </h2>
          {edges.length === 0 ? (
            <p className="text-gray-500 text-sm">登録されている出演作はない</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
              {edges.map((edge) => (
                <MediaEdgeCard key={edge.node.id} edge={edge} />
              ))}
            </div>
          )}
        </section>

        {/* 関連キャラクター */}
        {relatedPageInfo && relatedPageInfo.total > 0 && (
          <section id="related-characters" className="scroll-mt-24">
            <div className="flex items-baseline gap-3 mb-4 flex-wrap">
              <h2 className="text-white text-xl font-bold">
                関連キャラクター
                <span className="text-gray-500 text-sm font-normal ml-2">
                  {edges[0] ? workTitle(edges[0]) : ""} より
                </span>
              </h2>
              <span className="text-gray-500 text-sm">
                {relatedPageInfo.total}件
              </span>
              {relatedPageInfo.lastPage > 1 && (
                <span className="text-gray-500 text-sm">
                  · {charactersPage} / {relatedPageInfo.lastPage} ページ
                </span>
              )}
            </div>
            {related.length === 0 ? (
              <p className="text-gray-500 text-sm">
                このページに表示するキャラはない
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {related.map((edge) => (
                  <RelatedCharacterCard key={edge.node.id} edge={edge} />
                ))}
              </div>
            )}
            <Pagination
              currentPage={charactersPage}
              totalPages={relatedPageInfo.lastPage}
              pageUrl={(p) => `/characters/${id}?cpage=${p}#related-characters`}
            />
          </section>
        )}
      </div>
    </div>
  );
}
