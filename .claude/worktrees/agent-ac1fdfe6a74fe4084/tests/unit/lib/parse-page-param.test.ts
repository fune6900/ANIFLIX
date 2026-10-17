import { describe, it, expect } from "vitest";
import { parsePageParam, TMDB_MAX_PAGE } from "@/lib/tmdb";

/**
 * page はキャッシュ対象の discover 呼び出しにそのまま乗るため、上限が無いと
 * Data Cache のエントリが無制限に増える。`api-design.md` はこの関数の使用を
 * 必須のガードとして名指ししている。
 */
describe("parsePageParam", () => {
  it("未指定・不正値は 1 に丸める", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam(null)).toBe(1);
    expect(parsePageParam("")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
  });

  it("1 未満は 1 に丸める", () => {
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-5")).toBe(1);
  });

  it("正常値はそのまま通す", () => {
    expect(parsePageParam("1")).toBe(1);
    expect(parsePageParam("42")).toBe(42);
  });

  it("TMDB_MAX_PAGE で上限を打ち切る", () => {
    expect(parsePageParam(String(TMDB_MAX_PAGE))).toBe(TMDB_MAX_PAGE);
    expect(parsePageParam(String(TMDB_MAX_PAGE + 1))).toBe(TMDB_MAX_PAGE);
    expect(parsePageParam("999999999")).toBe(TMDB_MAX_PAGE);
  });
});
