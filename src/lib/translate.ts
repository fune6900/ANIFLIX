import "server-only";

/**
 * Google Cloud Translation v2 クライアント
 *
 * `GOOGLE_TRANSLATE_API_KEY` 環境変数で認証する。
 *
 * - Server Component / Route Handler からのみ呼び出す（クライアント側での利用禁止）
 * - 鍵が未設定なら原文をそのまま返す（throw しない）
 * - **GET で呼び `next.revalidate` を付ける**。同じ英文の訳は変わらないため、
 *   Next の Data Cache に載せて同じテキストを二度と翻訳しない。プロセス内の
 *   LRU だけだとサーバーレスのコールドスタートで消え、無料枠を焼き続ける
 * - 鍵はクエリ文字列に載るため、**URL をそのままログへ出さない**
 * - 認証失敗・枠超過を検知したら 1 度だけ記録し、以後この実行では呼ばない
 */

// ──────────────────────────────────────────
// API レスポンス型
// ──────────────────────────────────────────

interface GoogleTranslation {
  translatedText: string;
  detectedSourceLanguage?: string;
}

interface GoogleTranslateResponse {
  data?: { translations?: GoogleTranslation[] };
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: Array<{ reason?: string }>;
  };
}

// ──────────────────────────────────────────
// 内部: 簡易 LRU キャッシュ
// ──────────────────────────────────────────

const LRU_MAX = 1000;

/**
 * Map は挿入順を保持するため、先頭が「最も古いエントリ」になる。
 * サイズ超過時は先頭から削除することで簡易 LRU を実現する。
 *
 * これは同一プロセス内の重複を潰すだけの一次キャッシュ。実質的な削減は
 * Data Cache（`next.revalidate`）が担う。
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
 * すでに日本語のテキストを翻訳 API に送らないための早期リターン用。
 */
function isJapanese(text: string): boolean {
  return /[぀-ゟ゠-ヿ一-鿿]/.test(text);
}

// ──────────────────────────────────────────
// 内部: 定数と状態
// ──────────────────────────────────────────

const TRANSLATE_ENDPOINT =
  "https://translation.googleapis.com/language/translate/v2";

/**
 * 翻訳結果のキャッシュ秒数（30 日）。
 * 同じ英文に対する訳は変わらないため長く持つ。ここが無料枠の消費量を決める。
 */
const TRANSLATION_CACHE_SECONDS = 2592000;

/** GET のクエリに載せられる URL の上限。超える分はリクエストを分割する */
const MAX_REQUEST_URL_LENGTH = 2000;

/** Google の API キーの体裁（`AIza` + 英数字） */
const GOOGLE_API_KEY_PATTERN = /^AIza[A-Za-z0-9_-]{30,}$/;

/** 鍵の体裁がおかしい旨を警告済みか（プロセス内で 1 度だけ出す） */
let keyShapeWarned = false;

/** 翻訳を止めた理由を記録済みか（プロセス内で 1 度だけ出す） */
let disableLogged = false;

/**
 * 認証失敗・枠超過で翻訳を止めた状態。
 *
 * 鍵も残枠も実行中には直らない。叩き続けても同じエラーを積むだけで、
 * リクエスト毎にログが膨らむ。立ったら API を呼ばない。
 */
let translationDisabled = false;

// ──────────────────────────────────────────
// 内部: 鍵の解決
// ──────────────────────────────────────────

/**
 * 環境変数から鍵を取り出す。
 *
 * 前後の空白と引用符を落とす。`.env` に値をクォートで囲って書いたり
 * 改行が紛れたりすると、そのままクエリに載って認証が通らない。
 */
