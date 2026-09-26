import "server-only";

/**
 * DeepL 翻訳クライアント
 *
 * DeepL API Free / Pro 両対応。`DEEPL_API_KEY` 環境変数で認証する。
 * キーが `:fx` で終わる場合は Free 版エンドポイント (api-free.deepl.com)、
 * それ以外は Pro 版エンドポイント (api.deepl.com) を優先する。
 *
 * - Server Component / Route Handler からのみ呼び出す（クライアント側での利用禁止）
 * - DEEPL_API_KEY 未設定時は原文をそのまま返す（throw しない）
 * - 鍵は trim + 引用符除去してから使う（`.env` の書き方で `:fx` 判定が崩れるため）
 * - 403 が返ったらもう一方のエンドポイントへ 1 度だけ入れ替えて再試行する
 * - 両方 403 なら 1 度だけ記録し、以後この実行では DeepL を呼ばない
 * - サーバープロセス内で in-memory LRU キャッシュ（最大 1000 件）を保持する
 */

// ──────────────────────────────────────────
// DeepL API レスポンス型
// ──────────────────────────────────────────

interface DeepLTranslation {
  detected_source_language: string;
  text: string;
}

interface DeepLResponse {
  translations: DeepLTranslation[];
}

// ──────────────────────────────────────────
// 内部: 簡易 LRU キャッシュ
// ──────────────────────────────────────────

const LRU_MAX = 1000;

/**
 * Map は挿入順を保持するため、先頭が「最も古いエントリ」になる。
 * サイズ超過時は先頭から削除することで簡易 LRU を実現する。
 */
const cache = new Map<string, string>();

function lruGet(key: string): string | undefined {
  const value = cache.get(key);
  if (value === undefined) return undefined;
  // アクセスされたエントリを末尾に移動（最近使用済みとして扱う）
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function lruSet(key: string, value: string): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= LRU_MAX) {
    // 最古エントリ（Map の先頭）を削除する
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, value);
}

// ──────────────────────────────────────────
// 内部: 日本語判定
// ──────────────────────────────────────────

/**
 * ひらがな・カタカナ・CJK 統合漢字を含む場合に日本語と判定する（簡易判定）。
 * すでに日本語のテキストを DeepL に送らないための早期リターン用。
 */
function isJapanese(text: string): boolean {
  return /[぀-ゟ゠-ヿ一-鿿]/.test(text);
}

// ──────────────────────────────────────────
// 内部: 認証キーとエンドポイント解決
// ──────────────────────────────────────────

const FREE_HOST = "api-free.deepl.com";
const PRO_HOST = "api.deepl.com";

/** DeepL の鍵の最短長。Pro は 36 文字、Free は末尾 ":fx" を足して 39 文字 */
const DEEPL_KEY_MIN_LENGTH = 36;

/** 鍵の体裁がおかしい旨を警告済みか（プロセス内で 1 度だけ出す） */
let keyShapeWarned = false;

/** 認証失敗を記録済みか（プロセス内で 1 度だけ出す） */
let authFailureLogged = false;

/**
 * 両エンドポイントで認証を拒否された状態。
 *
 * 鍵は実行中に変わらないため、以後叩き続けても同じ 403 を積むだけで、
 * リクエスト毎にログが膨らむ。立ったら DeepL を呼ばない。
 */
let deeplAuthFailed = false;

/**
 * 環境変数から鍵を取り出す。
 *
 * 前後の空白と引用符を落とす。`.env` に値をクォートで囲って書いたり
 * 改行が紛れたりすると `:fx` 判定が崩れ、Free の鍵が Pro のエンドポイントへ
 * 送られて 403 になる。原因が見えにくい壊れ方なのでここで吸収する。
 */
