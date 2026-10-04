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
  middleware.ts                 認証ガード（全ルート）
  auth.ts                       Auth.js 設定
  app/
    layout.tsx                  ルートレイアウト
    page.tsx                    ホーム
    globals.css
    anime/[id]/page.tsx         アニメ詳細
    movie/[id]/page.tsx         映画詳細
    voice-actors/page.tsx       声優ホーム（Hero + 特集の行）
    voice-actors/collections/[slug]/page.tsx  声優の行の「すべて見る」
    voice-actors/[id]/page.tsx  声優詳細
    search/page.tsx             旧検索画面（?q= を search/anime へ redirect）
    search/anime/page.tsx       ヘッダー検索の結果画面（4 部門で components/SearchResults を共有）
    search/movies/page.tsx
    search/voice-actors/page.tsx
    search/characters/page.tsx
    browse/                     カテゴリ別ブラウズ
      movies/latest/            アニメ映画の最新作（「すべて見る」の専用ページ）
      movies/genre/[genreId]/   アニメ映画のジャンル別（「すべて見る」の専用ページ）
    login/                      ログイン画面・認証エラー画面
    actions/                    Server Actions（認証操作のみ）
    api/                        Route Handlers
  components/                   UI コンポーネント（Navbar, ContentRow, …）
  lib/                          TMDb クライアント・ドメイン定義（genres / eras / seasons / studios / device）
                                + 認証周辺（auth-routes / api-client / login-backdrops
                                / safe-callback-url / turnstile / turnstile-messages / login-action）
                                + 声優ホームの行（voice-actor-home）・定番シリーズ定義（franchises）
  types/                        TMDb / AniList / Turnstile / 声優ホームの型定義
```

> 現状 `src/hooks/` / `src/services/` は未使用。導入は ISSUE を起票してから。
> `src/app/actions/` は認証操作専用。他用途へ広げる場合は ISSUE を起票すること（`@.claude/rules/api-design.md`）。

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

## レイアウト幅（ウルトラワイド対応）

横方向の余白（ガター）は **`globals.css` の `.site-container` だけ**が持つ。
各ページ・各コンポーネントで `px-4 md:px-8 lg:px-12 …` の梯子を直書きしない。

```tsx
// OK
<div className="site-container pb-24">

// NG: 梯子の直書き（32 箇所に散っていたものを 1 箇所へ集約済み）
<div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
```

- **横幅の上限（`max-w-[1920px]` 等）を付けない**。上限を付けると 2560px /
  3440px の画面で左右に数百 px の死んだ余白ができる
- ブレークポイントは `3xl: 1920px` / `4xl: 2560px` / `5xl: 3200px`
  （`tailwind.config.ts`）。1920px 以下の見た目を変えないため、既存の段は触らない
- グリッドは 1920px を超えたら列数の固定をやめ、`auto-fill` に切り替える。
  `minmax()` の下限は **1920px 時点の列数を再現する値**を選ぶ（= ウルトラワイドでも
  カード 1 枚の大きさが変わらない）

```tsx
// ポスター一覧の例。3xl 以降は画面幅なりに列が増える
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 md:gap-4 xl:gap-5">
```

| 種類                     | `minmax` 下限 |
| ------------------------ | ------------- |
| ポスター一覧             | 300px         |
| 無限スクロールのポスター | 260px         |
| 検索結果の横長カード     | 500px         |
| キャラクター一覧         | 250px         |
| キャスト（丸アイコン）   | 190px         |
| 声優一覧（丸アイコン）   | 170px         |

固定幅の横スクローラ（`ContentRow` のカード等）は上限撤去だけで幅が埋まるが、
`4xl` / `5xl` の幅も併せて用意する。

### `1fr` トラックには上限を置く

`grid-cols-[320px_1fr]` のような任意値トラックは上限が無く、横幅の上限を撤去した後は
画面幅なりに伸び続ける。本文が入る列は **1920px 超（= `3xl`）から**縛ること。縛り方は 2 つ:

1. **上限を持つ祖先の内側に置く**（推奨）。詳細ページのヒーローは `.detail-block`
   （下の節）の内側にあるので `1fr` は 1440〜1600px で止まる。
   例: `src/app/characters/[id]/page.tsx` の
   `detail-block grid ... 3xl:grid-cols-[400px_1fr]`（1920px 超の段は画像列を広げる役）
2. **`minmax(0,Npx)` で直接縛る**。祖先に上限が無い場所で使う。
   例: `src/components/SeasonEpisodes.tsx` の `3xl:max-w-[1800px]` と同じ役目。
   `minmax(0,Npx)` は残り幅が `N` 以下なら `1fr` と同値に解決するため、
   既存の見た目を変えずに上限だけを足せる

祖先に上限を付けたなら `minmax(0,Npx)` は外すこと。どの幅でも効かない指定が残ると、
次に読む人間が根拠の消えた数字を信じる。
上限を `4xl` から置くと 1921〜2559px が無防備になり、2560px で本文列が逆に縮む
（幅の変化が単調でなくなる）。
死んだ余白を「1 行 300 文字の本文」に置き換えるだけでは直したことにならない。

### 詳細ページの本文は中央へ寄せる（`.detail-block`）

詳細ページ（`anime/[id]` / `movie/[id]` / `voice-actors/[id]` / `characters/[id]`）は
本文が左に寄って見える。ヒーロー（ポスター＋情報）・動画・あらすじには
`globals.css` の `.detail-block` を付けて中央へ寄せる。

```tsx
// ヒーロー: 中央寄せ + 上限
<div className="detail-block flex flex-col md:flex-row gap-6 md:gap-10 xl:gap-12">

