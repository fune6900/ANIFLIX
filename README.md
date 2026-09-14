# ANIFLIX

NetflixのUI/UXを模倣したアニメ・声優発見プラットフォームです。「アニメ」+「Netflix」を組み合わせたネーミングで、日本語UIで構築されています。

---

## 技術スタック

| 分野 | 技術 |
|------|------|
| フレームワーク | Next.js 15 (App Router) |
| UI | React 19 + TypeScript 5 |
| スタイリング | Tailwind CSS |
| データソース | TMDb API (映画・TVデータベース) |
| デプロイ | Cloudflare Workers (`@opennextjs/cloudflare`) / Docker Compose（開発用） |

---

## ディレクトリ構成

```
src/
├── app/
│   ├── layout.tsx            # ルートレイアウト（Navbar・Footer含む）
│   ├── page.tsx              # ホームページ（TMDb APIからリアルタイム取得）
│   ├── globals.css           # グローバルスタイル
│   ├── api/
│   │   └── search/
│   │       └── route.ts      # 検索APIルート（サニタイズ・日本アニメフィルタ）
│   ├── search/
│   │   └── page.tsx          # 検索結果ページ
│   └── anime/
│       └── [id]/
│           └── page.tsx      # アニメ詳細ページ
├── components/
│   ├── Navbar.tsx            # ナビゲーション・検索バー（スクロール連動背景変化）
│   ├── HeroSection.tsx       # メインビジュアル（進撃の巨人 The Final Season）
│   ├── ContentRow.tsx        # 横スクロールのアニメカード列
│   └── SearchDropdown.tsx    # インクリメンタル検索ドロップダウン
├── lib/
│   └── tmdb.ts               # TMDb APIクライアント（Bearer/APIキー両対応）
└── types/
    └── tmdb.ts               # TypeScript型定義
```

---

## 主な機能

### ホームページ
TMDb APIから並行フェッチして3つのセクションを動的表示します（APIキー未設定時は非表示）。

- **🔥 今期人気アニメ TOP10** - 日本アニメーション・人気順
- **📈 今週のトレンド** - 週間トレンドから日本アニメを抽出
- **🆕 新着アニメ** - 直近3ヶ月の新着
- **🎤 人気声優** - ハードコードされた声優カード（花江夏樹、悠木碧など6名）

### 検索機能
- **Navbar インクリメンタル検索** - 300msデバウンスでリアルタイム候補表示（最大8件）
- **検索ページ** (`/search?q=...`) - グリッド形式で全件表示
- **検索APIルート** (`/api/search`) - XSS・入力サニタイズ、日本アニメ優先フィルタ、セキュリティヘッダー付き

### アニメ詳細ページ (`/anime/[id]`)
- バックドロップ画像によるヒーロービジュアル
- タイトル・評価スコア・ジャンル・放送ステータス・シーズン数・話数
- キャスト・声優一覧（最大12名）
- シーズン一覧（ポスター・話数・放映年）

### その他
- **Navbar** - スクロール連動で背景変化、モバイルハンバーガーメニュー、通知アイコン
- **ContentRow** - ホバーで詳細パネル（再生・追加・展開ボタン）、左右スクロール矢印

---

## デザインの特徴

- メインカラー: `#141414`（黒）、`#E50914`（Netflixレッド）
- フォント: Netflix Sans / Helvetica Neue
- ホバーエフェクト、スムーズスクロール、カスタムスクロールバー非表示
- レスポンシブ対応（モバイル・タブレット・デスクトップ）

---

## セットアップ

### 環境変数

`.env.local.example` を参考に `.env.local` を作成してください。

```env
# 方式1: API Read Access Token（推奨）
TMDB_ACCESS_TOKEN=your_tmdb_read_access_token_here

# 方式2: API Key (v3)（どちらか一方でOK）
# TMDB_API_KEY=your_tmdb_api_key_here
```

TMDb APIキー / アクセストークンは [https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) から取得できます。

> 認証情報が未設定の場合、ホームページのアニメセクション（声優カードを除く）は表示されません。

### ローカル開発

```bash
npm install
npm run dev
```

### Docker

```bash
docker-compose up
```

アプリケーションは `http://localhost:3000` で起動します。

### NPMスクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー起動 |
| `npm run lint` | ESLintによるコード検査 |
| `npm run preview` | OpenNextでビルドし、ローカルのworkerd上で本番同等の動作確認 |
| `npm run deploy` | OpenNextでビルドし、Cloudflare Workersへデプロイ |
| `npm run cf-typegen` | `wrangler.jsonc` のバインディング型を `cloudflare-env.d.ts` に生成（任意） |

---

## デプロイ（Cloudflare Workers）

デプロイ先は Cloudflare Workers + Static Assets です。
アダプタには [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) を使用します
（`@cloudflare/next-on-pages` は deprecated であり Next.js 13/14 のみ対応のため採用していません）。

### 初回セットアップ

```bash
# 1. Cloudflare にログイン
npx wrangler login

# 2. Incremental Cache 用の R2 バケットを作成
npx wrangler r2 bucket create aniflex-inc-cache

# 3. 本番シークレットを登録
npx wrangler secret put TMDB_ACCESS_TOKEN
npx wrangler secret put ANNICT_ACCESS_TOKEN
npx wrangler secret put DEEPL_API_KEY

# 4. ローカル実行用に .dev.vars を用意（.env.local と同じ値を入れる）
cp .dev.vars.example .dev.vars
```

### ローカルでの本番同等プレビュー

```bash
npm run preview
```

`next dev` は `.env.local` を読みますが、workerd 上で動く `npm run preview` は `.dev.vars` を読みます。
両方に同じ値を入れておいてください。

> Durable Object バインディング（`NEXT_CACHE_DO_QUEUE`）はローカルでは動作しません。
> ISR のバックグラウンド再生成は本番環境で確認してください。

### デプロイ

`main` ブランチへのマージで GitHub Actions が自動デプロイします。
手動で実行する場合:

```bash
npm run deploy
```

CI に必要なリポジトリ Secrets:
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` / `TMDB_ACCESS_TOKEN` / `ANNICT_ACCESS_TOKEN` / `DEEPL_API_KEY`

> `/browse/airing` などの静的ページはビルド時に TMDb / AniList を呼び出すため、
> ビルド段階でも認証情報が必要です。

### キャッシュ構成

| 項目 | バインディング | 用途 |
|------|----------------|------|
| Incremental Cache | `NEXT_INC_CACHE_R2_BUCKET` (R2) | SSG/ISR ページと `fetch` データキャッシュの保存先 |
| Revalidation Queue | `NEXT_CACHE_DO_QUEUE` (Durable Object) | 時間ベース再生成の重複排除つきキュー |

`revalidateTag` / `revalidatePath` を使用していないため Tag Cache は設定していません。

### `npm run cf-typegen` について

アプリケーションコードは `getCloudflareContext()` を使っていないため、通常は実行不要です。
生成される `cloudflare-env.d.ts` は次の理由からコミットせず、`.gitignore` と `tsconfig.json` の
`exclude` の両方で除外しています。

- ビルド成果物である `.open-next/worker` を参照するため、未ビルドの環境では型解決に失敗する
- workerd のランタイム型をグローバルに持ち込み、`Response.json()` の戻り値が `unknown` になって
  既存のクライアントコンポーネントの型検査が壊れる

将来 Cloudflare バインディングをアプリケーションコードから直接触る場合は、
`tsconfig.json` の `exclude` から外したうえで影響範囲を確認してください。

---

## ライセンス

© 2025 ANIFLIX