function resolveDeepLApiKey(): string | null {
  const raw = process.env.DEEPL_API_KEY;
  if (!raw) return null;

  const key = raw.trim().replace(/^["']|["']$/g, "");
  if (!key) return null;

  if (!keyShapeWarned && key.length < DEEPL_KEY_MIN_LENGTH) {
    keyShapeWarned = true;
    // 鍵そのものは出さない。長さだけで設定ミスを見分けられる
    console.warn(
      `[translate] DEEPL_API_KEY が DeepL の鍵の体裁を満たしていません（長さ ${key.length}、想定 ${DEEPL_KEY_MIN_LENGTH} 以上）。認証に失敗する可能性が高いです`,
    );
  }
  return key;
}

/** 鍵の末尾で Free / Pro を判定し、[優先, 予備] の順にホストを返す */
function resolveDeepLHosts(apiKey: string): [string, string] {
  return apiKey.endsWith(":fx") ? [FREE_HOST, PRO_HOST] : [PRO_HOST, FREE_HOST];
}

// ──────────────────────────────────────────
// 内部: DeepL API 呼び出し
// ──────────────────────────────────────────

/**
 * DeepL の `/v2/translate` を POST application/x-www-form-urlencoded で呼び出す。
 * `source_lang` は省略（自動検出）、`target_lang=JA` で固定。
 * 失敗した場合は null を返す（呼び出し元で原文にフォールバックする）。
 */
async function callDeepL(
  texts: string[],
  apiKey: string,
): Promise<DeepLResponse | null> {
  if (deeplAuthFailed) return null;

  const body = new URLSearchParams();
  body.append("target_lang", "JA");
  for (const text of texts) {
    body.append("text", text);
  }
  const payload = body.toString();

  const [primary, fallback] = resolveDeepLHosts(apiKey);

  const first = await postToDeepL(primary, apiKey, payload);
  if (first.kind === "ok") return first.data;
  if (first.kind === "error") return null;

  // 403 は認証失敗。Free の鍵に ":fx" が欠けている等の設定ミスを救うため、
  // もう一方のエンドポイントへ **一度だけ** 入れ替えて試す
  const second = await postToDeepL(fallback, apiKey, payload);
  if (second.kind === "ok") return second.data;

  if (second.kind === "forbidden") {
    deeplAuthFailed = true;
    if (!authFailureLogged) {
      authFailureLogged = true;
      console.error(
        `[translate] DEEPL_API_KEY が ${primary} / ${fallback} のどちらでも拒否されました（403）。鍵を確認してください。以後この実行では翻訳をスキップします`,
      );
    }
  }
  return null;
}

/** 1 エンドポイントへの POST 結果。403 だけは呼び出し側で分岐したいので区別する */
type DeepLAttempt =
  | { kind: "ok"; data: DeepLResponse }
  | { kind: "forbidden" }
  | { kind: "error" };

async function postToDeepL(
  host: string,
  apiKey: string,
  payload: string,
): Promise<DeepLAttempt> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let response: Response;
  try {
    response = await fetch(`https://${host}/v2/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload,
      signal: controller.signal,
    });
  } catch (err) {
    console.error("[translate] DeepL fetch error:", err);
    return { kind: "error" };
  } finally {
    clearTimeout(timeoutId);
  }

  // 認証失敗はログを出さずに返す。呼び出し側が再試行を挟んだうえで
  // 最終的に 1 度だけ記録する
  if (response.status === 403) return { kind: "forbidden" };

  if (!response.ok) {
    console.error(
      "[translate] DeepL API error:",
      response.status,
      response.statusText,
    );
    return { kind: "error" };
  }

  try {
    return { kind: "ok", data: (await response.json()) as DeepLResponse };
  } catch (err) {
    console.error("[translate] DeepL response parse error:", err);
    return { kind: "error" };
  }
}

// ──────────────────────────────────────────
// 公開 API
// ──────────────────────────────────────────

/**
 * 単一テキストを日本語に翻訳して返す。
 *
 * - 元テキストが日本語（ひらがな / カタカナ / 漢字を含む）であればそのまま返す
 * - DEEPL_API_KEY 未設定時は原文を返す（throw しない）
 * - 翻訳失敗時は console.error してから原文を返す（画面全体が落ちないように）
 * - サーバー内で in-memory LRU キャッシュを参照 / 更新する
 */
export async function translateToJa(text: string): Promise<string> {
  if (!text || isJapanese(text)) return text;

  const cached = lruGet(text);
  if (cached !== undefined) return cached;

  const apiKey = resolveDeepLApiKey();
  if (!apiKey) return text;

  const result = await callDeepL([text], apiKey);
  const translated = result?.translations?.[0]?.text ?? null;
  if (!translated) {
    // 認証が壊れている時は callDeepL 側で 1 度記録済み。ここで毎回出すと
    // リクエスト毎に同じ内容がログへ積み上がる
    if (!deeplAuthFailed) {
      console.error(
        "[translate] translateToJa: no translation returned for:",
        text,
      );
    }
    return text;
  }

  lruSet(text, translated);
  return translated;
}

/**
 * 複数テキストをまとめて日本語に翻訳して返す。
 *
 * - キャッシュヒット分は API を呼ばずに返す（キャッシュミスのみ一括送信）
 * - 入力と同じ順序・同じ長さの配列を返す
 * - 翻訳失敗時は該当要素を原文のままにする（throw しない）
 */
export async function translateManyToJa(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];

  const apiKey = resolveDeepLApiKey();

  // 各テキストのキャッシュ状態と送信対象インデックスを収集する
  const results: string[] = [...texts];
  const missIndices: number[] = [];
  const missTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (!text || isJapanese(text)) {
      // 空文字 or 既に日本語 → そのまま
      continue;
    }
    const cached = lruGet(text);
    if (cached !== undefined) {
      results[i] = cached;
    } else {
      missIndices.push(i);
      missTexts.push(text);
    }
  }

  if (missTexts.length === 0 || !apiKey) return results;

  const apiResult = await callDeepL(missTexts, apiKey);
  if (!apiResult) {
    console.error(
      "[translate] translateManyToJa: API call failed, returning originals for",
      missTexts.length,
      "texts",
    );
    return results;
  }

  for (let j = 0; j < missIndices.length; j++) {
    const translated = apiResult.translations?.[j]?.text ?? null;
    if (translated) {
      const originalIndex = missIndices[j];
      results[originalIndex] = translated;
      lruSet(missTexts[j], translated);
    }
  }

  return results;
}
