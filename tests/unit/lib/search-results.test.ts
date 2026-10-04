import { describe, it, expect } from "vitest";
import {
  SEARCH_CATEGORIES,
  headerSearchResultsHref,
  isSearchResultsPath,
  sanitizeSearchQuery,
  searchResultsHref,
} from "@/lib/search-results";

/**
 * ヘッダー検索の結果画面（#101）。4 部門で URL の組み立てとキーワードの
 * サニタイズを共有する。
 */

describe("SEARCH_CATEGORIES", () => {
  it("アニメ → アニメ映画 → 声優 → キャラの順に 4 部門ある", () => {
    expect(SEARCH_CATEGORIES.map((c) => c.slug)).toEqual([
      "anime",
      "movies",
      "voice-actors",
      "characters",
    ]);
    for (const c of SEARCH_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
    }
  });
});

describe("sanitizeSearchQuery", () => {
  it("値が無ければ空文字", () => {
    expect(sanitizeSearchQuery(undefined)).toBe("");
    expect(sanitizeSearchQuery("")).toBe("");
  });

  it("HTML タグと危険文字を除去して前後の空白を落とす", () => {
    expect(sanitizeSearchQuery("  <b>進撃</b>の\"巨人'`  ")).toBe("進撃の巨人");
    expect(sanitizeSearchQuery("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("100 文字で切る", () => {
    expect(sanitizeSearchQuery("あ".repeat(150))).toBe("あ".repeat(100));
  });

  it("同じキーが複数あれば先頭だけを使う", () => {
    expect(sanitizeSearchQuery(["進撃", "鬼滅"])).toBe("進撃");
  });
});

describe("searchResultsHref", () => {
  it("部門ごとの結果画面へキーワードを載せる", () => {
    expect(searchResultsHref("anime", "進撃")).toBe(
      `/search/anime?q=${encodeURIComponent("進撃")}`,
    );
    expect(searchResultsHref("movies", "君の名は")).toBe(
      `/search/movies?q=${encodeURIComponent("君の名は")}`,
    );
    expect(searchResultsHref("voice-actors", "花江")).toBe(
      `/search/voice-actors?q=${encodeURIComponent("花江")}`,
    );
    expect(searchResultsHref("characters", "炭治郎")).toBe(
      `/search/characters?q=${encodeURIComponent("炭治郎")}`,
    );
  });

  it("2 ページ目以降だけ page を付ける", () => {
    expect(searchResultsHref("anime", "a", 1)).toBe("/search/anime?q=a");
    expect(searchResultsHref("anime", "a", 3)).toBe("/search/anime?q=a&page=3");
  });

  it("キーワードが空なら q を付けない", () => {
    expect(searchResultsHref("characters", "")).toBe("/search/characters");
  });

  it("& や # を含むキーワードでも別パラメータへ漏れない", () => {
    const href = searchResultsHref("anime", "a&page=9#x");
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.get("q")).toBe("a&page=9#x");
    expect(url.searchParams.get("page")).toBeNull();
  });
});

describe("headerSearchResultsHref", () => {
  it("ヘッダー検索のタブから結果画面へ飛ぶ（Enter / すべての結果）", () => {
    expect(headerSearchResultsHref("anime", "進撃")).toBe(
      searchResultsHref("anime", "進撃"),
    );
    expect(headerSearchResultsHref("movie", "君の名は")).toBe(
      searchResultsHref("movies", "君の名は"),
    );
    expect(headerSearchResultsHref("voice-actor", "花江")).toBe(
      searchResultsHref("voice-actors", "花江"),
    );
    expect(headerSearchResultsHref("character", "炭治郎")).toBe(
      searchResultsHref("characters", "炭治郎"),
    );
  });

  it("旧 URL（/search?q= /browse/movies?q= /voice-actors?q=）へは飛ばさない", () => {
    for (const mode of [
      "anime",
      "movie",
      "voice-actor",
      "character",
    ] as const) {
      expect(headerSearchResultsHref(mode, "x").startsWith("/search/")).toBe(
        true,
      );
    }
  });
});

describe("isSearchResultsPath", () => {
  it.each(["/search", "/search/", "/search/anime", "/search/characters"])(
    "%s は検索結果画面",
    (path) => {
      expect(isSearchResultsPath(path)).toBe(true);
    },
  );

  it.each(["/", "/searching", "/search-x", "/anime/1", "/api/search"])(
    "%s は検索結果画面ではない（境界を付けて判定する）",
    (path) => {
      expect(isSearchResultsPath(path)).toBe(false);
    },
  );
});
