// ContentRow のホバープレビューが叩く `/api/videos` の URL

/** TV と映画は ID 空間が別。映画の ID で TV の動画を引くと別作品のトレーラーが出る */
export type PreviewMediaType = "tv" | "movie";

export const PREVIEW_MEDIA_TYPES: readonly PreviewMediaType[] = ["tv", "movie"];

export function isPreviewMediaType(raw: string): raw is PreviewMediaType {
  return PREVIEW_MEDIA_TYPES.some((t) => t === raw);
}

/** TV は従来どおり id だけ（既存の URL・ブラウザキャッシュを変えない） */
export function previewVideoUrl(
  id: number,
  mediaType: PreviewMediaType = "tv",
): string {
  return mediaType === "movie"
    ? `/api/videos?id=${id}&type=movie`
    : `/api/videos?id=${id}`;
}

/** モジュールキャッシュのキー。同じ ID でも TV と映画を別に覚える */
export function previewCacheKey(
  id: number,
  mediaType: PreviewMediaType = "tv",
): string {
  return `${mediaType}:${id}`;
}
