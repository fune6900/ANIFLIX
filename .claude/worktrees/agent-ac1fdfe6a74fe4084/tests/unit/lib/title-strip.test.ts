import { describe, it, expect } from "vitest";
import { stripSeasonSuffix, getSearchTitleVariants } from "@/lib/title-strip";

/**
 * 実データ由来のケース。
 *
 * ここに並ぶタイトルは AniList の 2026 SUMMER / FALL から実際に取得したもの。
 * TMDb は続編を本体作品の Season N として登録するため、サフィックスを剥がして
 * 本体タイトルに寄せられないと、AniList から取れていても画面に出ない。
 */

describe("stripSeasonSuffix", () => {
  describe("既存の対応パターン（回帰）", () => {
    it.each([
      ["進撃の巨人 The Final Season", "進撃の巨人"],
      ["転生したらスライムだった件 第3期", "転生したらスライムだった件"],
      ["転スラ 4期", "転スラ"],
      ["ぼっち・ざ・ろっく！ 2nd Season", "ぼっち・ざ・ろっく！"],
      ["ぐらんぶる Season 3", "ぐらんぶる"],
      ["Re:ゼロから始める異世界生活 4th season", "Re:ゼロから始める異世界生活"],
      ["正反対な君と僕 第2期", "正反対な君と僕"],
      [
        "君のことが大大大大大好きな100人の彼女 第3期",
        "君のことが大大大大大好きな100人の彼女",
      ],
      ["トミカとトム シーズン2", "トミカとトム"],
    ])("%s → %s", (input, expected) => {
      expect(stripSeasonSuffix(input)).toBe(expected);
    });
  });

  describe("末尾が裸の数字", () => {
    it.each([
      [
        "乙女ゲー世界はモブに厳しい世界です2",
        "乙女ゲー世界はモブに厳しい世界です",
      ],
      ["からかい上手の高木さん2", "からかい上手の高木さん"],
      ["ワンパンマン３", "ワンパンマン"],
    ])("%s → %s", (input, expected) => {
      expect(stripSeasonSuffix(input)).toBe(expected);
    });
  });

  describe("ローマ数字が直結している", () => {
    it.each([
      ["幼女戦記Ⅱ", "幼女戦記"],
      [
        "骸骨騎士様、只今異世界へお出掛け中Ⅱ",
        "骸骨騎士様、只今異世界へお出掛け中",
      ],
      ["片田舎のおっさん、剣聖になるII", "片田舎のおっさん、剣聖になる"],
    ])("%s → %s", (input, expected) => {
      expect(stripSeasonSuffix(input)).toBe(expected);
    });
  });

  describe("ローマ数字のあとに副題が続く", () => {
    it.each([
      ["無職転生Ⅲ ～異世界行ったら本気だす～", "無職転生"],
      ["クレバテスⅡ-魔獣の王と偽りの勇者伝承-", "クレバテス"],
    ])("%s → %s", (input, expected) => {
      expect(stripSeasonSuffix(input)).toBe(expected);
    });
  });

  describe("期 + クール", () => {
    it.each([
      [
        "転生したらスライムだった件 第4期 第1&2クール",
        "転生したらスライムだった件",
      ],
      [
        "北斗の拳 拳王軍ザコたちの挽歌 第2クール",
        "北斗の拳 拳王軍ザコたちの挽歌",
      ],
      [
        "転生したらスライムだった件 第2期 第2クール",
        "転生したらスライムだった件",
      ],
    ])("%s → %s", (input, expected) => {
      expect(stripSeasonSuffix(input)).toBe(expected);
    });
  });

  describe("第Nシリーズ", () => {
    it("魔入りました！入間くん 第4シリーズ → 魔入りました！入間くん", () => {
      expect(stripSeasonSuffix("魔入りました！入間くん 第4シリーズ")).toBe(
        "魔入りました！入間くん",
      );
    });
  });

  describe("第を伴わない漢数字期", () => {
    it("闇芝居 十七期 → 闇芝居", () => {
      expect(stripSeasonSuffix("闇芝居 十七期")).toBe("闇芝居");
    });
  });

  describe("Season の表記ゆれ", () => {
    it.each([
      ["アオのハコ Season２", "アオのハコ"],
      ["探偵はもう、死んでいる。Season2", "探偵はもう、死んでいる。"],
      ["おでかけ子ザメ シーズン2", "おでかけ子ザメ"],
      ["クマーバシーズン3", "クマーバ"],
    ])("%s → %s", (input, expected) => {
      expect(stripSeasonSuffix(input)).toBe(expected);
    });
  });

  describe("誤爆させてはいけないもの", () => {
    it.each([
      // サフィックスが無い
      ["鬼滅の刃", "鬼滅の刃"],
      // 数字が作品名の一部
      ["AKB0048", "AKB0048"],
      ["ドラえもん (2005)", "ドラえもん (2005)"],
      ["ポケットモンスター (2023)", "ポケットモンスター (2023)"],
      ["LV999の村人", "LV999の村人"],
      [
        "ここは俺に任せて先に行けと言ってから１０年がたったら伝説になっていた。",
        "ここは俺に任せて先に行けと言ってから１０年がたったら伝説になっていた。",
      ],
      // ローマ数字に見えるが作品名の一部（英字に続く）
      ["Code Geass R2", "Code Geass R2"],
      ["K-On!! II", "K-On!! II"],
      // 章サフィックスは独立登録されうるので剥がさない
      ["BLEACH 千年血戦篇-禍進譚-", "BLEACH 千年血戦篇-禍進譚-"],
      ["東京リベンジャーズ 三天戦争編", "東京リベンジャーズ 三天戦争編"],
    ])("%s は変えない", (input, expected) => {
      expect(stripSeasonSuffix(input)).toBe(expected);
    });

    it("サフィックスだけのタイトルは元のまま返す", () => {
      expect(stripSeasonSuffix("第2期")).toBe("第2期");
    });
  });
});

describe("getSearchTitleVariants", () => {
  it("サフィックスがあれば 2 通り返す", () => {
    expect(getSearchTitleVariants("転スラ 4期")).toEqual([
      "転スラ 4期",
      "転スラ",
    ]);
  });

  it("サフィックスが無ければ 1 通りだけ返す", () => {
    expect(getSearchTitleVariants("鬼滅の刃")).toEqual(["鬼滅の刃"]);
  });

  it("裸の数字サフィックスも 2 通りになる", () => {
    expect(
      getSearchTitleVariants("乙女ゲー世界はモブに厳しい世界です2"),
    ).toEqual([
      "乙女ゲー世界はモブに厳しい世界です2",
      "乙女ゲー世界はモブに厳しい世界です",
    ]);
  });
});
