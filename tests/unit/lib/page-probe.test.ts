import { describe, it, expect, vi } from "vitest";
import { probeLastPage, resolvePaging } from "@/lib/page-probe";

/**
 * 実在する最終ページを二分探索で求める（#86）。
 *
 * AniList の `Media.characters` の pageInfo は実態と食い違う
 * （葬送のフリーレン: 申告 500 件・20 ページ / 実際 100 件・4 ページ。2026-10-04 実測）。
 * 申告の最終ページを上限に、各ページの件数だけを見て本当の終わりを探す。
 */

/** total 件を perPage 件ずつ並べたときの、page ページ目の件数 */
function countOn(total: number, perPage: number) {
  return vi.fn(async (page: number) =>
    Math.max(0, Math.min(perPage, total - (page - 1) * perPage)),
  );
}

describe("probeLastPage", () => {
  it("申告より手前で尽きていれば、本当の最終ページと件数を返す", async () => {
    const count = countOn(100, 30);

    await expect(probeLastPage(20, 30, count)).resolves.toEqual({
      lastPage: 4,
      total: 100,
    });
  });

  it("ちょうど割り切れる件数でも最終ページを取り違えない", async () => {
    await expect(probeLastPage(20, 30, countOn(90, 30))).resolves.toEqual({
      lastPage: 3,
      total: 90,
    });
  });

  it("申告どおり最後まで埋まっていれば申告を返す", async () => {
    await expect(probeLastPage(5, 30, countOn(500, 30))).resolves.toEqual({
      lastPage: 5,
      total: 150,
    });
  });

  it("1 ページ目から空なら 0 件", async () => {
    await expect(probeLastPage(20, 30, countOn(0, 30))).resolves.toEqual({
      lastPage: 0,
      total: 0,
    });
  });

  it("申告が 1 ページ以下なら 1 ページ目だけ見る", async () => {
    const count = countOn(12, 30);

    await expect(probeLastPage(1, 30, count)).resolves.toEqual({
      lastPage: 1,
      total: 12,
    });
    expect(count).toHaveBeenCalledTimes(1);
  });

  it("問い合わせは二分探索の回数で済む（全ページは引かない）", async () => {
    const count = countOn(100, 30);

    await probeLastPage(20, 30, count);

    // 上限 20 → log2(20) ≒ 5 回 + 最終ページの件数確認
    expect(count.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("件数の取得が失敗したら throw する（呼び出し側で申告値や非表示に倒す）", async () => {
    const count = vi.fn(async () => {
      throw new Error("AniList down");
    });

    await expect(probeLastPage(20, 30, count)).rejects.toThrow();
  });
});

/**
 * 数えた結果（または数えられなかったこと）から、最終ページと寄せ先を決める（#105）。
 * 範囲外のページ番号は最終ページへ寄せる。数えられなかったときは今のページの件数だけで推し量る。
 */
describe("resolvePaging", () => {
  it("数えられたら、その最終ページと件数を使う", () => {
    expect(resolvePaging(2, 30, 30, { lastPage: 4, total: 100 })).toEqual({
      lastPage: 4,
      total: 100,
      redirectTo: null,
    });
  });

  it("範囲外のページ番号は最終ページへ寄せる", () => {
    expect(resolvePaging(9, 30, 0, { lastPage: 4, total: 100 })).toEqual({
      lastPage: 4,
      total: 100,
      redirectTo: 4,
    });
  });

  it("1 件も無いのに 2 ページ目以降を開いたら 1 ページ目へ寄せる", () => {
    expect(resolvePaging(3, 30, 0, { lastPage: 0, total: 0 }).redirectTo).toBe(
      1,
    );
  });

  it("1 件も無くても 1 ページ目なら寄せない（ループさせない）", () => {
    expect(resolvePaging(1, 30, 0, { lastPage: 0, total: 0 })).toEqual({
      lastPage: 0,
      total: 0,
      redirectTo: null,
    });
  });

  it("数えられず、今のページが満杯なら 1 つ先まで出す（件数は不明）", () => {
    expect(resolvePaging(2, 30, 30, null)).toEqual({
      lastPage: 3,
      total: null,
      redirectTo: null,
    });
  });

  it("数えられず、今のページが満杯でなければ今のページが最終ページ", () => {
    expect(resolvePaging(2, 30, 12, null)).toEqual({
      lastPage: 2,
      total: null,
      redirectTo: null,
    });
  });

  it("数えられず、2 ページ目以降が空なら 1 ページ目へ戻す", () => {
    expect(resolvePaging(5, 30, 0, null).redirectTo).toBe(1);
  });
});
