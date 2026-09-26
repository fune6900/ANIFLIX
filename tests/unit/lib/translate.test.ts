import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

/**
 * Google Cloud Translation クライアント。
 *
 * ここはグローバル `fetch` を直接スタブする。GET で呼ぶか、Data Cache に
 * 載せる `next.revalidate` を付けるか、認証・枠超過で叩くのを止めるかは
 * `fetch` の呼ばれ方にしか現れず、`@/lib/translate` をモックすると
 * 検証対象ごと消えるため（`@.claude/rules/testing.md` モック方針の例外）。
 *
 * Google は **API キーをクエリ文字列に載せる**。URL をそのままログへ出すと
 * 鍵が漏れるので、その点もテストで縛る。
 */

const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";

/** Google の API キーの体裁に合わせたダミー（値そのものに意味は無い） */
const KEY = "AIzaSy0000000000000000000000000000000";

type FetchFn = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

let fetchMock: Mock<FetchFn>;

/** Google の成功レスポンス */
function translations(...texts: string[]) {
  return {
    status: 200,
    body: { data: { translations: texts.map((t) => ({ translatedText: t })) } },
  };
}

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

function requestUrl(index = 0): URL {
  const raw = fetchMock.mock.calls[index]?.[0];
  if (raw === undefined) throw new Error("fetch が呼ばれていない");
  return new URL(String(raw));
}

function requestInit(index = 0): RequestInit | undefined {
  return fetchMock.mock.calls[index]?.[1];
}

