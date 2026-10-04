import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getAniListCharacter,
  getAniListCharacterMedia,
  getAniListCharacterMediaCount,
  getAniListMediaCharacterCount,
  getAniListMediaCharacters,
} from "@/lib/anilist";
import { resolvePaging } from "@/lib/page-probe";
import type { ProbedPages, ResolvedPaging } from "@/lib/page-probe";
import { parsePageParam } from "@/lib/tmdb";
import { searchAnnictCharacterByName } from "@/lib/annict";
import { translateManyToJa } from "@/lib/translate";
import {
  cleanCharacterDescription,
  truncateAtSentence,
  DESCRIPTION_MAX_CHARS,
} from "@/lib/description";
import Pagination from "@/components/Pagination";
import type {
  AniListCharacterDetail,
  AniListCharacterDetailMediaEdge,
  AniListFuzzyDate,
  AniListPageInfo,
  AniListRelatedCharacterEdge,
} from "@/types/anilist";
import type { AnnictCharacterProfile } from "@/types/annict";

/** 出演作品の 1 ページあたりの件数 */
const WORKS_PER_PAGE = 30;
/** 関連キャラクターの 1 ページあたりの件数 */
const RELATED_PER_PAGE = 50;

const WORKS_SECTION_ID = "works";
const RELATED_SECTION_ID = "related-characters";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    wpage?: string | string[];
    cpage?: string | string[];
  }>;
}

/** 出演作品（wpage）と関連キャラクター（cpage）のページ位置。URL の中で共存する */
interface PagePositions {
  wpage: number;
  cpage: number;
}

