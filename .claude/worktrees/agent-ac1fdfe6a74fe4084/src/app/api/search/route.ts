import { NextRequest, NextResponse } from "next/server";
import { searchAnimeKeyword } from "@/lib/anime-search";

// 入力サニタイズ: HTMLタグ・危険文字除去、長さ制限
function sanitizeQuery(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "") // HTMLタグ除去（XSS対策）
    .replace(/[<>"'`]/g, "") // 残存する危険文字除去
    .replace(/[;\-\-]/g, "") // SQLインジェクション的パターン除去
    .trim()
    .slice(0, 100); // 最大100文字
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
      { results: [], total_results: 0, page: 1, total_pages: 0 },
      { headers: SECURITY_HEADERS },
    );
  }

  const query = sanitizeQuery(rawQuery);
  if (query.length < 1) {
    return NextResponse.json(
      { results: [], total_results: 0, page: 1, total_pages: 0 },
      { headers: SECURITY_HEADERS },
    );
  }

  try {
    // 揺らぎ吸収（getSearchTitleVariants）+ AniList フォールバックで部分一致を強化
    const data = await searchAnimeKeyword(query, 1);
    return NextResponse.json(
      {
        results: data.results,
        total_results: data.totalResults,
        page: 1,
        total_pages: data.totalPages,
      },
      { headers: SECURITY_HEADERS },
    );
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "検索に失敗しました" },
      { status: 500, headers: SECURITY_HEADERS },
    );
  }
}
