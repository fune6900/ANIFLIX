# コーディング規約

## TypeScript

- `any` 使用禁止。`unknown` で受けて型ガードする
- `as` キャストは最終手段。使う場合はコメントで理由を明記する
- 型は `src/types/` に集約する。インライン型定義は小規模な場合のみ許可
- 外部 API レスポンス型は `src/types/tmdb.ts` に書く

```ts
// OK
export interface TMDbAnime {
  id: number;
  name: string;
  vote_average: number;
  // ...
}

// NG
const data: any = await fetch(...).then(r => r.json());
```

---

## 命名規則

| 対象                         | 規則               | 例                      |
| ---------------------------- | ------------------ | ----------------------- |
| コンポーネント               | PascalCase         | `ContentRow.tsx`        |
| 関数・変数                   | camelCase          | `getAnimeDetail()`      |
| 定数                         | UPPER_SNAKE_CASE   | `ANIMATION_GENRE_ID`    |
| 型・インターフェース         | PascalCase         | `TMDbAnime`             |
| ファイル（コンポーネント）   | PascalCase.tsx     | `HeroSection.tsx`       |
| ファイル（lib / types など） | kebab-case or 単語 | `tmdb.ts`, `seasons.ts` |
| Route Handler                | `route.ts`         | `api/search/route.ts`   |
| 動的セグメント               | `[name]`           | `anime/[id]/page.tsx`   |

---

## ファイル・ディレクトリ構造

実態に合わせる。勝手に `(public)` / `(auth)` のようなグループを切らない。

```
src/
  app/
    layout.tsx                  ルートレイアウト
    page.tsx                    ホーム
    globals.css
    anime/[id]/page.tsx         アニメ詳細
    movie/[id]/page.tsx         映画詳細
    voice-actors/page.tsx       声優一覧
    voice-actors/[id]/page.tsx  声優詳細
    search/page.tsx             検索
    browse/                     カテゴリ別ブラウズ
    api/                        Route Handlers
  components/                   UI コンポーネント（Navbar, ContentRow, …）
  lib/                          TMDb クライアント・ドメイン定義（genres / eras / seasons / studios / device）
  types/                        TMDb API 型定義
```

> 現状 `src/hooks/` / `src/services/` は未使用。導入は ISSUE を起票してから。

---

## コンポーネント設計

- **Server Component を原則**とし、インタラクティブな部分のみ `"use client"` を付与する
- `props` の型は必ずインターフェースで定義する（インライン型は禁止）
- コンポーネントは単一責任。1コンポーネント = 1つの関心事
- 既存の Tailwind トークン（`#141414` 背景、`#E50914` レッド、`#54b9c5` シアン）を流用する

```tsx
// OK
interface ContentRowProps {
  title: string;
  items: ContentRowItem[];
  allHref?: string;
}
export default function ContentRow({ title, items, allHref }: ContentRowProps) { ... }

// NG
export default function ContentRow(props: any) { ... }
```

---

## TMDb 連携

- TMDb 呼び出しは **必ず `src/lib/tmdb.ts` 経由**。コンポーネントから直接 `fetch("https://api.themoviedb.org/...")` しない
- 画像 URL は `getImageUrl(path, size)` を使う。`image.tmdb.org` 直 URL の散在禁止
- `next/image` の `unoptimized: true` を維持する。Vercel 画像変換枠を消費しない
- キャッシュ秒数 `cacheTime` は `fetchTMDb` の第3引数で明示する。トレーラー候補のように頻繁に変わらないものは 3600 以上、検索系は 0（`no-store`）

---

## Route Handler の規約

- ファイル名は `route.ts`
- URL クエリは **必ずサニタイズ・型検証**してから外部 API へ渡す
- レスポンスにはセキュリティヘッダー（`X-Content-Type-Options`, `X-Frame-Options`, `Cache-Control`）を付ける
- エラー時は `{ error: "..." }` + 適切なステータスを返す

詳細: `@.claude/rules/api-design.md`

---

## 禁止事項

- `console.log` をプロダクションコードに残す（デバッグ後は必ず削除）
- `TODO` コメントをコミットに含める（ISSUE に起票してから削除する）
- `.env` 系ファイルをコミットする
- `any` の使用
- ホームの段組やジャンル定義を `lib/genres.ts` / `lib/eras.ts` 経由でなく直書きする
- TMDb の `api_key` / `access_token` をコードに直書きする
- `next/image` の `unoptimized: false` への変更（TMDb は最適化済み）
- テストなしの機能実装（テスト基盤導入後は `/review-pr` で弾く）
- デフォルトエクスポート（`export default`）を components 以外で使う
