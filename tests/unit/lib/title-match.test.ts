import { describe, it, expect } from "vitest";
import { matchTitles, MIN_PREFIX_MATCH_LENGTH } from "@/lib/title-match";

/**
 * AniList のタイトルと TMDb の作品名の照合。
 *
 * 下のケースは実際に TMDb へ問い合わせて確認したもの。
 * 完全一致だけで判定していた頃は、副題の差だけで軒並み弾かれていた。
 */

describe("matchTitles", () => {
  describe("完全一致", () => {
    it("そのまま一致する", () => {
      expect(matchTitles(["鬼滅の刃"], "鬼滅の刃")).toBe("exact");
    });

    it("サフィックスを剥がせば一致する", () => {
      expect(
        matchTitles(
          ["転生したらスライムだった件 第4期 第1&2クール"],
          "転生したらスライムだった件",
        ),
      ).toBe("exact");
    });

    it("記号と空白の差は吸収する", () => {
      expect(matchTitles(["ぼっち・ざ・ろっく！"], "ぼっち ざ ろっく")).toBe(
        "exact",
      );
    });

    it("候補タイトルのどれかが一致すればよい", () => {
      expect(matchTitles(["Spy x Family", "SPY×FAMILY"], "SPY×FAMILY")).toBe(
        "exact",
      );
    });
  });

  describe("副題差（前方一致）", () => {
    it.each([
      [
        "TMDb 側に副題が付く",
        "ヘルモード ～やり込み好きのゲーマーは廃設定の異世界で無双する～ 2nd Season",
        "ヘルモード ～やり込み好きのゲーマーは廃設定の異世界で無双する～ はじまりの召喚士",
      ],
      [
        "AniList 側が長い",
        "最強出涸らし皇子の暗躍帝位争い 無能を演じるSSランク皇子は皇位継承戦を影から支配する",
        "最強出涸らし皇子の暗躍帝位争い",
      ],
      [
        "続編の副題が別物",
        "クレバテスⅡ-魔獣の王と偽りの勇者伝承-",
        "クレバテス-魔獣の王と赤子と屍の勇者",
      ],
      [
        "TMDb 側が長い",
        "凶乱令嬢ニア・リストン",
        "凶乱令嬢ニア・リストン 病弱令嬢に転生した神殺しの武人の華麗なる無双録",
      ],
      ["章サフィックス", "東京リベンジャーズ 三天戦争編", "東京リベンジャーズ"],
      ["括弧付きの年", "らんま1/2 (2024) 第3期", "らんま1/2"],
    ])("%s", (_label, anilist, tmdb) => {
      expect(matchTitles([anilist], tmdb)).toBe("prefix");
    });
  });

  describe("誤マッチを防ぐ", () => {
    it("無関係なタイトルは一致しない", () => {
      expect(matchTitles(["鬼滅の刃"], "呪術廻戦")).toBeNull();
    });

    it("単語の途中で切れる前方一致は認めない", () => {
      // 「ワンピース」は「ワンピースフィルム レッド」の前方一致になるが、
      // 区切り文字を挟んでいないので別作品とみなす
      expect(
        matchTitles(["ワンピース"], "ワンピースフィルム レッド"),
      ).toBeNull();
    });

    it("短すぎるタイトルでの前方一致は認めない", () => {
      // 2〜3 文字のタイトルは何にでも前方一致してしまう
      expect(matchTitles(["AB"], "ABCDEFGHIJKLMN")).toBeNull();
    });

    it("下限の長さはちょうどで通す", () => {
      const short = "あ".repeat(MIN_PREFIX_MATCH_LENGTH);
      expect(matchTitles([short], `${short} 副題`)).toBe("prefix");
    });

    it("下限を 1 文字でも下回れば弾く", () => {
      const short = "あ".repeat(MIN_PREFIX_MATCH_LENGTH - 1);
      expect(matchTitles([short], `${short} 副題`)).toBeNull();
    });

    it("空のタイトルは一致しない", () => {
      expect(matchTitles([""], "鬼滅の刃")).toBeNull();
      expect(matchTitles(["鬼滅の刃"], "")).toBeNull();
      expect(matchTitles([], "鬼滅の刃")).toBeNull();
    });
  });

  describe("区切り文字", () => {
    it.each([
      ["空白", "凶乱令嬢ニア・リストン 続き"],
      ["全角空白", "凶乱令嬢ニア・リストン　続き"],
      ["ハイフン", "凶乱令嬢ニア・リストン-続き"],
      ["コロン", "凶乱令嬢ニア・リストン：続き"],
      ["波ダッシュ", "凶乱令嬢ニア・リストン～続き"],
      ["中黒", "凶乱令嬢ニア・リストン・続き"],
      ["括弧", "凶乱令嬢ニア・リストン（続き）"],
    ])("%s の後ろは副題とみなす", (_label, tmdb) => {
      expect(matchTitles(["凶乱令嬢ニア・リストン"], tmdb)).toBe("prefix");
    });
  });

  it("完全一致は前方一致より優先される", () => {
    // 同じ入力で両方成立しうる場合、exact を返すこと
    expect(matchTitles(["鬼滅の刃"], "鬼滅の刃")).toBe("exact");
  });
});
