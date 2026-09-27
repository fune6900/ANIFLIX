/**
 * タイトルからシーズン / クール suffix を除去するユーティリティ。
 *
 * 経緯: AniList と TMDb のタイトル突き合わせで「転生したらスライムだった件 第4期」を
 * TMDb 本体「転生したらスライムだった件」に紐付けるため seasonal-anime.ts 内で
 * 内部関数として実装されていたが、他モジュールからも再利用できるよう分離した。
 *
 * TMDb は続編を独立エントリではなく本体作品の Season N として登録するため、
 * ここで本体タイトルへ寄せられない作品は AniList から取れていても画面に出ない。
 * パターンは AniList の実データ（2026 SUMMER / FALL）を基に拡張している。
 *
 * 参照先: src/lib/seasonal-anime.ts
 */

// ──────────────────────────────────────────
// 内部定数
// ──────────────────────────────────────────

/**
 * 日本語の文字クラス（ひらがな / カタカナ / 漢字 / 長音・繰り返し記号）。
 *
 * 「裸の数字」「直結したローマ数字」を剥がす際の直前文字の判定に使う。
 * 英数字の直後は対象外にすることで `AKB0048` や `Code Geass R2` の誤爆を防ぐ。
 */
const JP_CHAR = "ぁ-んァ-ヶー々〆〤ゝゞヽヾ一-鿿";

/** 副題の開始に使われる区切り文字（ローマ数字の後ろを吸収する用） */
const SUBTITLE_LEAD = "\\s　:：~〜～ー\\-－−–—";

/**
 * ローマ数字（全角 Ⅱ-Ⅹ / 半角 II-X）。
 * 正規表現の選択は先頭一致なので、長いものから並べること。
 */
const ROMAN_NUMERAL = "Ⅷ|Ⅶ|Ⅵ|Ⅳ|Ⅸ|Ⅲ|Ⅱ|Ⅴ|Ⅹ|VIII|VII|III|IX|IV|VI|II|X|V";

/**
 * シーズン番号やパート番号のサフィックスを末尾から剥がすパターン一覧。
 *
 * 対応パターン:
 *   - 日本語: 「第4期」「4期」「十七期」「シーズン4」「第2シーズン」「第N部」
 *             「パートN」「第Nシリーズ」「第N&Mクール」
 *   - 英語: "4th Season", "Season N", "Part N", "Cour N", "The Final Season"
 *   - 直結: 「幼女戦記Ⅱ」「剣聖になるII」「乙女ゲー…です2」（英数字の直後は除外）
 *   - 副題付き: "4th Season 2-nensei-hen"・「無職転生Ⅲ ～異世界行ったら本気だす～」
 *   - 複数サフィックスの連鎖（"Foo 4th Season Part 2"・「第4期 第1&2クール」）
 *
 * 章サフィックス（〜編 / hen / arc）は副題が独立 TMDb 登録されているケースがあり
 * 誤爆リスクが高いため対象外とする。
 */
const STRIP_SUFFIX_PATTERNS_MAIN: RegExp[] = [
  // 英語: "Nth Season" 以降（副題まで吸収）
  /[\s　]\d+(st|nd|rd|th)?[\s　]+season([\s　:：-].*)?$/i,
  // 英語: "Season N"・"Season N Part M"。全角数字と空白なし直結も拾う
  // （例: "アオのハコ Season２" / "探偵はもう、死んでいる。Season2"）
  /[\s　]*season[\s　]*[\d０-９]+([\s　:：-].*)?$/i,
  // 英語: "The Final Season"・"Final Season Part 2"
  /[\s　](the[\s　]+)?final[\s　]+season([\s　:：-].*)?$/i,
  // 英語: "Part N" 以降の副題も吸収
  /[\s　]part[\s　]+\d+([\s　:：-].*)?$/i,
  // 英語: "Cour N"・"Nth Cour"
  /[\s　]cour[\s　]+\d+([\s　:：-].*)?$/i,
  /[\s　]\d+(st|nd|rd|th)[\s　]+cour([\s　:：-].*)?$/i,
  // 日本語: 第N期 / N期 / 第Nシーズン / シーズンN（算用数字・全角数字）
  /[\s　]*第\s*[\d０-９]+\s*期\s*$/,
  /[\s　]+[\d０-９]+\s*期\s*$/,
  /[\s　]*第\s*[\d０-９]+\s*シーズン\s*$/i,
  /[\s　]*シーズン\s*[\d０-９]+\s*$/i,
  // 日本語: 第N部 / パートN / 第Nシリーズ
  /[\s　]*第\s*[\d０-９]+\s*部\s*$/,
  /[\s　]*パート\s*[\d０-９]+\s*$/i,
  /[\s　]*第\s*[\d０-９]+\s*シリーズ\s*$/,
  // 日本語: クール表記（「第1&2クール」「第2クール」）。
  // 「第4期 第1&2クール」は先にこちらが落ち、次の周回で「第4期」が落ちる
  /[\s　]*第\s*[\d０-９]+\s*(?:[&＆][\s　]*[\d０-９]+\s*)?クール\s*$/,
  /[\s　]*[\d０-９]+\s*クール\s*$/,
  // 日本語: 漢数字期（第三期 / 第十二期 / 十七期）
  /[\s　]*第\s*[一二三四五六七八九十百]+\s*期\s*$/,
  /[\s　]+[一二三四五六七八九十百]+\s*期\s*$/,
  // 直結ローマ数字（副題も吸収）。日本語文字の直後に限る。
  // 例: 「幼女戦記Ⅱ」「剣聖になるII」「無職転生Ⅲ ～異世界行ったら本気だす～」
  // `K-On!! II`（直前が "!"）や `Code Geass R2`（ローマ数字でない）は対象外
  new RegExp(
    `(?<=[${JP_CHAR}])[\\s　]*(?:${ROMAN_NUMERAL})(?:[${SUBTITLE_LEAD}].*)?$`,
  ),
  // 末尾の裸の数字（2〜9 の一桁のみ）。日本語文字の直後に限る。
  // 例: 「乙女ゲー世界はモブに厳しい世界です2」「ワンパンマン３」
  // `AKB0048`（直前が数字）や `LV999の村人`（末尾が数字でない）は対象外
  new RegExp(`(?<=[${JP_CHAR}])[\\s　]*[2-9２-９][\\s　]*$`),
];

/** ローマ数字末尾（空白区切り）：メインパターンヒット後のみ適用 */
const STRIP_ROMAN_SUFFIX = /[\s　]+(II|III|IV|V|VI|VII|VIII|IX|X)\s*$/;

// ──────────────────────────────────────────
// 公開 API
// ──────────────────────────────────────────

/**
 * 作品タイトルからシーズン / クール suffix を除去してベースタイトルを返す。
 *
 * @example
 * stripSeasonSuffix("進撃の巨人 The Final Season")  // → "進撃の巨人"
 * stripSeasonSuffix("転生したらスライムだった件 第4期 第1&2クール") // → "転生したらスライムだった件"
 * stripSeasonSuffix("乙女ゲー世界はモブに厳しい世界です2") // → "乙女ゲー世界はモブに厳しい世界です"
 * stripSeasonSuffix("幼女戦記Ⅱ")                    // → "幼女戦記"
 * stripSeasonSuffix("鬼滅の刃")                     // → "鬼滅の刃"（suffix なし → 変化なし）
 * stripSeasonSuffix("AKB0048")                     // → "AKB0048"（英数字の直後は剥がさない）
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

  // 2) メインで変化があった場合のみ、追加で空白区切りのローマ数字末尾も剥がす
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
