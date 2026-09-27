import { stripSeasonSuffix } from "@/lib/title-strip";

/**
 * AniList のタイトルと TMDb の作品名を照合する。
 *
 * 完全一致だけで判定していた頃は、副題の差だけで軒並み弾かれていた。
 * 実測した例（いずれも TMDb には存在していたのに未照合だった）:
 *
 *   AniList 「ヘルモード …～ 2nd Season」 / TMDb 「ヘルモード …～ はじまりの召喚士」
 *   AniList 「凶乱令嬢ニア・リストン」     / TMDb 「凶乱令嬢ニア・リストン 病弱令嬢に…」
 *   AniList 「クレバテスⅡ-魔獣の王と偽りの勇者伝承-」 / TMDb 「クレバテス-魔獣の王と赤子と屍の勇者」
 *
 * そこで前方一致も許すが、無条件に許すと別作品を掴む。
 * 「区切り文字の直前まで一致していること」と「最低限の長さ」で縛る。
 */

/**
 * 前方一致を認める最短の長さ。
 *
 * 2〜3 文字のタイトルは何にでも前方一致してしまう。
 * 実データで最短だったのは「クレバテス」の 5 文字。
 */
export const MIN_PREFIX_MATCH_LENGTH = 5;

/** 副題の前に置かれる区切り文字 */
const SUBTITLE_SEPARATOR =
  /[\s　:：;；・,，、.。\-－–—~〜～/／|｜(（)）[［\]］{｛}｝「」『』【】!！?？#＃&＆+＋]/;

export type TitleMatchKind = "exact" | "prefix";

/**
 * 比較用の強い正規化。記号と空白を落として表記ゆれを吸収する。
 * 完全一致の判定にだけ使う。
 */
function normalizeStrict(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s　:：!！?？・,、。.「」『』()（）\-－–—~〜～]/g, "")
    .normalize("NFKC");
}

/**
 * 比較用の弱い正規化。**区切り文字を残す**。
 * 前方一致の判定に使う。記号まで落とすと「どこで副題が始まるか」が消える。
 */
function normalizeLoose(title: string): string {
  return title.toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** 長い方が短い方で始まり、その直後が区切り文字であること */
function isSubtitleExtension(shorter: string, longer: string): boolean {
  if (shorter.length < MIN_PREFIX_MATCH_LENGTH) return false;
  if (!longer.startsWith(shorter)) return false;

  const next = longer.charAt(shorter.length);
  return next !== "" && SUBTITLE_SEPARATOR.test(next);
}

/**
 * AniList 側の候補タイトル群と TMDb の作品名を照合する。
 *
 * @param anilistTitles 原題・ローマ字・英題・別名など。順不同
 * @returns 一致の種類。一致しなければ null
 */
export function matchTitles(
  anilistTitles: string[],
  tmdbName: string,
): TitleMatchKind | null {
  const tmdbStrict = normalizeStrict(tmdbName);
  const tmdbLoose = normalizeLoose(tmdbName);
  if (!tmdbStrict || !tmdbLoose) return null;

  // AniList 側はサフィックスを剥がした版も候補に入れる。
  // TMDb は続編を本体作品の Season N として持つため
  const candidates = new Set<string>();
  for (const title of anilistTitles) {
    if (!title) continue;
    candidates.add(title);
    const stripped = stripSeasonSuffix(title);
    if (stripped) candidates.add(stripped);
  }
  if (candidates.size === 0) return null;

  // 完全一致を先に探す。前方一致より信用できる
  for (const candidate of candidates) {
    if (normalizeStrict(candidate) === tmdbStrict) return "exact";
  }

  for (const candidate of candidates) {
    const loose = normalizeLoose(candidate);
    if (!loose) continue;
    if (
      isSubtitleExtension(loose, tmdbLoose) ||
      isSubtitleExtension(tmdbLoose, loose)
    ) {
      return "prefix";
    }
  }

  return null;
}