/** 1 ページ目のパラメータは落とす。アンカーで送った側のセクションへ飛ばす */
function characterPageUrl(
  id: number,
  { wpage, cpage }: PagePositions,
  anchor: string,
): string {
  const query = new URLSearchParams();
  if (wpage > 1) query.set("wpage", String(wpage));
  if (cpage > 1) query.set("cpage", String(cpage));
  const qs = query.toString();
  return `/characters/${id}${qs ? `?${qs}` : ""}#${anchor}`;
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
    <div className="grid grid-cols-[88px_1fr] sm:grid-cols-[120px_1fr] 4xl:grid-cols-[140px_1fr] 5xl:grid-cols-[160px_1fr] gap-x-3 py-2 xl:py-2.5 border-b border-gray-800">
      <span className="text-gray-500 text-xs xl:text-sm font-semibold pt-0.5">
        {label}
      </span>
      <span className="text-gray-200 text-sm xl:text-base leading-relaxed">
        {children}
      </span>
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

        <div className="absolute bottom-0 left-0 right-0 p-2 xl:p-2.5">
          <p className="text-white text-[11px] xl:text-sm font-semibold truncate">
            {title}
          </p>
          {edge.node.seasonYear && (
            <p className="text-gray-400 text-[10px] xl:text-xs">
              {edge.node.seasonYear}
            </p>
          )}
        </div>
      </Link>
      {va && (
        <Link
          href={vaHref(va.name.native || va.name.full || "")}
          className="block mt-1 px-0.5 text-purple-300 text-[11px] xl:text-xs truncate hover:text-purple-200 transition"
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

interface PagedSection<E> {
  edges: E[];
  /** 取得に失敗したら true（「出演作はない」と区別する） */
  failed: boolean;
  paging: ResolvedPaging;
}

interface FetchedPage<E> {
  edges: E[];
  pageInfo: AniListPageInfo;
}

interface CountHint {
  reportedLastPage: number;
  firstPageCount: number;
}

/**
 * 1 ページぶんを取り、実在するページ数を数えて、寄せ先まで決める。
 *
 * AniList の pageInfo（total / lastPage）は実態と食い違うので件数には使わない
 * （`src/lib/page-probe.ts`）。数えるのに失敗しても今のページの件数で推し量って出す。
 * 1 ページ目: 取得結果を数え始めのヒントに使い回すため、直列で待つ。
 * 2 ページ目以降: ヒントを渡さないので待つ理由がなく、並列で取る。
 */
async function loadPagedSection<E>(
  page: number,
  perPage: number,
  fetchPage: () => Promise<FetchedPage<E>>,
  count: (hint?: CountHint) => Promise<ProbedPages>,
): Promise<PagedSection<E>> {
  const safeCount = (hint?: CountHint): Promise<ProbedPages | null> =>
    count(hint).then(
      (value) => value,
      () => null,
    );

  let fetched: FetchedPage<E>;
  let counted: ProbedPages | null;
  try {
    if (page === 1) {
      fetched = await fetchPage();
      const reportedLastPage = fetched.pageInfo.lastPage;
      counted = await safeCount(
        reportedLastPage > 0
          ? { reportedLastPage, firstPageCount: fetched.edges.length }
          : undefined,
      );
    } else {
      const counting = safeCount();
      try {
        fetched = await fetchPage();
      } catch (error) {
        await counting; // 未処理にしない（safeCount は reject しない）
        throw error;
      }
      counted = await counting;
    }
  } catch {
    return {
      edges: [],
      failed: true,
      paging: { lastPage: 0, total: null, redirectTo: null },
    };
  }

  return {
    edges: fetched.edges,
    failed: false,
    paging: resolvePaging(page, perPage, fetched.edges.length, counted),
  };
}

interface CharacterPageData {
  detail: AniListCharacterDetail;
  annict: AnnictCharacterProfile | null;
  works: PagedSection<AniListCharacterDetailMediaEdge>;
  related: PagedSection<AniListRelatedCharacterEdge>;
}

const EMPTY_RELATED: PagedSection<AniListRelatedCharacterEdge> = {
  edges: [],
  failed: false,
  paging: { lastPage: 0, total: 0, redirectTo: null },
};

async function loadCharacterPageData(
  id: number,
  { wpage, cpage }: PagePositions,
): Promise<CharacterPageData | null> {
  const detail = await getAniListCharacter(id);
  if (!detail) return null;

  const name = pickName(detail);
  const topMediaId = detail.media.edges[0]?.node.id;

  const [annict, works, related] = await Promise.all([
    searchAnnictCharacterByName(name),
    loadPagedSection(
      wpage,
      WORKS_PER_PAGE,
      () => getAniListCharacterMedia(id, wpage, WORKS_PER_PAGE),
      (hint) => getAniListCharacterMediaCount(id, WORKS_PER_PAGE, hint),
    ),
    topMediaId
      ? loadPagedSection(
          cpage,
          RELATED_PER_PAGE,
          () => getAniListMediaCharacters(topMediaId, cpage, RELATED_PER_PAGE),
          (hint) =>
            getAniListMediaCharacterCount(topMediaId, RELATED_PER_PAGE, hint),
        )
      : Promise.resolve(EMPTY_RELATED),
  ]);

  return {
    detail,
    annict,
    works,
    // 自分自身は関連から除外（ページ数は取得した件数のまま数える）
    related: {
      ...related,
      edges: related.edges.filter((e) => e.node.id !== id),
    },
  };
}

export default async function CharacterDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id: rawId } = await params;
  const { wpage: rawWpage, cpage: rawCpage } = await searchParams;
  const id = parseInt(rawId, 10);
  if (!Number.isFinite(id) || id <= 0) notFound();
  const positions: PagePositions = {
    wpage: parsePageParam(Array.isArray(rawWpage) ? rawWpage[0] : rawWpage),
    cpage: parsePageParam(Array.isArray(rawCpage) ? rawCpage[0] : rawCpage),
  };

  const data = await loadCharacterPageData(id, positions);
  if (!data) notFound();

  const { detail, annict, works, related } = data;

  // 範囲外のページ番号は最終ページへ寄せる（空表示防止）。もう片方の位置は保つ。
  // 両方ずれていたら 1 回でまとめて直し、出演作品のセクションへ飛ばす
  const wpageTo = works.paging.redirectTo;
  const cpageTo = related.paging.redirectTo;
  if (wpageTo !== null || cpageTo !== null) {
    redirect(
      characterPageUrl(
        id,
        {
          wpage: wpageTo ?? positions.wpage,
          cpage: cpageTo ?? positions.cpage,
        },
        wpageTo !== null ? WORKS_SECTION_ID : RELATED_SECTION_ID,
      ),
    );
  }
  const display = pickName(detail);
  const characterImage = detail.image.large || detail.image.medium || null;
  const safeImage =
    characterImage && !characterImage.includes("/default.")
      ? characterImage
      : null;
  const aniListBirthday = formatBirthday(detail.dateOfBirth);
  const aniListDescription = cleanCharacterDescription(detail.description);

  // Annict 値を優先、無ければ AniList で埋める（翻訳前の原文フィールド）
  const rawGender = normalizeGender(detail.gender || "");
  const rawHeight = annict?.height || "";
  const rawWeight = annict?.weight || "";
  const rawNationality = annict?.nationality || "";
  // スポイラー・リンク・先頭のメタデータを落としてから文の区切りで打ち切る。
  // マークアップまで翻訳 API に送ると、そのぶん従量枠を払うことになる
  const rawDescription = truncateAtSentence(
    cleanCharacterDescription(annict?.description) || aniListDescription,
    DESCRIPTION_MAX_CHARS,
  );
  const rawAliases = (detail.name.alternative ?? []).filter(
    (a) => a && a.trim().length > 0,
  );

  // 翻訳対象テキストをまとめて翻訳 API へ送る
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
  const topWork = detail.media.edges[0] ?? null;
  const cvFromTopWork = topWork?.voiceActors[0] ?? null;

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-24">
      <div className="site-container">
        <nav className="mb-6 text-xs text-gray-500">
          <Link href="/characters" className="hover:text-white transition">
            ← キャラクター
          </Link>
        </nav>

        {/* ヒーロー */}
        <section className="detail-block grid grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[360px_1fr] 3xl:grid-cols-[400px_1fr] 4xl:grid-cols-[440px_1fr] 5xl:grid-cols-[480px_1fr] gap-6 md:gap-10 xl:gap-12 mb-12">
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
            <h1 className="text-white text-3xl md:text-4xl xl:text-5xl font-extrabold leading-tight">
              {fields.name}
            </h1>
            {hasValue(fields.nameKana) && (
              <p className="text-gray-400 text-sm xl:text-base mt-1">
                {fields.nameKana}
              </p>
            )}
            {hasValue(fields.nameEn) && fields.nameEn !== fields.name && (
              <p className="text-gray-500 text-sm xl:text-base">
                {fields.nameEn}
              </p>
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
                <p className="text-gray-500 text-xs xl:text-sm font-semibold uppercase tracking-wider mb-1.5">
                  キャラ紹介
                </p>
                <p className="text-gray-300 text-sm lg:text-base 3xl:text-lg leading-relaxed whitespace-pre-wrap">
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
        <section id={WORKS_SECTION_ID} className="mb-12 scroll-mt-24">
          <div className="flex items-baseline gap-3 mb-4 flex-wrap">
            <h2 className="text-white text-xl xl:text-2xl 3xl:text-3xl font-bold">
              出演作品
              {works.paging.total !== null && (
                <span className="text-gray-500 text-sm xl:text-base font-normal ml-2">
                  {works.paging.total}件
                </span>
              )}
            </h2>
            {works.paging.total !== null && works.paging.lastPage > 1 && (
              <span className="text-gray-500 text-sm">
                · {positions.wpage} / {works.paging.lastPage} ページ
              </span>
            )}
          </div>
          {works.edges.length === 0 ? (
            <p className="text-gray-500 text-sm">
              {works.failed
                ? "出演作品を取得できなかった"
                : "登録されている出演作はない"}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 3xl:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3 md:gap-4">
              {works.edges.map((edge) => (
                <MediaEdgeCard key={edge.node.id} edge={edge} />
              ))}
            </div>
          )}
          <Pagination
            currentPage={positions.wpage}
            totalPages={works.paging.lastPage}
            pageUrl={(p) =>
              characterPageUrl(id, { ...positions, wpage: p }, WORKS_SECTION_ID)
            }
          />
        </section>

        {/* 関連キャラクター */}
        {related.paging.lastPage > 0 && related.paging.total !== 0 && (
          <section id={RELATED_SECTION_ID} className="scroll-mt-24">
            <div className="flex items-baseline gap-3 mb-4 flex-wrap">
              <h2 className="text-white text-xl xl:text-2xl 3xl:text-3xl font-bold">
                関連キャラクター
                <span className="text-gray-500 text-sm xl:text-base font-normal ml-2">
                  {topWork ? workTitle(topWork) : ""} より
                </span>
              </h2>
              {related.paging.total !== null && (
                <span className="text-gray-500 text-sm">
                  {related.paging.total}件
                </span>
              )}
              {related.paging.total !== null && related.paging.lastPage > 1 && (
                <span className="text-gray-500 text-sm">
                  · {positions.cpage} / {related.paging.lastPage} ページ
                </span>
              )}
            </div>
            {related.edges.length === 0 ? (
              <p className="text-gray-500 text-sm">
                このページに表示するキャラはない
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 3xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
                {related.edges.map((edge) => (
                  <RelatedCharacterCard key={edge.node.id} edge={edge} />
                ))}
              </div>
            )}
            <Pagination
              currentPage={positions.cpage}
              totalPages={related.paging.lastPage}
              pageUrl={(p) =>
                characterPageUrl(
                  id,
                  { ...positions, cpage: p },
                  RELATED_SECTION_ID,
                )
              }
            />
          </section>
        )}
      </div>
    </div>
  );
}
