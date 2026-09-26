import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

/**
 * DeepL クライアント。
 *
 * ここはグローバル `fetch` を直接スタブする。どのエンドポイントを選ぶか、
 * 403 のときにもう一方へ再試行するか、認証失敗を何度ログに出すかは
 * `fetch` の呼ばれ方にしか現れず、`@/lib/translate` をモックすると
 * 検証対象ごと消えるため（`@.claude/rules/testing.md` モック方針の例外 5）。
 */

const FREE_HOST = "api-free.deepl.com";
const PRO_HOST = "api.deepl.com";

/** DeepL の実キーの体裁に合わせた長さのダミー（値そのものに意味は無い） */
const PRO_KEY = "00000000-1111-2222-3333-444444444444";
const FREE_KEY = `${PRO_KEY}:fx`;

type FetchFn = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

let fetchMock: Mock<FetchFn>;

/** 呼ばれた順にレスポンスを返す fetch スタブ */
function stubFetchSequence(
  responses: Array<{ status: number; body?: unknown }>,
): void {
  let i = 0;
  fetchMock = vi.fn<FetchFn>(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return Response.json(r.body ?? {}, { status: r.status });
  });
  vi.stubGlobal("fetch", fetchMock);
}

/** 翻訳が成功したときの DeepL レスポンス */
function ok(text: string) {
  return {
    status: 200,
    body: { translations: [{ detected_source_language: "EN", text }] },
  };
}

function calledHosts(): string[] {
  return fetchMock.mock.calls.map((c) => new URL(String(c[0])).host);
}

function authHeaderOf(index: number): string {
  const headers = fetchMock.mock.calls[index]?.[1]?.headers;
  if (!headers) throw new Error("Authorization ヘッダーが渡されていない");
  return new Headers(headers).get("Authorization") ?? "";
}

async function loadTranslate() {
  return import("@/lib/translate");
}

beforeEach(() => {
  vi.stubEnv("DEEPL_API_KEY", PRO_KEY);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  stubFetchSequence([ok("翻訳済み")]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("translateToJa", () => {
  describe("キーの取り扱い", () => {
    it("前後の空白を落としてから使う", async () => {
      vi.stubEnv("DEEPL_API_KEY", `  ${FREE_KEY}\n`);
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");

      expect(authHeaderOf(0)).toBe(`DeepL-Auth-Key ${FREE_KEY}`);
    });

    it("引用符で囲まれていても外す", async () => {
      vi.stubEnv("DEEPL_API_KEY", `"${PRO_KEY}"`);
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");

      expect(authHeaderOf(0)).toBe(`DeepL-Auth-Key ${PRO_KEY}`);
    });

    it("空白だけのキーは未設定として扱い API を叩かない", async () => {
      vi.stubEnv("DEEPL_API_KEY", "   ");
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("hello")).toBe("hello");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("キーが DeepL の体裁を満たさない時は一度だけ警告する", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv("DEEPL_API_KEY", "too-short-key");
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");
      await translateToJa("world");

      expect(warn).toHaveBeenCalledTimes(1);
    });

    it("ログにキーそのものを出さない", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      stubFetchSequence([{ status: 403 }, { status: 403 }]);
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");

      const logged = [...error.mock.calls, ...warn.mock.calls]
        .flat()
        .map(String)
        .join(" ");
      expect(logged).not.toContain(PRO_KEY);
    });
  });

  describe("エンドポイントの選択", () => {
    it(":fx で終わるキーは Free エンドポイントへ送る", async () => {
      vi.stubEnv("DEEPL_API_KEY", FREE_KEY);
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");

      expect(calledHosts()[0]).toBe(FREE_HOST);
    });

    it(":fx で終わらないキーは Pro エンドポイントへ送る", async () => {
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");

      expect(calledHosts()[0]).toBe(PRO_HOST);
    });
  });

  describe("403 のときのフォールバック", () => {
    it("もう一方のエンドポイントへ一度だけ再試行する", async () => {
      // Free キーなのに :fx が欠けている設定ミスを救う
      stubFetchSequence([{ status: 403 }, ok("翻訳済み")]);
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");

      expect(calledHosts()).toEqual([PRO_HOST, FREE_HOST]);
    });

    it("再試行で成功したら翻訳結果を返す", async () => {
      stubFetchSequence([{ status: 403 }, ok("翻訳済み")]);
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("hello")).toBe("翻訳済み");
    });

    it("両方 403 なら原文を返す", async () => {
      stubFetchSequence([{ status: 403 }, { status: 403 }]);
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("hello")).toBe("hello");
    });

    it("403 以外のエラーでは再試行しない", async () => {
      stubFetchSequence([{ status: 500 }]);
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("認証が壊れている間の振る舞い", () => {
    it("両方 403 になった後は API を叩かない", async () => {
      stubFetchSequence([{ status: 403 }, { status: 403 }]);
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");
      const callsAfterFirst = fetchMock.mock.calls.length;
      await translateToJa("world");

      expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
    });

    it("認証失敗のログはプロセス内で一度だけ", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      stubFetchSequence([{ status: 403 }, { status: 403 }]);
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");
      await translateToJa("world");
      await translateToJa("again");

      const authLogs = error.mock.calls.filter((c) =>
        c.map(String).join(" ").includes("DEEPL_API_KEY"),
      );
      expect(authLogs).toHaveLength(1);
    });

    it("認証が壊れていても原文を返して画面を落とさない", async () => {
      stubFetchSequence([{ status: 403 }, { status: 403 }]);
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");

      expect(await translateToJa("world")).toBe("world");
    });
  });

  describe("既存の挙動（回帰）", () => {
    it("キー未設定なら API を叩かず原文を返す", async () => {
      vi.stubEnv("DEEPL_API_KEY", "");
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("hello")).toBe("hello");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("既に日本語なら API を叩かない", async () => {
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("こんにちは")).toBe("こんにちは");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("翻訳に成功したら結果を返す", async () => {
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("hello")).toBe("翻訳済み");
    });

    it("同じ文字列は二度目に API を叩かない（LRU キャッシュ）", async () => {
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");
      await translateToJa("hello");

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe("translateManyToJa", () => {
  it("両方 403 でも入力と同じ順序・長さで原文を返す", async () => {
    stubFetchSequence([{ status: 403 }, { status: 403 }]);
    const { translateManyToJa } = await loadTranslate();

    expect(await translateManyToJa(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("認証が壊れた後は API を叩かない", async () => {
    stubFetchSequence([{ status: 403 }, { status: 403 }]);
    const { translateToJa, translateManyToJa } = await loadTranslate();

    await translateToJa("hello");
    const before = fetchMock.mock.calls.length;
    await translateManyToJa(["x", "y"]);

    expect(fetchMock.mock.calls.length).toBe(before);
  });
});
