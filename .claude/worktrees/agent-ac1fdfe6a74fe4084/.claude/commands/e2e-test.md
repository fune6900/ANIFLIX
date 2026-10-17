検閲のメイド（QA サブエージェント）を起動し、Playwright MCP を使用して ANIFLIX の E2E テストを実行する。以下の手順を厳守すること。

## 対象

- 引数 $ARGUMENTS にテスト対象の URL、またはフロー名を指定する。
- 未指定の場合は `http://localhost:3000` を起点に全主要フローをテストする。
- フロー名指定例:
  - `home` — トップ（Hero / ContentRow / 年代・ジャンルピル）
  - `search` — 検索ドロップダウン + 検索ページ
  - `anime` — アニメ詳細（動画 / OP・ED / キャスト / 年表 / エピソード）
  - `voice-actor` — 声優一覧 + 詳細
  - `browse` — `/browse/*` 各種ブラウズページ

## 手順

### Phase 0: 事前確認

- 開発サーバーが起動していない場合は `npm run dev` の実行をマスターに促す。
- `mcp__playwright__browser_navigate` で対象 URL へ遷移し、ページが正常に表示されることを確認する。
- `mcp__playwright__browser_console_messages` でページロード時のエラーを確認する。
- TMDb のキーが未設定だとホームの動的セクションが表示されない。`.env.local` の `TMDB_ACCESS_TOKEN` を事前に確認する。

### Phase 1: ホームフロー（`home` または全テスト時）

1. Hero スライダーの自動切替（6 秒間隔）が動作することを確認
2. ドット・左右矢印でのスライド操作を確認
3. トレーラーキー付きアイテムで「再生」モーダルが開くことを確認（YouTube iframe）
4. ESC モーダル閉じ・自動スライド停止を確認
5. ContentRow をホバー → 800ms 後に YouTube プレビューポップアップが出ることを確認
6. 「すべて見る」リンクが対応する `/browse/*` へ遷移することを確認
7. 年代ピル → `/browse/era/<decade>`、ジャンル行の「すべて見る」 → `/browse/genre/<id>` へ遷移することを確認

### Phase 2: 検索フロー（`search` または全テスト時）

1. Navbar の検索アイコンをクリック → ドロップダウンが開き、検索ボックスがフォーカスされる
2. タブ切替（アニメ / 映画 / 声優）でプレースホルダが切り替わる
3. デバウンス 300ms 後に候補が出る（最大 8 件）
4. 矢印キー（↓↑）で候補のフォーカスが移動する
5. Enter で候補に遷移、未選択時は検索結果ページへ遷移
6. 最近の検索が localStorage に保存され、再表示される（`aniflex-recent-searches`）
7. `/search` のキーワード検索と詳細フィルター（ジャンル / 年 / 評価 / ステータス / ソート）の切替を確認
8. 不正な入力（空文字、特殊文字 `<script>`、超長文字列）でサニタイズされ落ちないことを確認

### Phase 3: アニメ詳細フロー（`anime` または全テスト時）

1. ContentRow からアニメカードをクリック → `/anime/[id]` へ遷移
2. ヒーローバックドロップ・ポスター・メタ情報が表示される
3. 「トレーラーを見る」が YouTube に新規タブで開く
4. 動画セクションのメイン iframe が再生可能
5. OP / ED セクションが分離表示される
6. キャストをクリック → `/voice-actors/[id]` へ遷移
7. SeasonTimeline（ヒストリー）に年表が表示される（2 シーズン以上ある場合）
8. SeasonEpisodes でシーズン切替・エピソードページネーション（30 件単位）が動作する
9. 関連作品 ContentRow が表示される

### Phase 4: 声優フロー（`voice-actor` または全テスト時）

1. `/voice-actors` クエリなし → 日本声優の無限スクロール（IntersectionObserver）
2. 検索フォーム → 部門 / 並び順フィルター適用
3. 声優カードクリック → `/voice-actors/[id]` の出演作グリッド
4. 出演作のページネーション（20 件単位）
5. アニメ出演作（`media_type === "tv"`）が `/anime/[id]` へ遷移できる

### Phase 5: ブラウズフロー（`browse` または全テスト時）

1. `/browse/airing` — 現クールアニメ一覧（ON AIR バッジ）
2. `/browse/movies` — InfiniteGrid で `/api/browse?type=movies` を追加読み込み
3. `/browse/seasons` `/browse/genres` `/browse/eras` — ピルから個別ページへ
4. `/browse/season/[year]/[season]` — 期間別アニメ
5. `/browse/genre/[genreId]` — ジャンル別（キーワードベース含む）
6. `/browse/era/[decade]` — 年代別 + 人気順 / 放送日順切替
7. `/browse/studio/[id]` — スタジオ別

### Phase 6: 共通 UX 検証

1. **モバイル BottomNav**: 375px で下部ナビが表示され、戻る・ホーム・放送中・映画・シーズン・声優の遷移が機能する
2. **ナビゲーション**: `mcp__playwright__browser_navigate_back` でブラウザバックが正常に機能する
3. **ネットワークエラー**: TMDb 不達時にエラー表示が出るか（`Promise.allSettled` が機能）
4. **タブ管理**: `mcp__playwright__browser_tabs` で意図しないタブ開きが発生していないか確認（YouTube は新規タブ想定）

### Phase 7: 回帰確認

既存テストファイルが存在する場合は `Bash` で `npm run e2e` を実行し、既存テストとの整合性を確認する。
新規のテストケースが発見された場合は `Write` で `tests/e2e/` 配下に Playwright テストコードとして追記する。

## 報告形式

```
## E2E テスト 検閲報告

### 総合判定: [全件合格 / X件失敗 / 実行不能]
実行日時: <timestamp>
対象URL: <url>

---

### Phase 1: ホームフロー
| # | テスト項目 | 結果 | 備考 |
|---|-----------|------|------|
| 1 | Hero 自動切替 | PASS / FAIL | |
| 2 | トレーラーモーダル | PASS / FAIL | |
| 3 | ContentRow ホバープレビュー | PASS / FAIL | |
| 4 | 年代・ジャンルピル遷移 | PASS / FAIL | |

（以降 Phase 2〜6 同形式）

---

### FAIL 一覧（修正命令）
1. [FAIL] <フロー名> > <テスト項目>
   - 期待値: <expected>
   - 実際の挙動: <actual>
   - 原因箇所（推定）: <ファイル名:行数>
   - 修正方針: <具体的な修正内容>

### 新規追加したテストコード
（追記した場合のみ記載: tests/e2e/<ファイル名>）

### 次回テストで監視すべき項目
（今回は PASS したが、将来的にリグレッションが起きやすい箇所）
```

## 注意

- 開発サーバーが起動していない場合は `npm run dev` の実行をマスターに促すこと。
- FAIL の原因を「不明」で終わらせるな。`mcp__playwright__browser_evaluate` で DOM 状態や JS エラー、ネットワーク失敗を掘り下げ、根本原因まで特定すること。
- TMDb 起因のエラー（429 レート制限、認証失敗）は実装バグと混同しない。レスポンスを確認すること。
- 応答時間が 500ms 超のステップは「要改善」として別途フラグを立てること。
- 撮影したスクリーンショットは検証後に必ず削除する（`@.claude/rules/dev-flow.md` Step 7-1）。
- 新規テストコードは既存の `tests/e2e/` の命名規則・構造に従うこと。ない場合は `<flow-name>.spec.ts` 形式で作成する。
