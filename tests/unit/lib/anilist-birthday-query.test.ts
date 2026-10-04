import { describe, it, expect } from "vitest";
import { birthdayStaffQuery } from "@/lib/anilist";

/**
 * 「今日が誕生日の声優」のクエリ（#102 レビュー）。
 *
 * AniList の `isBirthday` は日付を引数に取らない。Next の Data Cache のキーは
 * POST の body なので、日付をクエリ末尾のコメントに入れて日ごとに別エントリにする
 * （AniList が末尾コメント付きのクエリを受け付けることは 2026-10-04 に実測確認）。
 * 組み立てだけを見る純粋関数なので fetch は使わない。
 */
describe("birthdayStaffQuery", () => {
  it("日付をクエリ末尾のコメントに入れる", () => {
    const query = birthdayStaffQuery("2026-10-04");

    expect(query.trimEnd().endsWith("# 2026-10-04")).toBe(true);
    expect(query).toContain("isBirthday: $isBirthday");
  });

  it("日付が変わればクエリ（= キャッシュキー）が変わる", () => {
    expect(birthdayStaffQuery("2026-10-04")).not.toBe(
      birthdayStaffQuery("2026-10-05"),
    );
  });

  it("日付以外の文字列はクエリへ入れない（改行でコメントを抜けられないように）", () => {
    expect(() => birthdayStaffQuery("2026-10-04\n{ x }")).toThrow();
    expect(() => birthdayStaffQuery("today")).toThrow();
  });
});
