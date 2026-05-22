import { NextRequest, NextResponse } from "next/server";
import { isJapaneseAnimeTV, searchAnime } from "@/lib/tmdb";
import { getSearchTitleVariants } from "@/lib/title-strip";
import type { TMDbAnime } from "@/types/tmdb";

// 入力サニタイズ: HTMLタグ・危険文字除去、長さ制限
function sanitizeQuery(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "") // HTMLタグ除去（XSS対策）
    .replace(/[<>"'`]/g, "") // 残存する危険文字除去
    .replace(/[;\-\-]/g, "") // SQLインジェクション的パターン除去
    .trim()
    .slice(0, 100); // 最大100文字
}

export async function GET(request: NextRequest) {
  // セキュリティヘッダー
  const securityHeaders = {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store, no-cache",
    "X-Frame-Options": "DENY",
  };

  const { searchParams } = request.nextUrl;
  const rawQuery = searchParams.get("q") ?? "";

  if (!rawQuery) {
    return NextResponse.json(
      { results: [], total_results: 0, page: 1, total_pages: 0 },
      { headers: securityHeaders },
    );
  }

  const query = sanitizeQuery(rawQuery);

  // サニタイズ後が空、または1文字未満は弾く
  if (query.length < 1) {
    return NextResponse.json(
      { results: [], total_results: 0, page: 1, total_pages: 0 },
      { headers: securityHeaders },
    );
  }

  try {
    const variants = getSearchTitleVariants(query);
    const allResults: TMDbAnime[] = [];
    const seenIds = new Set<number>();

    for (const variant of variants) {
      const data = await searchAnime(variant);
      for (const item of data.results.filter(isJapaneseAnimeTV)) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allResults.push(item);
        }
      }
    }

    return NextResponse.json(
      {
        results: allResults,
        total_results: allResults.length,
        page: 1,
        total_pages: 1,
      },
      { headers: securityHeaders },
    );
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "検索に失敗しました" },
      { status: 500, headers: securityHeaders },
    );
  }
}
