import { fetchTMDb } from "@/lib/tmdb";
import { isPreviewMediaType } from "@/lib/video-preview";
import { NextRequest, NextResponse } from "next/server";

interface TMDbVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

interface TMDbVideosResponse {
  id: number;
  results: TMDbVideo[];
}

const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

/** 失敗応答はキャッシュさせない */
const ERROR_HEADERS = {
  ...BASE_HEADERS,
  "Cache-Control": "no-store, no-cache",
};

/** トレーラーはほぼ変わらないため、成功応答はブラウザに 1 時間持たせる */
const OK_HEADERS = { ...BASE_HEADERS, "Cache-Control": "public, max-age=3600" };

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  // type は TMDb のパスに乗るためホワイトリスト照合する。無指定は TV（既存の呼び出し）
  const rawType = req.nextUrl.searchParams.get("type") ?? "tv";

  if (!id || !/^\d{1,10}$/.test(id) || !isPreviewMediaType(rawType)) {
    return NextResponse.json(
      { key: null },
      { status: 400, headers: ERROR_HEADERS },
    );
  }

  try {
    const data = await fetchTMDb<TMDbVideosResponse>(
      `/${rawType}/${id}/videos`,
      {},
      3600,
    );

    // YouTube 動画を優先度順に選択:
    // 公式トレーラー > 公式ティーザー > トレーラー > オープニング > その他
    const yt = data.results.filter((v) => v.site === "YouTube");
    const pick =
      yt.find((v) => v.official && v.type === "Trailer") ??
      yt.find((v) => v.official && v.type === "Teaser") ??
      yt.find((v) => v.type === "Trailer") ??
      yt.find((v) => v.type === "Opening Credits") ??
      yt[0] ??
      null;

    return NextResponse.json(
      { key: pick?.key ?? null },
      { headers: OK_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { key: null },
      { status: 500, headers: ERROR_HEADERS },
    );
  }
}
