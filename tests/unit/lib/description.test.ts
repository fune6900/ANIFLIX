import { describe, it, expect } from "vitest";
import {
  cleanCharacterDescription,
  truncateAtSentence,
  DESCRIPTION_MAX_CHARS,
} from "@/lib/description";

/**
 * AniList のキャラ説明の整形。
 *
 * 下の文字列は AniList から実際に取得した生データ。翻訳 API へ渡す前に
 * ここで削れた分だけ無料枠が延びる。スポイラーは画面にも出してはいけない。
 */

/** うずまきナルト（AniList id 17）の冒頭 */
const NARUTO_RAW =
  "__Height__: 145-180 cm \n__Family:__ ~![Minato Namikaze](https://anilist.co/character/2535) (father), [Kushina Uzumaki](https://anilist.co/character/7302) (mother)  !~\n\nBorn in Konohagakure, a ninja village hidden in the leaves, Naruto Uzumaki was destined for greatness. When born, a powerful [nine-tailed demon fox](https://anilist.co/character/7407) attacked his village.";

/** 碇シンジ（AniList id 89） */
const SHINJI_RAW =
  "__Height:__ 155 cm (5'1\")\n\nShinji Ikari is the Third Child, who pilots Unit 01. He is the son of [Gendo](https://anilist.co/character/1257) and the late [Yui Ikari](https://anilist.co/character/1258).\n\n~!Over time he learns to be less cowardly, but his progress is all undone.!~\n";

/** サクラ（AniList id 127）— メタデータ無しで本文から始まる */
const SAKURA_RAW =
  "Kind and upbeat, Sakura is the princess of the Kingdom of Clow and Syaoran's childhood friend.\n\n~!Moments before her death in Nihon Country, Sakura reveals that she is only a clone.!~";

describe("cleanCharacterDescription", () => {
  it("空の入力は空文字にする", () => {
    expect(cleanCharacterDescription("")).toBe("");
    expect(cleanCharacterDescription(null)).toBe("");
    expect(cleanCharacterDescription(undefined)).toBe("");
  });

  it("HTML タグを落とす", () => {
    expect(cleanCharacterDescription("a<br>b<b>c</b>")).toBe("a b c");
  });

  describe("スポイラー", () => {
    it("~!...!~ を丸ごと落とす", () => {
      const out = cleanCharacterDescription(SHINJI_RAW);
      expect(out).not.toContain("less cowardly");
      expect(out).not.toContain("~!");
      expect(out).not.toContain("!~");
    });

    it("本文の途中に挟まっていても落とす", () => {
      expect(cleanCharacterDescription("前 ~!秘密!~ 後")).toBe("前 後");
    });

    it("改行をまたぐスポイラーも落とす", () => {
      expect(cleanCharacterDescription("前 ~!秘\n密!~ 後")).toBe("前 後");
    });
  });

  describe("先頭のメタデータ", () => {
    it("__Height__: の行を落とす", () => {
      const out = cleanCharacterDescription(NARUTO_RAW);
      expect(out).not.toContain("145-180 cm");
      expect(out.startsWith("Born in Konohagakure")).toBe(true);
    });

    it("__Height:__ の書き方でも落とす", () => {
      const out = cleanCharacterDescription(SHINJI_RAW);
      expect(out).not.toContain("155 cm");
      expect(out.startsWith("Shinji Ikari is the Third Child")).toBe(true);
    });

    it("本文から始まる説明は先頭を削らない", () => {
      const out = cleanCharacterDescription(SAKURA_RAW);
      expect(out.startsWith("Kind and upbeat")).toBe(true);
    });

    it("本文中のコロンは消さない", () => {
      // 先頭のメタデータだけが対象。散文のコロンを消すと意味が壊れる
      const out = cleanCharacterDescription(
        "He had one rule: never look back. It served him well.",
      );
      expect(out).toBe("He had one rule: never look back. It served him well.");
    });
  });

  describe("マークダウン", () => {
    it("リンクはラベルだけ残して URL を落とす", () => {
      const out = cleanCharacterDescription(NARUTO_RAW);
      expect(out).toContain("nine-tailed demon fox");
      expect(out).not.toContain("anilist.co");
      expect(out).not.toContain("](");
    });

    it("裸の URL を落とす", () => {
      expect(
        cleanCharacterDescription("詳細は https://example.com/a を見よ"),
      ).toBe("詳細は を見よ");
    });

    it("強調記号を外して中身を残す", () => {
      expect(cleanCharacterDescription("a __太字__ b **強** c _斜_ d")).toBe(
        "a 太字 b 強 c 斜 d",
      );
    });
  });

  it("連続する空白と改行を詰める", () => {
    expect(cleanCharacterDescription("a  \n\n\n\n  b")).toBe("a\n\nb");
  });

  it("ルフィ級の長文を大幅に削る", () => {
    // 2,777 文字の実データに近い構成。整形だけで無駄が落ちること
    const bloated = `__Height:__ 174 cm\n__Affiliations:__ ~![Straw Hat Pirates](https://anilist.co/character/40) (Captain)!~\n\n${"Luffy is a pirate. ".repeat(50)}`;
    const out = cleanCharacterDescription(bloated);
    expect(out.length).toBeLessThan(bloated.length);
    expect(out.startsWith("Luffy is a pirate.")).toBe(true);
  });
});

describe("truncateAtSentence", () => {
  it("上限以下ならそのまま返す", () => {
    expect(truncateAtSentence("Short text.", 100)).toBe("Short text.");
  });

  it("上限内の最後の文末で切る", () => {
    const text = "One. Two. Three. Four.";
    expect(truncateAtSentence(text, 12)).toBe("One. Two.");
  });

  it("日本語の句点でも切る", () => {
    expect(truncateAtSentence("一つ目。二つ目。三つ目。", 8)).toBe(
      "一つ目。二つ目。",
    );
  });

  it("感嘆符・疑問符でも切る", () => {
    expect(truncateAtSentence("Wow! Really? Yes.", 12)).toBe("Wow! Really?");
  });

  it("上限内に文末が無ければ打ち切って省略記号を付ける", () => {
    expect(truncateAtSentence("aaaaaaaaaaaaaaaaaaaa", 10)).toBe("aaaaaaaaaa…");
  });

  it("空文字は空文字のまま", () => {
    expect(truncateAtSentence("", 10)).toBe("");
  });
});

describe("DESCRIPTION_MAX_CHARS", () => {
  it("翻訳へ流す上限が定数として固定されている", () => {
    // 無料枠の消費量に直結するので、変えるならテストごと変えること
    expect(DESCRIPTION_MAX_CHARS).toBe(600);
  });
});
