# テスト方針

## 現状

**テスト基盤は未導入**。`package.json` に `test` / `e2e` / `typecheck` スクリプトは存在しない。
そのため、当面は次の優先タスクとして基盤導入を進める。

### 導入計画（推奨）

1. **Vitest + React Testing Library**（ユニット）
   - `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
   - `package.json` に `"test": "vitest"`, `"typecheck": "tsc --noEmit"` を追加
2. **Playwright**（E2E）
   - `@playwright/test`、`playwright.config.ts`
   - `package.json` に `"e2e": "playwright test"` を追加
3. CI（`.github/workflows/ci.yml`）に `test` ジョブを追加

導入する PR は `chore/<issue>-introduce-vitest` のように切り出すこと。

---

## 基本原則

- **No Test, No Code**: テストのないコードはレビュー対象外（基盤導入後）
- **TDD 必須**: 実装より先にテストを書く。Red → Green → Refactor の順を崩さない
- **テストは仕様書**: テスト名を読めば何をするコードか分かるように書く
- **モックは最小限**: TMDb API・時刻・乱数のみモック許可

---

## TDD サイクル

### Red（失敗するテストを書く）— **検閲のメイド (QA)**

1. 実装コードに触れる前にテストを書く
2. `npm test -- --run` でテストが失敗することを確認する
3. テストが失敗しない場合、テストが機能していない証拠。書き直す

### Green（最小限のコードで通す）— **構築のメイド (Coder)**

1. テストをパスする最小限のコードを書く
2. 綺麗さは後回し。まず動かす
3. `npm test -- --run` が全件グリーンになるまで続ける

### Refactor（品質を上げる）— **メイド長 (Benz) 監督**

1. テストがグリーンのまま、重複排除・命名改善・構造整理を行う
2. リファクタリング後も `npm test -- --run` がグリーンであることを確認

---

## テスト種別

| 種別           | ツール          | 対象                         | コマンド             | 担当     |
| -------------- | --------------- | ---------------------------- | -------------------- | -------- |
| ユニット       | Vitest + RTL    | 関数・hooks・コンポーネント  | `npm test`           | QA       |
| E2E            | Playwright      | ユーザーフロー全体           | `npm run e2e`        | QA       |
| 視覚的         | Playwright MCP  | レイアウト・スタイル崩れ     | `/visual-regression` | Designer |
| パフォーマンス | Chrome DevTools | Lighthouse / Core Web Vitals | `/perf-audit`        | Designer |

---

## テストファイルの場所と命名（推奨）

```
tests/
  unit/
    components/
      ContentRow.test.tsx
      HeroSection.test.tsx
      SearchDropdown.test.tsx
    lib/
      tmdb.test.ts
      seasons.test.ts
      genres.test.ts
    api/
      search.test.ts
      videos.test.ts
  e2e/
    home.spec.ts
    search.spec.ts
    anime-detail.spec.ts
    voice-actor.spec.ts
```

---

## テストの書き方（例）

```ts
// ユニット: ロジック関数
import { describe, it, expect } from "vitest";
import { getRecentSeasons } from "@/lib/seasons";

describe("getRecentSeasons", () => {
  it("returns N seasons in descending order", () => {
    const seasons = getRecentSeasons(4);
    expect(seasons).toHaveLength(4);
    expect(seasons[0].year).toBeGreaterThanOrEqual(seasons[1].year);
  });
});
```

```ts
// ユニット: コンポーネント
import { render, screen } from "@testing-library/react";
import ContentRow from "@/components/ContentRow";

it("renders title and items", () => {
  render(<ContentRow title="🔥 今期人気" items={[{ id: 1, title: "進撃の巨人" }]} />);
  expect(screen.getByText("🔥 今期人気")).toBeInTheDocument();
  expect(screen.getByText("進撃の巨人")).toBeInTheDocument();
});
```

```ts
// E2E: アニメ検索フロー
import { test, expect } from "@playwright/test";

test("ユーザーがアニメを検索して詳細ページへ遷移できる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /検索を開く/ }).click();
  await page.getByRole("searchbox").fill("進撃");
  await expect(page.getByText(/進撃の巨人/).first()).toBeVisible();
});
```

---

## モック方針

```ts
// OK: TMDb API のモック
vi.mock("@/lib/tmdb", () => ({
  getAnimeDetail: vi
    .fn()
    .mockResolvedValue({ id: 1, name: "Mock", genres: [] }),
}));

// OK: 時刻のモック（シーズン判定など）
vi.setSystemTime(new Date("2026-05-11"));

// OK: 乱数のモック（shuffle の挙動確認）
vi.spyOn(Math, "random").mockReturnValue(0.5);

// NG: fetch を素で叩く（必ず @/lib/tmdb を経由してそこをモックする）
```

---

## CI でのテスト実行（基盤導入後）

`.github/workflows/ci.yml` に以下を追加する想定:

```yaml
test:
  name: Test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: "npm" }
    - run: npm ci
    - run: npm test -- --run
```

E2E は `npx playwright install --with-deps` の後に `npm run e2e` を実行する。

---

## `/review-pr` でのチェック項目

- [ ] 新規機能に対応するユニットテストが存在するか（基盤導入後）
- [ ] バグ修正に対応する回帰テストが追加されているか
- [ ] テスト名が「何をすべきか」を表しているか
- [ ] TMDb 以外の `fetch` を直接モックしていないか（`@/lib/tmdb` をモックする）
- [ ] `npm test -- --run` が全件グリーンか
