# テスト方針

## 現状

**Vitest + jsdom を導入済み**（ISSUE #54）。Playwright（E2E）は未導入。

| コマンド            | 内容                              |
| ------------------- | --------------------------------- |
| `npm test`          | Vitest（watch）                   |
| `npm test -- --run` | Vitest（1 回だけ実行。CI と同じ） |
| `npm run typecheck` | `tsc --noEmit`                    |

構成:

- `vitest.config.ts` — jsdom 環境、`@` エイリアスは `tsconfig.json` の `paths` と対応させる
- `tests/setup.ts` — `@testing-library/jest-dom/vitest` のマッチャを有効化
- `tests/unit/**/*.test.{ts,tsx}` のみを対象にする
- CI（`.github/workflows/ci.yml`）に `test` ジョブがあり、`build` の前提条件に入っている

### 残りの導入計画

1. **Playwright**（E2E）
   - `@playwright/test`、`playwright.config.ts`
   - `package.json` に `"e2e": "playwright test"` を追加
   - CI では `npx playwright install --with-deps` の後に実行する
2. コンポーネントテスト（React Testing Library は導入済みだが未使用）

導入する PR は `chore/<issue>-introduce-playwright` のように切り出すこと。

---

## 基本原則

- **No Test, No Code**: テストのないコードはレビュー対象外
- **TDD 必須**: 実装より先にテストを書く。Red → Green → Refactor の順を崩さない
- **テストは仕様書**: テスト名を読めば何をするコードか分かるように書く
- **モックは最小限**: TMDb API・時刻・乱数のみモック許可。例外は下の「モック方針」を参照

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

// NG: コンポーネントやページのテストで fetch を素でモックする
//     （必ず @/lib/tmdb を経由し、そこをモックする）
```

### 例外

以下の 4 つに限り、上記より低いレイヤーのモックを許可する。
いずれも「モック対象そのものが検証対象」であるためで、他へ広げないこと。

1. **`src/lib/tmdb.ts` 自身のテストでグローバル `fetch` をスタブする**
   キャッシュ方針（`cache: "no-store"` / `next.revalidate`）は `fetchTMDb` が
   組み立てる `RequestInit` にしか現れない。`@/lib/tmdb` をモックすると
   検証対象ごと消える。例: `tests/unit/lib/tmdb-cache.test.ts`

2. **`src/middleware.ts` のテストで `@/auth` をモックする**
   matcher の検証に Auth.js 本体は不要で、読み込むと next-auth が Vitest 環境で
   解決できず落ちる。例: `tests/unit/middleware.test.ts`

3. **コンポーネントのテストで `next/navigation` をモックする**
   `usePathname()` 等は App Router のコンテキストに依存し、Vitest 環境では
   プロバイダが無いため実物を読み込むと落ちる。ルーター本体は検証対象ではない。
   例: `tests/unit/components/Footer.test.tsx`

4. **`src/lib/turnstile.ts` 自身のテストでグローバル `fetch` をスタブする**
   siteverify へ送る body（`secret` / `response` / `remoteip`）と、到達できなかった
   時に素通りさせない fail-closed の分岐は `fetch` に渡る `RequestInit` にしか
   現れない。`@/lib/turnstile` をモックすると検証対象ごと消える。
   例外 1（`tmdb.ts`）と同じ構造。例: `tests/unit/lib/turnstile.test.ts`

> `src/lib/turnstile.ts` / `src/lib/translate.ts` は `import "server-only"` を持つ。
> `server-only` は node_modules に実体が無く Next のバンドラが内部 alias で解決して
> いるため、Vitest では解決できない。`vitest.config.ts` の `resolve.alias` で
> `tests/stubs/server-only.ts` へ向けてある。サーバー専用モジュールのテストを
> 追加する時はこの alias が前提になる。

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

- [ ] 新規機能に対応するユニットテストが存在するか
- [ ] バグ修正に対応する回帰テストが追加されているか
- [ ] テスト名が「何をすべきか」を表しているか
- [ ] `fetch` の直接モックが「モック方針 > 例外」に該当する場合のみか（通常は `@/lib/tmdb` をモックする）
- [ ] `npm test -- --run` が全件グリーンか
