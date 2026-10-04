import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TMDbCastMember } from "@/types/tmdb";

/**
 * TMDb の credits を横断集約する（`@/lib/seasonal-cast`）。
 * `@/lib/tmdb` は自前の lib なのでモックする。
 */

function cast(
  id: number,
  order: number,
  character = `役${id}`,
): TMDbCastMember {
  return {
    id,
    name: `声優${id}`,
    original_name: `Seiyuu ${id}`,
    character,
    profile_path: null,
    order,
  };
}

const tmdb = {
  getAnimeCredits: vi.fn(async (id: number) => ({
    cast: [cast(1, 0, `主人公${id}`), cast(id, 1)],
  })),
  getMovieCredits: vi.fn(async (id: number) => {
    if (id === 3) throw new Error("boom");
    return { cast: [cast(1, 2, `映画の役${id}`), cast(id, 0), cast(99, 20)] };
  }),
};

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb")>();
  return { ...actual, ...tmdb };
});

const { aggregateSeasonalCast, aggregateMovieCast } =
  await import("@/lib/seasonal-cast");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("aggregateSeasonalCast", () => {
  it("TV 作品の credits を出演本数順に集約する", async () => {
    const result = await aggregateSeasonalCast([10, 20]);

    expect(tmdb.getAnimeCredits).toHaveBeenCalledTimes(2);
    expect(result[0]).toMatchObject({ id: 1, appearances: 2, bestOrder: 0 });
    expect(result.map((c) => c.id)).toEqual([1, 10, 20]);
  });
});

describe("aggregateMovieCast", () => {
  it("映画の credits を集約する。失敗した作品は飛ばし、出演順の遅いキャストは落とす", async () => {
    const result = await aggregateMovieCast([2, 3, 4]);

    expect(tmdb.getMovieCredits).toHaveBeenCalledTimes(3);
    expect(tmdb.getAnimeCredits).not.toHaveBeenCalled();
    expect(result.map((c) => c.id)).toEqual([1, 2, 4]);
    expect(result[0]).toMatchObject({ appearances: 2, bestOrder: 2 });
  });
});
