# 開発フロー（TDD 駆動）

12 ステップの開発フロー。全ての機能実装はこの順序を厳守すること。
各ステップに参照ルールを明記する。違反はメイド長（Benz）が差し戻す。

> テスト基盤（Vitest/Playwright）は未導入のため、Step 4 のテスト関連手順は基盤導入後に有効化される。
> 導入までの暫定運用では、QA は **テスト方針の文書化** と **手動検証手順の整備** を担当する。

---

## Step 1: Plan Mode（設計・タスク分解）

`/plan` を使い、実装前に必ず設計を行う。

- 要件を分解し、サブタスクに落とし込む
- 影響範囲（型 / UI / lib / Route Handler / TMDb 呼び出し）を特定する
- 実装方針が固まるまでコードに触れない

**参照**: `@.claude/rules/agents.md`（Benz が担当）

---

## Step 2: ISSUE 作成

以下のフォーマットで GitHub ISSUE を作成する。

```bash
gh issue create \
  --title "<機能名または修正内容>" \
  --body "$(cat <<'EOF'
## 概要
<!-- 何を実装/修正するか -->

## 受け入れ条件
- [ ] 条件1
- [ ] 条件2

## 技術的メモ
<!-- 実装方針・参照ファイル・依存関係（TMDb エンドポイント等） -->

## 関連
<!-- 関連ISSUEやPRがあればリンク -->
EOF
)"
```

---

## Step 3: ブランチ作成

ISSUE 番号を含む命名規則でブランチを切る。

```bash
git checkout -b feat/<issue番号>-<機能名の短縮>
# 例: feat/12-anime-detail-trailer-modal
# 例: fix/15-search-dropdown-focus-trap
```

**参照**: `@.claude/rules/git-strategy.md`（ブランチ命名規則）

---

## Step 4: TDD Cycle（Red → Green → Refactor）

### 4-1. テスト設計（QA）

**参照**: `@.claude/rules/testing.md`・`@.claude/rules/agents.md`

- 検閲のメイド（QA）がテストを書く
- `npm test -- --run` でテストが**失敗する**ことを確認してから次へ
- 基盤未導入のうちは、ISSUE に **手動検証チェックリスト** を貼ることで代替

### 4-2. 型・ドメイン定義（Architect）

**参照**: `@.claude/rules/conventions.md`・`@.claude/rules/api-design.md`

- 礎のメイド（Architect）が `src/types/` の TMDb 型と `src/lib/` のドメイン定義（ジャンル / 年代 / シーズン / スタジオ）を整える
- TMDb クライアント関数 (`src/lib/tmdb.ts`) のシグネチャ追加もここで行う

### 4-3. 実装（Coder）

**参照**: `@.claude/rules/conventions.md`・`@.claude/rules/security.md`・`@.claude/rules/api-design.md`

- 構築のメイド（Coder）がテストをグリーンにする最小限のコードを書く
- `any` 使用禁止。Route Handler は入力サニタイズ必須
- TMDb 呼び出しは `fetchTMDb()` 経由のみ

### 4-4. UI コンポーネント（Designer、必要な場合）

**参照**: `@.claude/rules/agents.md`

- 図案のメイド（Designer）が Tailwind CSS でスタイリングする
- 既存トークン（`#141414` / `#E50914` / `#54b9c5`）を踏襲し、レスポンシブとホバー挙動を死守する

### 4-5. 品質評価（Evaluator）【必須】

**参照**: `@.claude/agents/sub-agent-evaluator.md`

**Coder/Designer の実装完了後、必ず評価のメイド（Evaluator）を呼び出す。**

- `npm run lint` / `npm run build` を実行して評価する（基盤導入後は `typecheck` / `test` も追加）
- セキュリティ・コード規約をガードレールに照らして確認する
- **PASS** → 4-6 へ進む
- **FAIL** → 差し戻し事項を Coder/Designer に渡し、4-3 または 4-4 に戻る（ループ）

```
┌──────────────────────────────┐
│    Cybernetic Loop           │
│  Coder/Designer（実装）       │
│        ↓                     │
│  Evaluator（評価）            │
│   FAIL ↙       ↘ PASS        │
│  差し戻し      4-6 へ         │
└──────────────────────────────┘
```

