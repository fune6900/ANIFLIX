import { NextRequest, NextResponse } from "next/server";
import { searchMovieKeyword } from "@/lib/anime-search";

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
    // 揺らぎ吸収 + AniList フォールバック
    const data = await searchMovieKeyword(query);
    return NextResponse.json(
      { results: data.results, total_results: data.totalResults },
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
