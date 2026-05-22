/**
 * タイトルからシーズン / クール suffix を除去するユーティリティ。
 *
 * 経緯: AniList と TMDb のタイトル突き合わせで「転生したらスライムだった件 第4期」を
 * TMDb 本体「転生したらスライムだった件」に紐付けるため seasonal-anime.ts 内で
 * 内部関数として実装されていたが、他モジュールからも再利用できるよう分離した。
 *
 * 参照先: src/lib/seasonal-anime.ts（リファクタリング後は当モジュールから import）
 */

// ──────────────────────────────────────────
// 内部定数
// ──────────────────────────────────────────

/**
 * シーズン番号やパート番号のサフィックスを末尾から剥がすパターン一覧。
 *
 * 対応パターン:
 *   - 日本語: 「第4期」「4期」「シーズン4」「第2シーズン」「第N部」「パートN」「第三期」（漢数字）
 *   - 英語: "4th Season", "Season N", "Part N", "Cour N", "The Final Season"
 *   - 副題付き: "4th Season 2-nensei-hen" 等の長いサフィックス
 *   - 複数サフィックスの連鎖（"Foo 4th Season Part 2"）
 *
 * ローマ数字末尾（"II"〜"X"）はメインパターンがヒットして変化があった後の
 * 追加剥がしにのみ適用する（"K-On!! II"・"Code Geass R2" の誤爆防止）。
 *
 * 章サフィックス（〜編 / hen / arc）は副題が独立 TMDb 登録されているケースがあり
 * 誤爆リスクが高いため対象外とする。
 */
const STRIP_SUFFIX_PATTERNS_MAIN: RegExp[] = [
  // 英語: "Nth Season" 以降（副題まで吸収）
  /[\s　]\d+(st|nd|rd|th)?[\s　]+season([\s　:：-].*)?$/i,
  // 英語: "Season N"・"Season N Part M"
  /[\s　]season[\s　]+\d+([\s　:：-].*)?$/i,
  // 英語: "The Final Season"・"Final Season Part 2"
  /[\s　](the[\s　]+)?final[\s　]+season([\s　:：-].*)?$/i,
  // 英語: "Part N" 以降の副題も吸収
  /[\s　]part[\s　]+\d+([\s　:：-].*)?$/i,
  // 英語: "Cour N"・"Nth Cour"
  /[\s　]cour[\s　]+\d+([\s　:：-].*)?$/i,
  /[\s　]\d+(st|nd|rd|th)[\s　]+cour([\s　:：-].*)?$/i,
  // 日本語: 第N期 / N期 / 第Nシーズン / シーズンN（算用数字）
  /[\s　]*第\s*\d+\s*期\s*$/,
  /[\s　]+\d+\s*期\s*$/,
  /[\s　]*第\s*\d+\s*シーズン\s*$/i,
  /[\s　]*シーズン\s*\d+\s*$/i,
  // 日本語: 第N部 / パートN
  /[\s　]*第\s*\d+\s*部\s*$/,
  /[\s　]*パート\s*\d+\s*$/i,
  // 日本語: 漢数字期（第三期 / 第十二期 等）
  /[\s　]*第\s*[一二三四五六七八九十百]+\s*期\s*$/,
];

/** ローマ数字末尾：メインパターンヒット後のみ適用（単独では使わない） */
const STRIP_ROMAN_SUFFIX = /[\s　]+(II|III|IV|V|VI|VII|VIII|IX|X)\s*$/;

// ──────────────────────────────────────────
// 公開 API
// ──────────────────────────────────────────

/**
 * 作品タイトルからシーズン / クール suffix を除去してベースタイトルを返す。
 *
 * @example
 * stripSeasonSuffix("進撃の巨人 The Final Season")  // → "進撃の巨人"
 * stripSeasonSuffix("転生したらスライムだった件 第3期") // → "転生したらスライムだった件"
 * stripSeasonSuffix("転スラ 4期")                   // → "転スラ"
 * stripSeasonSuffix("ぼっち・ざ・ろっく！ 2nd Season") // → "ぼっち・ざ・ろっく！"
 * stripSeasonSuffix("鬼滅の刃")                     // → "鬼滅の刃"（suffix なし → 変化なし）
 *
 * suffix が存在しない場合は元の文字列をそのまま返す。
 * 複数 suffix が連結している場合（"Foo 4th Season Part 2"）は繰り返し除去する。
 */
export function stripSeasonSuffix(title: string): string {
  let curr = title;

  // 1) メインパターンを変化が止まるまで繰り返し適用する
  let mainStripped = false;
  while (true) {
    const before = curr;
    for (const pattern of STRIP_SUFFIX_PATTERNS_MAIN) {
      curr = curr.replace(pattern, "").trim();
    }
    if (curr === before) break;
    mainStripped = true;
  }

  // 2) メインで変化があった場合のみ、追加でローマ数字末尾も剥がす
  //    例: "Foo 4th Season II" → メインで "Foo II" → 追加で "Foo"
  if (mainStripped) {
    while (true) {
      const before = curr;
      curr = curr.replace(STRIP_ROMAN_SUFFIX, "").trim();
      if (curr === before) break;
    }
  }

  // 完全に消えてしまった場合は安全弁として元タイトルを返す
  return curr || title;
}

/**
 * 元タイトルと suffix 除去版を返す。
 * 両者が同じ（suffix が無い）なら1要素の配列、異なるなら2要素の配列。
 *
 * @example
 * getSearchTitleVariants("転スラ 4期")  // → ["転スラ 4期", "転スラ"]
 * getSearchTitleVariants("鬼滅の刃")    // → ["鬼滅の刃"]
 */
export function getSearchTitleVariants(title: string): string[] {
  const stripped = stripSeasonSuffix(title);
  if (stripped === title) return [title];
  return [title, stripped];
}