async function loadTranslate() {
  return import("@/lib/translate");
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_TRANSLATE_API_KEY", KEY);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  stubFetchSequence([translations("翻訳済み")]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("translateToJa", () => {
  describe("リクエストの組み立て", () => {
    it("公式エンドポイントへ GET で送る", async () => {
      const { translateToJa } = await loadTranslate();
      await translateToJa("hello");

      const url = requestUrl();
      expect(`${url.origin}${url.pathname}`).toBe(ENDPOINT);
      const method = requestInit()?.method;
      expect(method === undefined || method === "GET").toBe(true);
    });

    it("翻訳先・書式・本文をクエリに載せる", async () => {
      const { translateToJa } = await loadTranslate();
      await translateToJa("hello");

      const q = requestUrl().searchParams;
      expect(q.get("target")).toBe("ja");
      expect(q.get("format")).toBe("text");
      expect(q.getAll("q")).toEqual(["hello"]);
    });

    it("API キーをクエリに載せる", async () => {
      const { translateToJa } = await loadTranslate();
      await translateToJa("hello");

      expect(requestUrl().searchParams.get("key")).toBe(KEY);
    });

    it("Data Cache に載せるため revalidate を付ける", async () => {
      // 同じ英文の訳は変わらない。ここが無いとコールドスタートの度に
      // 同じテキストを翻訳し直して無料枠を焼く
      const { translateToJa } = await loadTranslate();
      await translateToJa("hello");

      const next = requestInit()?.next;
      expect(next?.revalidate).toBeGreaterThan(0);
    });
  });

  describe("鍵の取り扱い", () => {
    it("前後の空白と引用符を落としてから使う", async () => {
      vi.stubEnv("GOOGLE_TRANSLATE_API_KEY", `  "${KEY}"\n`);
      const { translateToJa } = await loadTranslate();
      await translateToJa("hello");

      expect(requestUrl().searchParams.get("key")).toBe(KEY);
    });

    it("空白だけの鍵は未設定として扱い API を叩かない", async () => {
      vi.stubEnv("GOOGLE_TRANSLATE_API_KEY", "   ");
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("hello")).toBe("hello");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("鍵の体裁が違う時は一度だけ警告する", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv("GOOGLE_TRANSLATE_API_KEY", "too-short");
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");
      await translateToJa("world");

      expect(warn).toHaveBeenCalledTimes(1);
    });

    it("ログに鍵を出さない", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      stubFetchSequence([{ status: 403 }]);
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");

      const logged = error.mock.calls.flat().map(String).join(" ");
      expect(logged).not.toContain(KEY);
      expect(logged).not.toContain("key=");
    });
  });

  describe("失敗時の振る舞い", () => {
    it("認証に失敗したら原文を返す", async () => {
      stubFetchSequence([{ status: 403 }]);
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("hello")).toBe("hello");
    });

    it("認証に失敗した後は API を叩かない", async () => {
      stubFetchSequence([{ status: 403 }]);
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");
      const after = fetchMock.mock.calls.length;
      await translateToJa("world");

      expect(fetchMock.mock.calls.length).toBe(after);
    });

    it("枠を使い切ったら以後叩かず一度だけ記録する", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      stubFetchSequence([{ status: 429 }]);
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");
      await translateToJa("world");
      await translateToJa("again");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledTimes(1);
    });

    it("一時的なエラーでは翻訳を止めない", async () => {
      // 500 は設定の問題ではないので、次のリクエストでは再び試す
      stubFetchSequence([{ status: 500 }, translations("翻訳済み")]);
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("hello")).toBe("hello");
      expect(await translateToJa("world")).toBe("翻訳済み");
    });

    it("fetch が reject しても throw せず原文を返す", async () => {
      fetchMock = vi.fn<FetchFn>(async () => {
        throw new Error("ECONNREFUSED");
      });
      vi.stubGlobal("fetch", fetchMock);
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("hello")).toBe("hello");
    });
  });

  describe("レスポンスの解釈", () => {
    it("翻訳結果を返す", async () => {
      const { translateToJa } = await loadTranslate();
      expect(await translateToJa("hello")).toBe("翻訳済み");
    });

    it("HTML エンティティを元の文字に戻す", async () => {
      // Google は format=text でも &#39; などを返すことがある
      stubFetchSequence([
        translations("&quot;彼&quot;の&#39;力&#39; &amp; 勇気"),
      ]);
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("hello")).toBe("\"彼\"の'力' & 勇気");
    });

    it("翻訳が返らなければ原文を返す", async () => {
      stubFetchSequence([
        { status: 200, body: { data: { translations: [] } } },
      ]);
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("hello")).toBe("hello");
    });
  });

  describe("既存の挙動（回帰）", () => {
    it("鍵が未設定なら API を叩かず原文を返す", async () => {
      vi.stubEnv("GOOGLE_TRANSLATE_API_KEY", "");
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("hello")).toBe("hello");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("既に日本語なら API を叩かない", async () => {
      const { translateToJa } = await loadTranslate();

      expect(await translateToJa("こんにちは")).toBe("こんにちは");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("同じ文字列は二度目に API を叩かない", async () => {
      const { translateToJa } = await loadTranslate();

      await translateToJa("hello");
      await translateToJa("hello");

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe("translateManyToJa", () => {
  it("一度のリクエストにまとめて載せる", async () => {
    stubFetchSequence([translations("あ", "い", "う")]);
    const { translateManyToJa } = await loadTranslate();

    const out = await translateManyToJa(["a", "b", "c"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestUrl().searchParams.getAll("q")).toEqual(["a", "b", "c"]);
    expect(out).toEqual(["あ", "い", "う"]);
  });

  it("URL が長くなりすぎる場合は分割して送る", async () => {
    // GET のクエリに載せる以上、1 リクエストの URL 長には上限がある
    stubFetchSequence([translations("訳")]);
    const { translateManyToJa } = await loadTranslate();

    const long = Array.from({ length: 20 }, (_, i) => `${"x".repeat(300)}${i}`);
    await translateManyToJa(long);

    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0]).length).toBeLessThanOrEqual(2000);
    }
  });

  it("入力と同じ順序・長さで返す", async () => {
    stubFetchSequence([{ status: 403 }]);
    const { translateManyToJa } = await loadTranslate();

    expect(await translateManyToJa(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("日本語と空文字は API に送らない", async () => {
    stubFetchSequence([translations("えい")]);
    const { translateManyToJa } = await loadTranslate();

    await translateManyToJa(["こんにちは", "", "english"]);

    expect(requestUrl().searchParams.getAll("q")).toEqual(["english"]);
  });
});
