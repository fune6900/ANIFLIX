/**
 * DeepL 翻訳クライアント
 *
 * DeepL API Free / Pro 両対応。`DEEPL_API_KEY` 環境変数で認証する。
 * キーが `:fx` で終わる場合は Free 版エンドポイント (api-free.deepl.com)、
 * それ以外は Pro 版エンドポイント (api.deepl.com) を自動選択する。
 *
 * - Server Component / Route Handler からのみ呼び出す（クライアント側での利用禁止）
 * - DEEPL_API_KEY 未設定時は原文をそのまま返す（throw しない）
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
// 内部: エンドポイント解決
// ──────────────────────────────────────────

function resolveDeepLEndpoint(apiKey: string): string {
  const host = apiKey.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
  return `https://${host}/v2/translate`;
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
  const endpoint = resolveDeepLEndpoint(apiKey);

  const body = new URLSearchParams();
  body.append("target_lang", "JA");
  for (const text of texts) {
    body.append("text", text);
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
  } catch (err) {
    console.error("[translate] DeepL fetch error:", err);
    return null;
  }

  if (!response.ok) {
    console.error(
      "[translate] DeepL API error:",
      response.status,
      response.statusText,
    );
    return null;
  }

  return (await response.json()) as DeepLResponse;
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

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return text;

  const result = await callDeepL([text], apiKey);
  const translated = result?.translations?.[0]?.text ?? null;
  if (!translated) {
    console.error(
      "[translate] translateToJa: no translation returned for:",
      text,
    );
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

  const apiKey = process.env.DEEPL_API_KEY;

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
