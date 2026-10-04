// 声優ページ（/voice-actors）の行と、その専用ページ（/voice-actors/collections/[slug]）の型

import type { PortraitCard, PortraitRow } from "@/types/portrait-card";

/**
 * 声優カード 1 枚。TMDb・AniList のどちらから来ても同じ形に揃える。
 *
 * - `id`: TMDb person id か AniList staff id
 * - TMDb の声優: `href` は `/voice-actors/{TMDb id}`
 * - AniList の声優: TMDb の id を持たないため `href` は `/voice-actors/resolve?name=`
 */
export type VoiceActorCard = PortraitCard;

/** 横スクロール 1 行 = 「すべて見る」の専用ページ（`/voice-actors/collections/{slug}`）1 枚 */
export type VoiceActorRow = PortraitRow;
