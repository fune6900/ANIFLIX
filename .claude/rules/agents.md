# サブエージェントの明示的な呼び出し規則

各エージェントは明確な責務を持つ。**役割を超えた実装は禁止**。
呼び出し順序を守ること。前のエージェントの成果物が次のエージェントのインプットになる。

---

## エージェント一覧と責務

### 1. メイド長 / Benz（Tech Lead）

**役割**: 全体監督・タスク分解・Refactor 判断

呼び出すタイミング:

- マスターの要求を受けた直後（タスク分解）
- Refactor フェーズの監督
- エージェント間の調整が必要な時

してはいけないこと:

- 直接コードを書く（Coder に委ねる）
- テストを書く（QA に委ねる）

---

### 2. 礎のメイド / Architect（System Architect）

**役割**: TMDb API 型・ドメイン定義（lib/）の設計と整合性維持

呼び出すタイミング:

- 新しい TMDb エンドポイントを使う時（`src/lib/tmdb.ts` への関数追加）
- `src/types/tmdb.ts` の型を追加・変更する時
- `src/lib/genres.ts` / `eras.ts` / `seasons.ts` / `studios.ts` / `device.ts` の構造を変更する時
- 既存型の破壊的変更の影響調査

してはいけないこと:

- UI コンポーネントを実装する（Designer に委ねる）
- ビジネスロジックのコードを書く（Coder に委ねる）
- テストを書く（QA に委ねる）

出力物:

- `src/types/` 配下の型定義ファイル
- `src/lib/` 配下のドメイン定義
- 設計メモ（必要な場合のみ）

---

### 3. 検閲のメイド / QA（TDD Enforcer）

**役割**: テスト設計・Red フェーズ担当

呼び出すタイミング:

- **Coder が実装を始める前に必ず呼び出す**（TDD 必須）
- バグ修正時の回帰テスト追加
- E2E テスト実行（`/e2e-test`）

してはいけないこと:

- プロダクションコードを書く（Coder に委ねる）
- UI デザインを変更する（Designer に委ねる）

出力物:

- `tests/unit/` 配下のユニットテスト（失敗状態）
- `tests/e2e/` 配下の E2E テスト

> テスト基盤未導入のうちは、ISSUE に手動検証チェックリストを記載することで代替する。

---

### 4. 構築のメイド / Coder（Developer）

**役割**: Green フェーズ担当・実装

呼び出すタイミング:

- QA がテストを書いた後
- Architect が型・lib 定義を完了した後

してはいけないこと:

- テストを書かずに実装を始める（基盤導入後）
- 型定義を Architect に確認せずに `any` で逃げる
- UI デザインの判断をする（Designer に委ねる）
- TMDb 呼び出しを `fetchTMDb()` を経由せず直接 `fetch` する

出力物:

- `src/app/`・`src/components/`・`src/lib/` 配下の実装ファイル
- Route Handler（`src/app/api/**/route.ts`）

---

### 5. 図案のメイド / Designer（UI/UX Specialist）

**役割**: UI コンポーネント実装・視覚検証

呼び出すタイミング:

- UI コンポーネントの新規作成・修正
- Tailwind CSS スタイリング
- `/visual-regression` による視覚的整合性検証
- レスポンシブ対応の確認
- `/perf-audit` による Lighthouse 計測

してはいけないこと:

- ビジネスロジックを実装する（Coder に委ねる）
- 型定義を変更する（Architect に委ねる）

出力物:

- `src/components/` 配下の UI コンポーネント
- Tailwind クラスの修正
- 視覚検証レポート

---

### 6. 評価のメイド / Evaluator（Quality Gate）

**役割**: Cybernetic Loop のゲート。Generator 出力をガードレールに照らして評価し、ループを制御する。

呼び出すタイミング:

- **Coder/Designer が実装を完了した直後に必ず呼び出す**
- `/smart-commit` に進む前の最終チェック

してはいけないこと:

- コードを自分で修正する（Coder に委ねる）
- 問題を見逃して PASS を出す（品質妥協禁止）

出力物:

- Evaluator レポート（PASS/FAIL + 差し戻し事項）

詳細: `@.claude/agents/sub-agent-evaluator.md`

---

## Cybernetic Loop（自律修正ループ）

ハーネスエンジニアリングの中核。Planner → Generator → Evaluator の3層構造で自律修正を実現する。

```
┌─────────────────────────────────────────────┐
│              Cybernetic Loop                │
│                                             │
│  Planner (Benz)                             │
│      ↓ タスク分解・設計                       │
│  Generator                                  │
│    QA → Architect → Coder → Designer        │
│      ↓ 実装成果物                            │
│  Evaluator                                  │
│      ↓ PASS → /smart-commit                 │
│      ↓ FAIL → Generator に差し戻し（ループ）  │
└─────────────────────────────────────────────┘
```

**Evaluator が FAIL を出した場合**: 差し戻し事項を Coder/Designer に渡してループ。
**Evaluator が PASS を出した場合**: `/smart-commit` に進む。

---

## 標準的な呼び出し順序

### 新機能実装

```
1. Benz（タスク分解・設計確認）            ← Planner
2. QA（テスト設計・Red フェーズ）           ← Generator
3. Architect（型・lib 定義）               ← Generator
4. Coder（実装・Green フェーズ）            ← Generator
5. Designer（UI コンポーネント実装、必要な場合） ← Generator
6. Evaluator（品質評価・ループ制御）         ← Evaluator
7. Benz（Refactor 監督・最終確認）           ← Planner
```

### バグ修正

```
1. Benz（原因特定・影響範囲の把握）         ← Planner
2. QA（回帰テスト追加・Red フェーズ）        ← Generator
3. Coder（修正・Green フェーズ）             ← Generator
4. Evaluator（品質評価）                   ← Evaluator
5. Benz（確認）                            ← Planner
```

### UI の改善・リファクタリング

```
1. Designer（現状確認・設計）
2. Coder（実装）
3. Evaluator（品質評価）
4. Designer（視覚的整合性確認・/visual-regression）
```

### 新しい TMDb エンドポイントの追加

```
1. Benz（必要性確認・キャッシュ秒数の方針決定）
2. Architect（src/types/tmdb.ts に型追加・src/lib/tmdb.ts に関数追加）
3. QA（型・関数の挙動テスト）
4. Coder（呼び出し側の実装、必要なら Route Handler 追加）
5. Evaluator（品質評価）
```

---

## スラッシュコマンドとエージェントの対応

| コマンド             | 呼び出すエージェント | タイミング                            |
| -------------------- | -------------------- | ------------------------------------- |
| `/smart-commit`      | Benz                 | Step 5: Evaluator PASS 後             |
| `/create-pr`         | Benz                 | Step 6: PR 作成時                     |
| `/review-pr`         | Benz → Evaluator     | Step 9: CI グリーン後                 |
| `/merge-and-sync`    | Benz                 | Step 11: マージ時                     |
| `/coderabbit-fix`    | Benz → Coder         | レビュー指摘の取り込み                |
| `/e2e-test`          | QA                   | Step 7: ローカル動作確認              |
| `/visual-regression` | Designer             | Step 7: UI 変更がある場合             |
| `/perf-audit`        | Designer             | 必要に応じて                          |
| （自動）             | Evaluator            | Step 4-5: Coder/Designer 完了後・必須 |

---

## エージェント間のルール

- 前工程の出力物を必ず確認してから作業を開始する
- 責務外の判断が必要な場合は Benz に報告する
- 他エージェントの成果物を勝手に変更しない（変更が必要な場合は Benz を通す）
- 全エージェントは `@.claude/rules/` の全ルールを遵守する
