import { NextRequest, NextResponse } from "next/server";
import {
  searchPerson,
  getJapaneseVoiceActors,
  isJapaneseVoiceActor,
} from "@/lib/tmdb";

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

  // クエリなし → 日本の声優一覧（ページング）
  if (!rawQuery) {
    const page = Math.max(
      1,
      parseInt(searchParams.get("page") ?? "1", 10) || 1,
    );
    try {
      const data = await getJapaneseVoiceActors(page);
      return NextResponse.json(data, { headers: securityHeaders });
    } catch {
      return NextResponse.json(
        { error: "取得に失敗しました" },
        { status: 500, headers: securityHeaders },
      );
    }
  }

  const query = sanitizeQuery(rawQuery);

  if (query.length < 1) {
    return NextResponse.json(
      { results: [], total_results: 0, page: 1, total_pages: 0 },
      { headers: securityHeaders },
    );
  }

  try {
    const data = await searchPerson(query);

    // 日本の声優・俳優のみに限定し、Acting 部門 or 一定人気を優先・人気順
    const actors = data.results
      .filter(isJapaneseVoiceActor)
      .filter((p) => p.known_for_department === "Acting" || p.popularity > 1)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 10);

    return NextResponse.json(
      { ...data, results: actors },
      { headers: securityHeaders },
    );
  } catch (error) {
    console.error("Voice actor search error:", error);
    return NextResponse.json(
      { error: "検索に失敗しました" },
      { status: 500, headers: securityHeaders },
    );
  }
}
