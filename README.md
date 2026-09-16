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
| デプロイ | Docker / Docker Compose |

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

---

## ライセンス

© 2025 ANIFLIX
