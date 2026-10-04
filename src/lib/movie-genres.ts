// `ANIME_GENRES` の ID を映画（/discover/movie・genre_ids）のジャンル ID に読み替える

/**
 * TV 専用のジャンル ID → 映画のジャンル ID。
 * 映画は TV 用の ID（10759 等）を持たず、`/discover/movie` にそのまま渡すと 0 件になる
 * （2026-10-04 実測: `with_genres=16,10759` → 0 件）
 */
const TV_TO_MOVIE_GENRES: Readonly<Record<number, readonly number[]>> = {
  10759: [28, 12], // アクション・冒険 → アクション / アドベンチャー
  10765: [878, 14], // SF・ファンタジー → SF / ファンタジー
  10768: [10752], // 戦争・政治 → 戦争
  10762: [10751], // キッズ → ファミリー（映画にキッズは無い）
};

/**
 * 映画側で同じ意味になるジャンル ID（1 件以上）。映画と共通の ID はそのまま返す。
 *
 * 複数ある場合は OR の意味。TMDb の `with_genres` は `16,28|12` のように AND と OR を
 * 混ぜても OR にならない（`16,28` と同じ件数が返る。2026-10-04 実測）ため、
 * 呼び出し側でジャンルごとに取って合わせること
 */
export function movieGenreIdsFor(genreId: number): readonly number[] {
  return TV_TO_MOVIE_GENRES[genreId] ?? [genreId];
}
