/**
 * AniList のキャラクター説明を表示・翻訳向けに整形する。
 *
 * AniList の `description` は独自マークアップを含む:
 *   - 先頭のメタデータ（`__Height__: 145-180 cm` / `__Family:__ ...`）
 *   - スポイラー（`~!...!~`）
 *   - マークダウンリンク（`[ラベル](URL)`）
 *   - 強調（`__太字__` / `**強調**` / `_斜体_`）
 *
 * これらを落とさずに翻訳 API へ投げると、マークアップと URL にまで
 * 翻訳の従量枠を払うことになる。スポイラーはそもそも画面に出してはいけない。
 *
 * 身長・体重などは詳細ページが専用の欄で持っているため、先頭のメタデータは
 * 本文から外す。
 */

/**
 * 翻訳へ流す本文の上限。
 *
 * Google Cloud Translation の無料枠は 50 万文字/月。1 キャラあたりの
 * 消費量に直結するため、定数として固定しテストで縛る。
 */
export const DESCRIPTION_MAX_CHARS = 600;

/** 文末とみなす記号（日本語の句点・全角記号を含む） */
const SENTENCE_ENDINGS = /[.!?。！？]/g;

/**
 * 先頭のメタデータ行。
 *
 * `__Height__: 145-180 cm` / `__Family:__ ...` の両方の書き方を拾う。
 * 強調記号を外す前に判定すること。外した後だと散文中のコロンと区別できない。
 */
const LEADING_METADATA_LINE = /^\s*(?:__|\*\*)[^_*\n]{1,40}?:?(?:__|\*\*):?.*$/;

/**
 * 表示・翻訳向けに整形する。切り詰めは行わない（`truncateAtSentence` と分ける）。
 */
export function cleanCharacterDescription(
  raw: string | null | undefined,
): string {
  if (!raw) return "";

  let text = raw;

  // 1. HTML タグ（AniList は <br> を混ぜてくる）
  text = text.replace(/<[^>]*>/g, " ");

  // 2. スポイラーは中身ごと落とす。改行をまたぐことがあるので [\s\S] で拾う
  text = text.replace(/~!([\s\S]*?)!~/g, "");

  // 3. 先頭のメタデータ行を落とす。本文が始まったら止める
  text = dropLeadingMetadata(text);

  // 4. マークダウンリンクはラベルだけ残す
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // 5. 生の URL を落とす
  text = text.replace(/https?:\/\/\S+/g, "");

  // 6. 強調記号を外して中身を残す
  text = text
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<![\w])_([^_\n]+)_(?![\w])/g, "$1")
    .replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, "$1");

  // 7. 空白の整理。段落の区切り（空行）は残す
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * `maxChars` 以内の最後の文末で打ち切る。
 * 文末が見つからなければそこで切って省略記号を付ける。
 */
export function truncateAtSentence(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;

  const head = text.slice(0, maxChars);

  let lastEnd = -1;
  SENTENCE_ENDINGS.lastIndex = 0;
  for (const match of head.matchAll(SENTENCE_ENDINGS)) {
    lastEnd = match.index;
  }

  if (lastEnd === -1) return `${head}…`;
  return head.slice(0, lastEnd + 1).trim();
}

/** 先頭に並ぶメタデータ行だけを落とす */
function dropLeadingMetadata(text: string): string {
  const lines = text.split("\n");
  let start = 0;

  while (start < lines.length) {
    const line = lines[start];
    if (line.trim() === "") {
      start++;
      continue;
    }
    if (!LEADING_METADATA_LINE.test(line)) break;
    start++;
  }

  return lines.slice(start).join("\n");
}
