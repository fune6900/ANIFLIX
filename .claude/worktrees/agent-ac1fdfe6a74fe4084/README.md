# ANIFLIX

NetflixのUI/UXを模倣したアニメ・声優発見プラットフォームです。「アニメ」+「Netflix」を組み合わせたネーミングで、日本語UIで構築されています。

---

## 技術スタック

| 分野           | 技術                            |
| -------------- | ------------------------------- |
| フレームワーク | Next.js 15 (App Router)         |
| UI             | React 19 + TypeScript 5         |
| スタイリング   | Tailwind CSS                    |
| データソース   | TMDb API (映画・TVデータベース) |
| デプロイ       | Docker / Docker Compose         |

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

---

## 認証（Google ログイン）

bot によるクローリングで外部 API のクォータが消費されるのを防ぐため、**サイト全体を Google ログイン必須**にしています（Auth.js v5 / NextAuth）。DB を持たないため JWT セッションで、ユーザー情報は保存しません。

| ファイル                                  | 役割                                                         |
| ----------------------------------------- | ------------------------------------------------------------ |
| `src/auth.ts`                             | Auth.js の設定（プロバイダ・セッション・認可判定）           |
| `src/middleware.ts`                       | 全ルートのガード。除外パスは matcher で指定                  |
| `src/app/login/page.tsx`                  | ログイン画面                                                 |
| `src/app/login/error/page.tsx`            | 認証エラー画面                                               |
| `src/components/GoogleSignInButton.tsx`   | Google 公式ガイドライン準拠のログインボタン                  |
| `src/components/LoginBackdrop.tsx`        | ログイン画面の背景スライドショー                             |
| `src/lib/login-backdrops/`                | 背景に使う静的 JSON（5 パターン）                            |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth.js のエンドポイント                                     |
| `src/app/actions/auth.ts`                 | ログイン／ログアウト用 Server Action（Turnstile 検証もここ） |
| `src/components/LoginForm.tsx`            | ログインフォーム（Turnstile 通過まで送信を塞ぐ）             |
| `src/components/TurnstileWidget.tsx`      | Turnstile ウィジェット（explicit render）                    |
| `src/lib/turnstile.ts`                    | Turnstile の siteverify 呼び出し                             |
| `src/lib/turnstile-messages.ts`           | 検証失敗の理由 → 利用者向け文言                              |

### 必要な環境変数

```env
AUTH_SECRET=            # npx auth secret で生成。本番と開発で別の値を使う
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
# AUTH_TRUST_HOST=true  # Vercel 以外（Docker / 自前ホスト）では必須
```

### bot 対策（Cloudflare Turnstile）

`/login` は Middleware のガード対象外で、未認証のまま無制限に到達できる唯一のページです。
ログインフォームの送信に Cloudflare Turnstile（Managed モード）を挟み、Google の
OAuth フローへ到達する前に自動化された送信を落とします。

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/?to=/:account/turnstile) で
   ウィジェットを作成する（**Widget Mode: Managed**）
2. **開発用と本番用でウィジェットを分ける**。開発用のドメインに `localhost`、
   本番用のドメインに本番ドメインだけを登録する
3. 発行された Site Key / Secret Key を、環境ごとに上記 2 つへ設定する

> **同じウィジェットに `localhost` と本番ドメインを同居させないでください。**
> サイトキーは公開値なので、誰でも自分の `localhost` でチャレンジを解けます。
> ドメインを同居させると、そこで得たトークンを本番の siteverify に通せてしまいます。
> ウィジェットを分ければ、本番のシークレットは本番ドメイン発行のトークンしか受け付けません。

> **2 つは必ずセットで設定してください。** 片方だけだとログインできなくなります。

**未設定時の挙動**

| 環境                             | 挙動                                                              |
| -------------------------------- | ----------------------------------------------------------------- |
| 開発（`NODE_ENV != production`） | ウィジェットを表示せず、検証をスキップしてログインできる          |
| 本番                             | 検証を必ず失敗させる（設定漏れで bot 対策が無言で消えるのを防ぐ） |

> **`NEXT_PUBLIC_TURNSTILE_SITE_KEY` はビルド時にバンドルへ埋め込まれます。**
> 実行時に環境変数を足しても反映されないため、環境ごとにビルドし直してください。
> Docker では `docker build --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=...` で渡します。
> Vercel では Production / Preview の両方に登録してください。
> CI（`.github/workflows/ci.yml`）のビルドは検証専用のため未設定のままで構いませんが、
> CI の成果物をそのままデプロイする運用に変える場合は `env:` への追加が必須です。

**動作確認用の公式テストキー**