function resolveApiKey(): string | null {
  const raw = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!raw) return null;

  const key = raw.trim().replace(/^["']|["']$/g, "");
  if (!key) return null;

  if (!keyShapeWarned && !GOOGLE_API_KEY_PATTERN.test(key)) {
    keyShapeWarned = true;
    // 鍵そのものは出さない。長さだけで設定ミスを見分けられる
    console.warn(
      `[translate] GOOGLE_TRANSLATE_API_KEY が Google の鍵の体裁（AIza で始まる英数字）を満たしていません（長さ ${key.length}）。認証に失敗する可能性が高いです`,
    );
  }
  return key;
}

// ──────────────────────────────────────────
// 内部: API 呼び出し
// ──────────────────────────────────────────

type TranslateOutcome =
  | { kind: "ok"; texts: string[] }
  | { kind: "auth" }
  | { kind: "quota" }
  | { kind: "error" };

/** 鍵と固定パラメータだけのクエリ。q は呼び出し側で足す */
function baseParams(apiKey: string): URLSearchParams {
  return new URLSearchParams({ target: "ja", format: "text", key: apiKey });
}

/**
 * URL 長が上限を超えないようにテキストの添字をまとめる。
 * 単独でも収まらないテキストはどの塊にも入れない（原文のまま返す）。
 */
function chunkIndices(texts: string[], apiKey: string): number[][] {
  const baseLength = `${TRANSLATE_ENDPOINT}?${baseParams(apiKey).toString()}`
    .length;

  const chunks: number[][] = [];
  let current: number[] = [];
  let currentLength = baseLength;

  for (let i = 0; i < texts.length; i++) {
    const cost = `&q=${encodeURIComponent(texts[i])}`.length;
    if (baseLength + cost > MAX_REQUEST_URL_LENGTH) continue;

    if (current.length > 0 && currentLength + cost > MAX_REQUEST_URL_LENGTH) {
      chunks.push(current);
      current = [];
      currentLength = baseLength;
    }
    current.push(i);
    currentLength += cost;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** 1 リクエスト分の翻訳。失敗の種類を呼び出し側へ返す */
async function requestTranslation(
  texts: string[],
  apiKey: string,
): Promise<TranslateOutcome> {
  const params = baseParams(apiKey);
  for (const text of texts) params.append("q", text);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let response: Response;
  try {
    response = await fetch(`${TRANSLATE_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
      // 同じ英文の訳は変わらない。Data Cache に載せて再翻訳を防ぐ
      next: { revalidate: TRANSLATION_CACHE_SECONDS },
    });
  } catch (err) {
    // URL には鍵が載っているので、エラーは名前だけ出す
    const name = err instanceof Error ? err.name : "unknown error";
    console.error("[translate] リクエストに失敗しました:", name);
    return { kind: "error" };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return classifyFailure(response);
  }

  let payload: GoogleTranslateResponse;
  try {
    payload = (await response.json()) as GoogleTranslateResponse;
  } catch {
    console.error("[translate] レスポンスを解釈できませんでした");
    return { kind: "error" };
  }

  const translated = payload.data?.translations;
  if (!translated || translated.length === 0) return { kind: "error" };

  return {
    kind: "ok",
    texts: translated.map((t) => decodeHtmlEntities(t.translatedText)),
  };
}

/** HTTP ステータスとエラー本文から、止めるべき失敗かを判定する */
async function classifyFailure(response: Response): Promise<TranslateOutcome> {
  let reason = "";
  try {
    const body = (await response.json()) as GoogleTranslateResponse;
    reason = body.error?.errors?.[0]?.reason ?? body.error?.status ?? "";
  } catch {
    // 本文が読めなければステータスだけで判定する
  }

  const quotaReasons = [
    "dailyLimitExceeded",
    "userRateLimitExceeded",
    "rateLimitExceeded",
    "quotaExceeded",
    "RESOURCE_EXHAUSTED",
  ];
  if (response.status === 429 || quotaReasons.includes(reason)) {
    return { kind: "quota" };
  }
  if ([400, 401, 403].includes(response.status)) {
    return { kind: "auth" };
  }

  console.error("[translate] API エラー:", response.status, reason);
  return { kind: "error" };
}

/** 翻訳を止め、理由を 1 度だけ記録する */
function disableTranslation(kind: "auth" | "quota"): void {
  translationDisabled = true;
  if (disableLogged) return;
  disableLogged = true;

  // 鍵を含む URL は絶対に出さない
  console.error(
    kind === "auth"
      ? "[translate] GOOGLE_TRANSLATE_API_KEY が拒否されました。鍵と Cloud Translation API の有効化を確認してください。以後この実行では翻訳をスキップします"
      : "[translate] Google Cloud Translation の割り当てを使い切りました。以後この実行では翻訳をスキップします",
  );
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
};

/** Google は format=text でも実体参照を返すことがある */
function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(?:amp|lt|gt|quot|apos|nbsp);|&#(\d+);/g,
    (match, code: string | undefined) =>
      code
        ? String.fromCodePoint(Number(code))
        : (HTML_ENTITIES[match] ?? match),
  );
}

/** 添字を保ったまま翻訳する。翻訳できなかった要素は null */
async function translateTexts(
  texts: string[],
  apiKey: string,
): Promise<Array<string | null>> {
  const out: Array<string | null> = new Array(texts.length).fill(null);
  if (translationDisabled) return out;

  for (const indices of chunkIndices(texts, apiKey)) {
    const outcome = await requestTranslation(
      indices.map((i) => texts[i]),
      apiKey,
    );

    if (outcome.kind === "auth" || outcome.kind === "quota") {
      disableTranslation(outcome.kind);
      break;
    }
    if (outcome.kind !== "ok") continue;

    indices.forEach((index, position) => {
      out[index] = outcome.texts[position] ?? null;
    });
  }
  return out;
}

// ──────────────────────────────────────────
// 公開 API
// ──────────────────────────────────────────

/**
 * 単一テキストを日本語に翻訳して返す。
 *
 * - 元テキストが日本語（ひらがな / カタカナ / 漢字を含む）であればそのまま返す
 * - 鍵が未設定・翻訳が停止中なら原文を返す（throw しない）
 * - 翻訳失敗時も原文を返す（画面全体が落ちないように）
 */
export async function translateToJa(text: string): Promise<string> {
  if (!text || isJapanese(text)) return text;

  const cached = lruGet(text);
  if (cached !== undefined) return cached;

  const apiKey = resolveApiKey();
  if (!apiKey) return text;

  const [translated] = await translateTexts([text], apiKey);
  if (!translated) return text;

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

  const apiKey = resolveApiKey();

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

  const translated = await translateTexts(missTexts, apiKey);
  translated.forEach((value, position) => {
    if (!value) return;
    const index = missIndices[position];
    results[index] = value;
    lruSet(texts[index], value);
  });

  return results;
}
