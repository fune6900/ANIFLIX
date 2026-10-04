import { describe, it, expect } from "vitest";
import {
  birthdayCharacterQuery,
  decadeCastQuery,
  latestMovieBeforeDate,
} from "@/lib/anilist";

/**
 * キャラクターページ（#104）が AniList へ投げるクエリの組み立て。
 * いずれも Next の Data Cache のキー（POST の body）に載るので、
 * 日付・年代以外の文字列が混ざらないことを確かめる。組み立てだけを見る純粋関数なので fetch は使わない。
 */

describe("birthdayCharacterQuery", () => {
  it("日付をクエリ末尾のコメントに入れる（声優の誕生日と同じ手法）", () => {
    const query = birthdayCharacterQuery("2026-10-04");

    expect(query.trimEnd().endsWith("# 2026-10-04")).toBe(true);
    expect(query).toContain("characters(");
    expect(query).toContain("isBirthday: $isBirthday");
  });

  it("日付が変わればクエリ（= キャッシュキー）が変わる", () => {
    expect(birthdayCharacterQuery("2026-10-04")).not.toBe(
      birthdayCharacterQuery("2026-10-05"),
    );
  });

  it("日付以外の文字列はクエリへ入れない", () => {
    expect(() => birthdayCharacterQuery("2026-10-04\n{ x }")).toThrow();
    expect(() => birthdayCharacterQuery("today")).toThrow();
  });
});

describe("latestMovieBeforeDate", () => {
  it("日本時間の日付を AniList の FuzzyDateInt にする", () => {
    expect(latestMovieBeforeDate("2026-10-04")).toBe(20261004);
  });

  it("日付以外は受け付けない", () => {
    expect(() => latestMovieBeforeDate("20261004")).toThrow();
    expect(() => latestMovieBeforeDate("2026-10-04 ")).toThrow();
  });
});

describe("decadeCastQuery", () => {
  it("年代ごとに 1 つの別名（alias）を持ち、3 つの年代を 1 回の問い合わせにまとめる", () => {
    const query = decadeCastQuery([1990, 2000, 2010]);

    expect(query.match(/\bd\d{4}: Page\(/g)).toEqual([
      "d1990: Page(",
      "d2000: Page(",
      "d2010: Page(",
    ]);
  });

  it("年代の境界: 1990 年 1 月 1 日以降、2000 年より前に始まった作品", () => {
    const query = decadeCastQuery([1990]);

    // AniList の比較は排他的。年だけ登録の作品（19900000）も入るよう前年末を下限にする
    expect(query).toContain("startDate_greater: 19891231");
    expect(query).toContain("startDate_lesser: 20000000");
  });

  it("10 年刻みの年（1900〜2090）以外は受け付けない", () => {
    expect(() => decadeCastQuery([1995])).toThrow();
    expect(() => decadeCastQuery([1890])).toThrow();
    expect(() => decadeCastQuery([2100])).toThrow();
    expect(() => decadeCastQuery([Number.NaN])).toThrow();
    expect(() => decadeCastQuery([])).toThrow();
  });
});

describe("キャストのクエリ（声優ページと共有）", () => {
  it("キャラのお気に入り数を取る（今期放送中・前クールの人気キャラ・年代の並びに使う）", () => {
    // キャストの項目（CAST_MEDIA_FIELDS）は今期・前クール・シリーズ・トレンド・映画・年代で共有。
    // 公開されている組み立て関数（年代）を通して、同じ項目にキャラの favourites があることを確かめる
    expect(decadeCastQuery([1990]).replace(/\s+/g, " ")).toContain(
      "node { id name { full native } image { large } favourites }",
    );
  });

  it("お気に入り数順・誕生日のキャラもお気に入り数を取る", () => {
    expect(birthdayCharacterQuery("2026-10-04")).toMatch(/^\s+favourites$/m);
  });
});
