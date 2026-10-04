import { describe, it, expect } from "vitest";
import { safeCallbackUrl } from "@/lib/safe-callback-url";

describe("safeCallbackUrl", () => {
  it("値が無い場合はトップページを返す", () => {
    expect(safeCallbackUrl(undefined)).toBe("/");
    expect(safeCallbackUrl("")).toBe("/");
  });

  it("Auth.js が渡す自サイトの絶対 URL からパスを取り出す", () => {
    // middleware は request.nextUrl.href（絶対 URL）を callbackUrl に載せる
    expect(safeCallbackUrl("http://localhost:3000/anime/1429")).toBe(
      "/anime/1429",
    );
  });

  it("クエリ文字列を保持する", () => {
    expect(
      safeCallbackUrl("http://localhost:3000/browse/genre/16?page=2"),
    ).toBe("/browse/genre/16?page=2");
  });

  it("相対パスをそのまま通す", () => {
    expect(safeCallbackUrl("/anime/1429?x=1")).toBe("/anime/1429?x=1");
  });

  it("外部オリジンを捨ててパスだけ採用する", () => {
    expect(safeCallbackUrl("https://evil.example/anime/1429")).toBe(
      "/anime/1429",
    );
    expect(safeCallbackUrl("https://evil.example")).toBe("/");
  });

  it("プロトコル相対 URL で外部へ飛ばさない", () => {
    expect(safeCallbackUrl("//evil.example")).toBe("/");
    expect(safeCallbackUrl("//evil.example/anime/1429")).toBe("/anime/1429");
  });

  it("スキーム付きの危険な入力をトップページへ丸める", () => {
    // new URL() がスキームを剥がすと先頭スラッシュの無い pathname が残るため弾く
    expect(safeCallbackUrl("javascript:alert(1)")).toBe("/");
    expect(safeCallbackUrl("data:text/html,<script>alert(1)</script>")).toBe(
      "/",
    );
    expect(safeCallbackUrl("mailto:a@b.c")).toBe("/");
  });

  it("返り値は必ず自サイト内の絶対パスになる", () => {
    const inputs = [
      undefined,
      "",
      "javascript:alert(1)",
      "//evil.example",
      "https://evil.example/x",
      "/anime/1429",
      "<https://evil.example>",
      "http://localhost:3000/",
    ];
    for (const input of inputs) {
      const result = safeCallbackUrl(input);
      expect(result.startsWith("/")).toBe(true);
      expect(result.startsWith("//")).toBe(false);
    }
  });
});

describe("safeCallbackUrl: 検索結果画面へは戻さない（#101）", () => {
  // 未ログインで検索結果の URL を直接開いた場合、ログイン後はトップへ戻す
  it.each([
    "http://localhost:3000/search/anime?q=%E9%80%B2%E6%92%83",
    "/search/movies?q=x",
    "/search/voice-actors?q=x&page=2",
    "/search/characters?q=x",
    "/search/characters",
    "/search",
    "/search/",
    "/search?q=x",
  ])("%s → /", (input) => {
    expect(safeCallbackUrl(input)).toBe("/");
  });

  it.each(["/browse/movies?q=x", "/voice-actors?q=x"])(
    "検索結果へ redirect する旧 URL %s も / へ倒す",
    (input) => {
      expect(safeCallbackUrl(input)).toBe("/");
    },
  );

  it.each([
    "/searching",
    "/search-x",
    "/browse/movies",
    "/voice-actors",
    "/voice-actors/123",
    "/browse/movies/latest",
  ])("検索結果画面ではない %s はそのまま戻す", (input) => {
    expect(safeCallbackUrl(input)).toBe(input);
  });
});
