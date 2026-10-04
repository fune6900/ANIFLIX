// 声優ページ（/voice-actors）の行と、その専用ページ（/voice-actors/collections/[slug]）の型

/**
 * 声優カード 1 枚。TMDb・AniList のどちらから来ても同じ形に揃える。
 *
 * - TMDb の声優: `href` は `/voice-actors/{TMDb id}`
 * - AniList の声優: TMDb の id を持たないため `href` は `/voice-actors/resolve?name=`
 */
export interface VoiceActorCard {
  /** 取得元の id（TMDb person id か AniList staff id）。1 行の中では一意 */
  id: number;
  name: string;
  /** 写真の完全な URL。写真が無ければ null */
  imageUrl: string | null;
  href: string;
  /** 名前の下に添える一言（役名・出演本数・順位など） */
  note?: string;
}

/** 横スクロール 1 行 = 「すべて見る」の専用ページ 1 枚 */
export interface VoiceActorRow {
  /** 専用ページの URL に載る識別子（`/voice-actors/collections/{slug}`） */
  slug: string;
  title: string;
  /** 全件。行と専用ページで同じものを出す（切り詰めない） */
  cards: VoiceActorCard[];
}
