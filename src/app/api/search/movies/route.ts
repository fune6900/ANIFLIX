import { NextRequest, NextResponse } from "next/server";
import { isJapaneseAnimeMovie, searchMovie } from "@/lib/tmdb";
import { getSearchTitleVariants } from "@/lib/title-strip";
import type { TMDbMovie } from "@/types/tmdb";

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
    const variants = getSearchTitleVariants(query);
    const allResults: TMDbMovie[] = [];
    const seenIds = new Set<number>();

    for (const variant of variants) {
      const data = await searchMovie(variant);
      for (const item of data.results.filter(isJapaneseAnimeMovie)) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allResults.push(item);
        }
      }
    }

    return NextResponse.json(
      { results: allResults, total_results: allResults.length },
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
