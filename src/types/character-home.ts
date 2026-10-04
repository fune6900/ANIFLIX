// キャラクターページ（/characters）の行と、その専用ページ（/characters/collections/[slug]）の型

import type { PortraitCard, PortraitRow } from "@/types/portrait-card";

/**
 * キャラカード 1 枚。取得元はすべて AniList。
 *
 * - `id`: AniList の Character id
 * - `href`: キャラ詳細（`/characters/{AniList id}`）
 */
export type CharacterCard = PortraitCard;

/** 横スクロール 1 行 = 「すべて見る」の専用ページ（`/characters/collections/{slug}`）1 枚 */
export type CharacterRow = PortraitRow;