| ケース           | Site Key / Secret Key                                              |
| ---------------- | ------------------------------------------------------------------ |
| 常に成功         | `1x00000000000000000000AA` / `1x0000000000000000000000000000000AA` |
| 常に失敗         | `2x00000000000000000000AB` / `2x0000000000000000000000000000000AA` |
| 使用済みトークン | `1x00000000000000000000AA` / `3x0000000000000000000000000000000AA` |
| 強制チャレンジ   | `3x00000000000000000000FF` / 上記いずれか                          |

> 広告ブロッカーや企業プロキシが `challenges.cloudflare.com` を遮断すると
> ウィジェットが読み込めません。その場合は画面に案内を出しますが、
> 利用者からの問い合わせが発生しうる点は織り込んでおいてください。
> 将来 CSP を導入する場合は `script-src` / `frame-src` / `connect-src` に
> `https://challenges.cloudflare.com` の許可が必要です。

### Google Cloud Console の設定

1. 「API とサービス」→「OAuth 同意画面」で User Type を **External** にする
2. スコープは既定（`openid` / `email` / `profile`）のまま。追加しない
3. **アプリを公開**する。テストモードのままだと登録したテストユーザー（上限 100 人）しかログインできない
4. 「認証情報」→「OAuth クライアント ID」（ウェブアプリケーション）を作成し、以下を登録する
   - 承認済みの JavaScript 生成元: `http://localhost:3000` / `https://<本番ドメイン>`
   - 承認済みのリダイレクト URI: `http://localhost:3000/api/auth/callback/google` / `https://<本番ドメイン>/api/auth/callback/google`

> リダイレクト URI のパスは Auth.js の規約で固定です。1 文字でも違うと `redirect_uri_mismatch` で失敗します。

### ログイン画面の背景

`src/lib/login-backdrops/pattern-1.json` 〜 `pattern-5.json` に人気アニメのバックドロップ（16:9 の横長画像）を 6 件ずつ固定しています。ページ表示のたびに 1 パターンをサーバー側で抽選し、クロスフェードで流します。SP / PC とも同じ横長画像を `object-cover` で敷きます。

実行時に TMDb を叩かない設計です。ログイン画面は未認証で到達できるため、ここで外部 API を呼ぶと bot にクォータを消費させる余地が残ります。

内容を差し替える場合は、各 JSON の `source` フィールドに記録されたクエリで TMDb を叩き直し、`{ id, title, backdropPath }` の形で書き換えてください。

```
GET https://api.themoviedb.org/3/discover/tv
  ?language=ja-JP&with_genres=16&with_origin_country=JP
  &sort_by=popularity.desc&vote_count.gte=100&page=1..4
```

> `backdropPath` は TMDb の `backdrop_path` をそのまま保存します。URL 化は `getImageUrl()` を通してください（`image.tmdb.org` の直 URL をコード内に散らさないため）。

### 運用上の注意

- **静的アセットを追加したら matcher を更新する**。`public/` へファイルを置いたり `robots.txt` / `sitemap.xml` を追加した場合、`src/middleware.ts` の除外リストへ追記しないとログイン必須になり、利用者からは 404 やアイコン欠けに見えます
- **除外パターンには必ず境界（`$` または `/`）を付ける**。前方一致で終わらせると `login` の除外が `/logindq` まで通してしまい、存在しないページが未認証のまま描画されます（認可境界の穴）。ドットも `\.` でエスケープしてください
- **認証画面を増やすときは `src/lib/auth-routes.ts` の `AUTH_ROUTES` と matcher を対で更新する**。片方だけ変えると「ガードは外れているのにサイト共通の UI が出る」状態になります
- **`AUTH_SECRET` の変更 = 全ユーザー強制ログアウト**。JWT の署名鍵のため、ローテーション時は影響を織り込むこと
- **セッション有効期限は 7 日**（`src/auth.ts` の `SESSION_MAX_AGE`）。期限切れ後の `/api/*` へのリクエストには 401 JSON が返るため、クライアント側は `res.status === 401` で判定できます
- **Googlebot も遮断されます**。SEO と OGP 展開は機能しません（bot 遮断を優先した設計判断）

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

| コマンド            | 説明                                        |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | 開発サーバー起動                            |
| `npm run build`     | 本番ビルド                                  |
| `npm run start`     | 本番サーバー起動                            |
| `npm run lint`      | ESLintによるコード検査                      |
| `npm run typecheck` | 型チェック（`tsc --noEmit`）                |
| `npm test`          | Vitest（`npm test -- --run` で1回だけ実行） |

---

## ライセンス

© 2025 ANIFLIX