### 4-6. リファクタリング（Benz 監督）

- テストがグリーンのまま品質を上げる
- `npm run lint` / `npm run build` がグリーンであることを確認
- リファクタリング後も Evaluator が PASS していることを確認する

---

## Step 5: /smart-commit

Evaluator が PASS を出した後、`/smart-commit` でコミットする。

- lint を通過したもののみコミット可（typecheck / test は基盤導入後に必須化）
- コミットメッセージは変更の「理由」（why）を書く

**参照**: `@.claude/rules/git-strategy.md`（コミット規約）

---

## Step 6: PR 作成

`/create-pr` で PR を作成する。

- タイトルは英語・70 文字以内
- body は `.github/pull_request_template.md` に従う
- `Closes #<issue番号>` を必ず記載する

**参照**: `@.claude/rules/git-strategy.md`（PR ルール）

---

## Step 7: ローカル動作確認

PR 作成前後に必ずローカルで確認する。

```bash
npm run lint       # ESLint（conventions.md 準拠チェック）
npm run build      # ビルド成功確認
# 基盤導入後:
# npm run typecheck
# npm test -- --run
```

UI 変更がある場合は `/visual-regression` を実行する。
フロー全体に変更がある場合は `/e2e-test` を実行する（Playwright MCP）。

### 7-1. スクショの後始末【必須】

検証目的で撮影したスクリーンショットは**作業完了直前に必ず削除する**。

- Playwright MCP / Chrome DevTools MCP / 手動撮影で生成された PNG・JPEG はリポジトリに残さない
- 削除対象の例:
  - リポジトリ直下の `*.png` / `*.jpeg`（`pc-*.png`、`sp-*.png`、`*-screenshot.png` 等）
  - 一時的な検証用画像
- `public/` 配下の本番アセット（icons 等）と `tests/**/__snapshots__/` のスナップショットは削除しない
- 撮影 → 確認 → 削除 までを1セットで完了させる。「あとで消す」は禁止

```bash
# 例: ルート直下の検証スクショを一掃
ls -1 *.png *.jpeg 2>/dev/null
rm *.png *.jpeg 2>/dev/null
```

`/smart-commit` 実行前に `git status` で残骸が無いことを確認する。

**参照**: `@.claude/rules/testing.md`

---

## Step 8: CI 確認（GitHub Actions）

push 後、GitHub Actions の全ジョブがグリーンになることを確認する。

| ジョブ     | 確認内容          | 対応ルール       |
| ---------- | ----------------- | ---------------- |
| Lint       | ESLint エラーなし | `conventions.md` |
| Type Check | 型エラーなし      | `conventions.md` |
| Build      | ビルド成功        | —                |

**CI が red の場合はマージしない。** 原因を特定して修正する。

---

## Step 9: AI コードレビュー

`/review-pr` で AI によるコードレビューを実施する。

レビュー時に照合するルール:

- `@.claude/rules/conventions.md` — コード品質
- `@.claude/rules/security.md` — セキュリティチェックリスト
- `@.claude/rules/testing.md` — テスト網羅性
- `@.claude/rules/api-design.md` — Route Handler / TMDb クライアントの規約
- `@.claude/rules/git-strategy.md` — コミット・PR 規約

重要度「高」の指摘がある場合はマージしない。Step 4 に戻る。

CodeRabbit 等の外部レビュー指摘は `/coderabbit-fix` で取り込む。

---

## Step 10: LGTM

レビュー指摘が全て解消されたら LGTM。

- チェックリストが全て完了していることを確認する
- CI が全件グリーンであることを再確認する

---

## Step 11: マージ

```bash
# 推奨: スラッシュコマンド
/merge-and-sync

# 手動の場合
gh pr merge <PR番号> --squash --delete-branch
```

- `--squash` でコミットを 1 つに圧縮
- `--delete-branch` でブランチを削除
- マージ後、ISSUE が自動クローズされることを確認

**参照**: `@.claude/rules/git-strategy.md`（マージ戦略）

---

## Step 12: リリース

main ブランチへのマージ = リリース。

現状は Docker / Vercel での手動デプロイ。Vercel の自動デプロイが設定されれば自動化される。
マージ後に本番環境で TMDb データが正常に表示されることを確認すること（API キー切れ・レート制限の早期検知）。
