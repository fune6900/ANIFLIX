import { NextRequest, NextResponse } from "next/server";
import { isJapaneseAnimeMovie, searchMovie } from "@/lib/tmdb";

function sanitizeQuery(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`]/g, "")
    .trim()
    .slice(0, 100);
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store, no-cache",
  "X-Frame-Options": "DENY",
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawQuery = searchParams.get("q") ?? "";

  if (!rawQuery) {
    return NextResponse.json(
      { results: [], total_results: 0 },
      { headers: SECURITY_HEADERS },
    );
  }

  const query = sanitizeQuery(rawQuery);
  if (query.length < 1) {
    return NextResponse.json(
      { results: [], total_results: 0 },
      { headers: SECURITY_HEADERS },
    );
  }

  try {
    const data = await searchMovie(query);
    // 日本のアニメ映画に厳密に絞り込む（実写・洋画の混入を排除）
    const results = data.results.filter(isJapaneseAnimeMovie);
    return NextResponse.json(
      { ...data, results, total_results: results.length },
      { headers: SECURITY_HEADERS },
    );
  } catch (err) {
    console.error("Movie search error:", err);
    return NextResponse.json(
      { error: "検索に失敗しました" },
      { status: 500, headers: SECURITY_HEADERS },
    );
  }
}
