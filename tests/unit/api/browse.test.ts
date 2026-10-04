// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { TMDbAnime } from "@/types/tmdb";
import { findGenre, genreKeywordIds } from "@/lib/genres";

/**
 * `/api/browse?type=genre`（無限スクロールのジャンル一覧）。
 * キーワード由来のジャンルは固定のキーワード ID で引く（#99）。
 * `@/lib/tmdb` は自前の lib なのでモックする。
 */

function anime(id: number): TMDbAnime {
  return {
    id,
    name: `作品${id}`,
    original_name: `Work ${id}`,
    overview: "",
    poster_path: `/p${id}.jpg`,
    backdrop_path: null,
    first_air_date: "2020-04-01",
    vote_average: 7,
    vote_count: 10,
    genre_ids: [16],
    origin_country: ["JP"],
  };
}

const response = () => ({
  page: 1,
  total_pages: 3,
  total_results: 60,
  results: [anime(1)],
});

const getAnimeByKeyword = vi.fn(async (..._a: unknown[]) => response());
const getAnimeByGenre = vi.fn(async (..._a: unknown[]) => response());
const getAnimeByKeywords = vi.fn(async (..._a: unknown[]) => response());
const resolveKeywordId = vi.fn(async (..._a: unknown[]) => 1);

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getAnimeByKeyword: (...a: unknown[]) => getAnimeByKeyword(...a),
  getAnimeByGenre: (...a: unknown[]) => getAnimeByGenre(...a),
  getAnimeByKeywords: (...a: unknown[]) => getAnimeByKeywords(...a),
  resolveKeywordId: (...a: unknown[]) => resolveKeywordId(...a),
}));

const { GET } = await import("@/app/api/browse/route");

function call(query: string) {
  return GET(new NextRequest(`http://localhost/api/browse?${query}`));
}

afterEach(() => {
  getAnimeByKeyword.mockClear();
  getAnimeByGenre.mockClear();
  getAnimeByKeywords.mockClear();
  resolveKeywordId.mockClear();
});

describe("/api/browse?type=genre", () => {
  it("キーワード由来のジャンルは固定のキーワード ID で引き、名前の検索はしない", async () => {
    const mecha = findGenre(9002);
    if (!mecha) throw new Error("メカ・ロボットが定義に無い");

    const res = await call("type=genre&genreId=9002&page=2");

    expect(res.status).toBe(200);
    expect(getAnimeByKeyword).toHaveBeenCalledWith(genreKeywordIds(mecha), 2);
    expect(getAnimeByKeywords).not.toHaveBeenCalled();
    expect(resolveKeywordId).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.items.map((i: { href: string }) => i.href)).toEqual([
      "/anime/1",
    ]);
  });

  it("TMDb ジャンルはジャンル ID で引く", async () => {
    await call("type=genre&genreId=35");

    expect(getAnimeByGenre).toHaveBeenCalledWith(35, 1);
    expect(getAnimeByKeyword).not.toHaveBeenCalled();
  });

  it("定義に無いジャンル ID は 400（TMDb を呼ばない）", async () => {
    const res = await call("type=genre&genreId=12345");

    expect(res.status).toBe(400);
    expect(getAnimeByGenre).not.toHaveBeenCalled();
    expect(getAnimeByKeyword).not.toHaveBeenCalled();
  });
});
