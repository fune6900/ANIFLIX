import { NextRequest, NextResponse } from "next/server";
import { getAnimeSeasonEpisodes } from "@/lib/tmdb";

/**
 * シーズン番号の上限。
 *
 * getAnimeSeasonEpisodes はキャッシュ対象（DETAIL_CACHE_TIME）であり、
 * (animeId, season) の組み合わせがそのまま Data Cache のキーになる。
 * 存在しない ID の応答は TMDb が 404 を返すため Next はキャッシュしない
 * （next/dist/server/lib/patch-fetch.js の `res.status === 200` 判定）が、
 * 無意味に大きい season を素通しする理由も無いので上限を設ける。
 * 実在するアニメのシーズン数として 100 は十分に余裕がある。
 */
const MAX_SEASON_NUMBER = 100;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const animeId = parseInt(searchParams.get("animeId") ?? "", 10);
  const season = parseInt(searchParams.get("season") ?? "", 10);

  if (
    isNaN(animeId) ||
    isNaN(season) ||
    animeId <= 0 ||
    season < 0 ||
    season > MAX_SEASON_NUMBER
  ) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  try {
    const data = await getAnimeSeasonEpisodes(animeId, season);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch episodes" }, { status: 500 });
  }
}
