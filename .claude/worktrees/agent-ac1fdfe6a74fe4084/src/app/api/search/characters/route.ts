import { NextRequest, NextResponse } from "next/server";
import { searchAniListCharacters } from "@/lib/anilist";

// 入力サニタイズ: HTMLタグ・危険文字除去、長さ制限（既存 /api/search 規約踏襲）
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
    return NextResponse.json({ results: [] }, { headers: SECURITY_HEADERS });
  }

  const query = sanitizeQuery(rawQuery);
  if (query.length < 1) {
    return NextResponse.json({ results: [] }, { headers: SECURITY_HEADERS });
  }

  try {
    const results = await searchAniListCharacters(query);
    return NextResponse.json({ results }, { headers: SECURITY_HEADERS });
  } catch (error) {
    console.error("[/api/search/characters]", error);
    return NextResponse.json(
      { error: "キャラクター検索に失敗しました" },
      { status: 500, headers: SECURITY_HEADERS },
    );
  }
}