// 一覧グリッド: 上限を付けない（画面幅いっぱい）
<div className="grid ... 3xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
```

- 上限は `2xl:1400px` → `3xl:1440px` → `4xl:1520px` → `5xl:1600px`。
  **画面幅に対して単調に増やす**（段ごとに狭めると画面を広げた瞬間に本文が縮む）
- 1535px 以下では上限が効かないため、既存の見た目は変わらない
- **キャスト・出演作・関連キャラの一覧グリッドには被せない**。あちらは幅いっぱいのまま
  埋める（`.site-container` の役目）。中央寄せは本文ブロックだけの話
- 上限は「ポスター + 本文の読み幅」に合わせる。上限を大きく取りすぎると、
  中央に寄せてもヒーローの内側で本文の右側が余り、左寄りに見えたままになる
- **`.detail-block` の内側で、上限を持つ要素に `mx-auto` を重ねない**。ブロックごと
  中央に寄っているのに中の要素だけ再度中央へ寄せると、見出しやサムネ列は左端のまま
  動画だけがずれる。3440px で 224px の食い違いになり、新しい「左寄り」を作ることになる。
  ポスターの `mx-auto md:mx-0` のように **1 カラムの帯だけで効く中央寄せは対象外**
  （その帯ではブロックに上限が無く、競合しない）

### 読み幅を縛る `max-w` はガター集約の対象外

本文の行長を抑える `max-w-3xl xl:max-w-4xl 3xl:max-w-5xl`（詳細ページのあらすじ）や、
フォーム 1 列を中央に置く `max-w-3xl`（`src/app/diagnosis/page.tsx`）は
**意図的な読み幅**であり、
`.site-container` に置き換えない。`.site-container` に寄せると 1920px 超で
逆に本文が狭くなる。

### フォームのフィールドは `auto-fill` を使う（`auto-fit` は使わない）

フィルターパネル（`src/components/BrowseFilterForm.tsx`）は
フィールド数が 2〜3 で固定。`auto-fill` は空トラックを残すので **フィールドの幅が
1920px 時点と同じまま**になる。`auto-fit` は空トラックを畳んで残りを引き伸ばすため、
3440px で `<select>` が 1000px を超える。パネルの背景が余るのは正しい挙動。

この契約は `tests/unit/ultrawide-layout.test.ts` で実行可能な形で固定してある。

---

## TMDb 連携

- TMDb 呼び出しは **必ず `src/lib/tmdb.ts` 経由**。コンポーネントから直接 `fetch("https://api.themoviedb.org/...")` しない
- 画像 URL は `getImageUrl(path, size)` を使う。`image.tmdb.org` 直 URL の散在禁止
- `next/image` の `unoptimized: true` を維持する。Vercel 画像変換枠を消費しない
- キャッシュ秒数 `cacheTime` は `fetchTMDb` の第3引数で明示する。トレーラー候補のように頻繁に変わらないものは 3600 以上、ユーザー入力によるキーワード検索は 0（`no-store`）
- discover 系（ジャンル列・新着・トレンド）は `DISCOVER_CACHE_TIME`（1800 秒）を使う。ランダム性は `randomPage()` が URL を変えること（= 別キャッシュエントリ）と、レンダリング時に走る `shuffle()` が担保するため、キャッシュを効かせても表示の多様性は失われない

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
- 横幅に固定上限（`max-w-[1920px]` 等）を付ける・ガターの梯子を直書きする（`.site-container` を使う）
- テストなしの機能実装（テスト基盤導入後は `/review-pr` で弾く）
- デフォルトエクスポート（`export default`）を components 以外で使う
