# セキュリティルール

コードレビュー（`/review-pr`）では必ずこのルールを照合すること。
違反が1件でもあれば重要度「高」として差し戻す。

---

## 入力サニタイズ

ANIFLIX には Zod が未導入。それまでは**手書きサニタイズ関数**で防御する。

```ts
// OK: 既存実装（src/app/api/search/route.ts 等）
function sanitizeQuery(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "") // HTML タグ除去（XSS 対策）
    .replace(/[<>"'`]/g, "") // 残存する危険文字除去
    .trim()
    .slice(0, 100); // 最大 100 文字
}

const query = sanitizeQuery(rawQuery);
if (query.length < 1) return NextResponse.json({ results: [] });
```

ルール:

- Route Handler に来る `searchParams` は **必ずサニタイズしてから使用**する
- 数値クエリは `parseInt` + `isNaN` チェック + 範囲制限を行う
- TMDb API へ渡す前に必ず検証する（外部 API へのインジェクション防止）

> Zod 導入後は、サニタイズ関数を Zod スキーマに置き換える。

---

## XSS 対策

- `dangerouslySetInnerHTML` の使用は原則禁止
- 使用する場合は DOMPurify 等でサニタイズしてからセットする
- ユーザー入力を React の JSX に直接展開する場合、React が自動エスケープするため通常は安全
- `eval()` / `new Function()` は絶対禁止

---

## 認証・認可

サイト全体を Google ログイン必須にして bot を遮断している（Auth.js v5 / JWT セッション）。
認可判定は `src/middleware.ts` の 1 箇所に集約する。Route Handler や Server Component へ
個別の認証チェックを散らさないこと。

### matcher の除外は必ず境界を付ける

`src/middleware.ts` の matcher で除外を増やす際、**前方一致で終わらせてはならない**。

```ts
// NG: /logindq /loginx /api/authors /manifestXjson が認証ガードを素通りする
"/((?!api/auth|login|manifest.json).*)"

// OK: 境界（$ / /）を付け、ドットをエスケープする（TS の文字列リテラルなので \\. と書く）
"/((?!api/auth(?:/|$)|login$|manifest\\.json$).*)"
```

この失敗は **エラーを出さずに静かに素通りする**。未ログインのまま存在しないページが
描画され、ログイン済み向けの UI（ログアウトボタン等）が未認証の利用者に見える。
除外を変更したら、必ず経路テーブルで「ガード対象／素通り」を実測すること。

認証画面を増やす場合は `src/lib/auth-routes.ts` の `AUTH_ROUTES` と matcher を
**対で更新**する。片方だけ変えると「ガードは外れているのにサイト共通の UI が出る」
という中途半端な状態になる。

### 未認証レスポンスの返し分け

- ページ: `pages.signIn`（`/login`）へリダイレクト
- `/api/**`: **401 JSON を返す**。HTML へリダイレクトするとブラウザが追従して 200 を
  受け取り、クライアントの `res.json()` が構文エラーで落ちる。セッション切れが
  「機能が壊れた」ようにしか見えなくなる

クライアント側は `src/lib/api-client.ts` の `assertApiOk()` を通すこと。

### 認証情報

- `AUTH_SECRET` は JWT の署名・暗号鍵。**本番と開発で必ず別の値**を使う
- `AUTH_SECRET` の変更 = 全ユーザー強制ログアウト。ローテーション時は影響を織り込む
- Vercel 以外（Docker / 自前ホスト）では `AUTH_TRUST_HOST=true` が必須。
  開発モードでは自動で信頼されるが本番ビルドでは効かず、未設定だと `/api/auth/**` が
  全て `UntrustedHost` で 500 になる
- セッション Cookie は JWE（暗号化）で、氏名・メール・Google アカウント ID を含む。
  サーバーには保存しない。ログにも出さない

---

## 機密情報管理

- **API キー・シークレットは環境変数のみ**。コードに直書き禁止
- TMDb のキーは `TMDB_ACCESS_TOKEN`（Bearer 推奨）または `TMDB_API_KEY`（v3）
- クライアントに公開していい環境変数のみ `NEXT_PUBLIC_` プレフィックスを付ける
- `.env` 系ファイルは `.gitignore` に含める（コミット禁止）
- `.env.local.example` にはキー名のみ記載し、値は書かない
- TMDb 認証ヘッダーを組み立てる処理は **`src/lib/tmdb.ts` の `resolveAuth()` のみ**。他所で組み立てない

```bash
# .env.local.example（値なし）
TMDB_ACCESS_TOKEN=
# TMDB_API_KEY=
# NEXT_PUBLIC_APP_URL=
```

---

## TMDb API 呼び出し

- TMDb の呼び出しは **必ず Server Component / Route Handler から**。クライアントから直接叩かない（キーが漏れる）
- `fetchTMDb()` を経由しない直接 `fetch("https://api.themoviedb.org/...")` 禁止
- 失敗時のエラーメッセージにキーやスタックトレースを含めない

---

## HTTP セキュリティヘッダー（Route Handler）

`src/app/api/*/route.ts` では既存実装と同じく以下を付与する:

```ts
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store, no-cache",
};
return NextResponse.json(data, { headers: SECURITY_HEADERS });
```

将来的にグローバルヘッダーを `next.config.ts` の `headers()` で集約してもよい:

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // CSP は YouTube iframe / image.tmdb.org / img.youtube.com を許可
];
```

---

## 外部埋め込みの取扱い

- YouTube 埋め込みは `youtube-nocookie.com` を優先する（ContentRow ホバー時等）
- `iframe` には `sandbox` の検討、`referrerpolicy` を意識
- TMDb 画像ホスト（`image.tmdb.org`）は `next.config.ts` の `remotePatterns` で許可済み。これ以外の外部画像を増やす場合は同所に追記

---

## 依存関係

- `npm audit` で critical / high の脆弱性があれば即座に修正する
- 依存パッケージは定期的に更新する
- 信頼できないパッケージは使用しない（ダウンロード数・メンテナ・ライセンスを確認）

---

## `/review-pr` でのチェック項目

- [ ] Route Handler の入力に `sanitizeQuery` 等の防御があるか
- [ ] TMDb 呼び出しが `fetchTMDb()` 経由になっているか
- [ ] `dangerouslySetInnerHTML` 使用箇所が DOMPurify を通っているか
- [ ] API キーがコードに直書きされていないか
- [ ] `NEXT_PUBLIC_` 以外の環境変数がクライアントバンドルに含まれていないか
- [ ] Route Handler のレスポンスにセキュリティヘッダーが付いているか
- [ ] `npm audit` で新たな脆弱性が発生していないか
- [ ] `src/middleware.ts` の matcher の除外に境界（`$` / `/`）が付いているか
- [ ] matcher と `src/lib/auth-routes.ts` の `AUTH_ROUTES` が対で更新されているか
- [ ] クライアントの `fetch("/api/...")` が `assertApiOk()` を通っているか
