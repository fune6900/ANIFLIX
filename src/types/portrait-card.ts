// 縦長の人物カード（声優・キャラ）と、それを並べる特集の行の型
//
// 声優ページ（#102）とキャラクターページ（#104）は同じ「Hero + 横スクロールの行 +
// 「すべて見る」の専用ページ」の構成を取り、カードの形も同じ。行の組み立ての共通部分
// （`src/lib/featured-rows.ts`）と一覧グリッドのカード（`PortraitGridCard`）がこの型を受ける。

/** 縦長の人物カード 1 枚 */
export interface PortraitCard {
  /** 取得元の id。1 行の中では一意 */
  id: number;
  name: string;
  /** 画像の完全な URL。画像が無ければ null */
  imageUrl: string | null;
  href: string;
  /** 名前の下に添える一言（役名・作品名・順位など） */
  note?: string;
}

/** 横スクロール 1 行 = 「すべて見る」の専用ページ 1 枚 */
export interface PortraitRow {
  /** 専用ページの URL に載る識別子（`.../collections/{slug}`） */
  slug: string;
  title: string;
  /** 全件。行と専用ページで同じものを出す（切り詰めない） */
  cards: PortraitCard[];
}
