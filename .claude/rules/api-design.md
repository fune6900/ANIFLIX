# API 設計ルール

ANIFLIX は **Route Handlers + TMDb クライアント関数** で構成される。
DB を持たないため Server Actions は使わない（書き込みが発生したら検討）。

---

## レイヤー構造

```
┌─────────────────────────────────────┐
│  Server Component / Client          │  ← UI 層
│   src/app/**/page.tsx               │
│   src/components/**.tsx             │
└──────────┬──────────────────────────┘
           │ import
           ↓
┌─────────────────────────────────────┐
│  TMDb クライアント関数              │  ← データアクセス層
│   src/lib/tmdb.ts                   │
│   （fetchTMDb / getAnimeDetail …）  │
└──────────┬──────────────────────────┘
           │ HTTPS
           ↓
        TMDb API

別経路（クライアント側からの fetch 用）:
┌─────────────────────────────────────┐
│  Route Handler                      │
│   src/app/api/**/route.ts           │
│   → 内部で fetchTMDb / 他 lib を呼ぶ│
└─────────────────────────────────────┘
```

- Server Component は `src/lib/tmdb.ts` の関数を直接呼ぶ
- クライアントコンポーネントは `fetch("/api/...")` で Route Handler を経由する（TMDb キー漏洩防止）

---

## Route Handler の規約

### ファイル配置

```
src/app/api/
  search/route.ts             GET /api/search?q=
  search/movies/route.ts      GET /api/search/movies?q=
  voice-actors/route.ts       GET /api/voice-actors?q=&page=
  videos/route.ts             GET /api/videos?id=
  season-episodes/route.ts    GET /api/season-episodes?animeId=&season=
  browse/route.ts             GET /api/browse?type=&...
```

### テンプレート

```ts
import { NextRequest, NextResponse } from "next/server";
import { searchAnime } from "@/lib/tmdb";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store, no-cache",
};

function sanitizeQuery(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`]/g, "")
    .trim()
    .slice(0, 100);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawQuery = searchParams.get("q") ?? "";

  // 1. 入力検証
  if (!rawQuery) {
    return NextResponse.json({ results: [] }, { headers: SECURITY_HEADERS });
  }
  const query = sanitizeQuery(rawQuery);
  if (query.length < 1) {
    return NextResponse.json({ results: [] }, { headers: SECURITY_HEADERS });
  }

  // 2. データ取得
  try {
    const data = await searchAnime(query);
    return NextResponse.json(data, { headers: SECURITY_HEADERS });
  } catch (error) {
    console.error("[/api/search]", error);
    return NextResponse.json(
      { error: "検索に失敗しました" },
      { status: 500, headers: SECURITY_HEADERS },
    );
  }
}
```

### HTTP メソッドとステータスコード

| 操作       | メソッド | 成功時ステータス |
| ---------- | -------- | ---------------- |
| 一覧取得   | GET      | 200              |
| 詳細取得   | GET      | 200              |
| 入力不正   | -        | 400              |
| 認証必要   | -        | 401              |
| 未存在     | -        | 404              |
| 内部エラー | -        | 500              |

書き込み系（POST/PUT/PATCH/DELETE）は現状なし。導入時にこの表を更新する。

---

## TMDb クライアント関数（`src/lib/tmdb.ts`）

- 全エンドポイントは関数として書き出す。コンポーネントから直接 `fetch` しない
- `fetchTMDb<T>(endpoint, params, cacheTime)` を経由する
- 認証は `resolveAuth()` のみが担当する（Bearer / v3 自動判別）
- `language=ja-JP` を自動付与
- 失敗時は `throw` する（呼び出し側で `try/catch` または `Promise.allSettled` する）

```ts
// OK
export async function getAnimeDetail(id: number): Promise<TMDbTVDetail> {
  return fetchTMDb<TMDbTVDetail>(`/tv/${id}`, {
    append_to_response: "credits",
  });
}

// NG: コンポーネントから直接叩く
const data = await fetch("https://api.themoviedb.org/3/tv/1");
```

### キャッシュ秒数の目安

| 用途                     | `cacheTime` | 理由                         |
| ------------------------ | ----------- | ---------------------------- |
| 検索 (`/search/*`)       | 0           | リアルタイム性重視           |
| 一覧 (`/discover/*`)     | 0           | ホームでランダム表示するため |
| 詳細 (`/tv/{id}` etc.)   | 0 〜 3600   | 内容更新を反映               |
| 動画 (`/tv/{id}/videos`) | 3600        | OP/ED は頻繁に変わらない     |
| 外部 ID                  | 86400       | ほぼ不変                     |
| キーワード ID 解決       | 86400       | TMDb 側でほぼ不変            |

---

## エンドポイント命名（Route Handler）

- リソース名は複数形・名詞（動詞は使わない）
- パスはケバブケース
- 既存命名: `/api/search`, `/api/search/movies`, `/api/voice-actors`, `/api/videos`, `/api/season-episodes`, `/api/browse`

```
/api/voice-actors    ✅
/api/season-episodes ✅
/api/getVideos       ❌ 動詞
/api/season_episodes ❌ スネークケース
```

---

## エラーハンドリング

- エラーは `{ error: "..." }` で返す。例外を握りつぶさない
- エラーメッセージにスタックトレースや TMDb の内部詳細を含めない
- ログには詳細を出すが、レスポンスは汎用メッセージ

```ts
try {
  const result = await fetchTMDb(...);
  return NextResponse.json(result, { headers: SECURITY_HEADERS });
} catch (error) {
  console.error("[API Error]", error);
  return NextResponse.json(
    { error: "データの取得に失敗しました" },
    { status: 500, headers: SECURITY_HEADERS }
  );
}
```

---

## `/review-pr` でのチェック項目

- [ ] Route Handler で入力サニタイズ（`sanitizeQuery` 等）を行っているか
- [ ] レスポンスにセキュリティヘッダーが付いているか
- [ ] TMDb 呼び出しが `fetchTMDb()` 経由になっているか（直 `fetch` 禁止）
- [ ] エラーレスポンスに内部情報（スタックトレース等）を含めていないか
- [ ] HTTP メソッドとステータスコードが規約に従っているか
- [ ] キャッシュ秒数が用途に適しているか
- [ ] エンドポイントのテスト（基盤導入後）が存在するか
