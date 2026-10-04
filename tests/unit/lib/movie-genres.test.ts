import { describe, it, expect } from "vitest";
import { movieGenreIdsFor } from "@/lib/movie-genres";
import { ANIME_GENRES } from "@/lib/genres";

/**
 * TV 専用ジャンル ID → 映画ジャンル ID の読み替え（#90）。
 *
 * `ANIME_GENRES` の一部は TV 専用 ID（10759 等）で、`/discover/movie` に
 * そのまま渡すと 0 件になる（2026-10-04 実測: `16,10759` → 0 件）。
 */
describe("movieGenreIdsFor", () => {
  it("TV 専用ジャンルは映画のジャンルに読み替える", () => {
    expect(movieGenreIdsFor(10759)).toEqual([28, 12]);
    expect(movieGenreIdsFor(10765)).toEqual([878, 14]);
    expect(movieGenreIdsFor(10768)).toEqual([10752]);
    expect(movieGenreIdsFor(10762)).toEqual([10751]);
  });

  it("映画と共通のジャンルはそのまま返す", () => {
    expect(movieGenreIdsFor(35)).toEqual([35]);
    expect(movieGenreIdsFor(18)).toEqual([18]);
  });

  it("TMDb ジャンル由来の全ジャンルが 1 件以上の映画ジャンルを持つ", () => {
    for (const g of ANIME_GENRES.filter((x) => x.filterType === "genre")) {
      expect(movieGenreIdsFor(g.id).length, g.name).toBeGreaterThan(0);
    }
  });
});
