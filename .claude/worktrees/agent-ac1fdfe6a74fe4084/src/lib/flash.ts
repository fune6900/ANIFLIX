/**
 * フラッシュメッセージ（ログイン・ログアウトの結果通知）。
 *
 * DB もセッションストアも無く、さらに **Server Component は Cookie を削除できない**
 * （設定・削除は Server Action と Route Handler のみ）ため、古典的な
 * 「読んだら消す Cookie フラッシュ」は成立しない。
 *
 * 代わりにクエリパラメータで運ぶ。`signIn("google", { redirectTo })` の
 * `redirectTo` はこちらが組み立てるので、OAuth の往復を跨いで遷移先まで届く。
 * 表示後はクライアント側で URL から落とす（`src/components/FlashMessage.tsx`）。
 *
 * **パラメータの値をそのまま画面へ出さないこと。** ここで対応表に照らし、
 * 知らない値は表示しない。利用者が自由に書ける入力を反射させない。
 */

export const FLASH_PARAM = "flash";
export const FLASH_REASON_PARAM = "reason";

export type FlashKind = "signed-in" | "signed-out" | "sign-in-failed";

export type FlashTone = "success" | "error";

export interface Flash {
  kind: FlashKind;
  tone: FlashTone;
  message: string;
}

const FLASHES: Record<FlashKind, { tone: FlashTone; message: string }> = {
  "signed-in": { tone: "success", message: "ログインしました" },
  "signed-out": { tone: "success", message: "ログアウトしました" },
  "sign-in-failed": {
    tone: "error",
    message: "ログインに失敗しました。もう一度お試しください。",
  },
};

/**
 * Auth.js が `?error=` に載せてくるエラーコードと、利用者向け文言の対応表。
 * 未知のコードは内部情報を晒さないよう既定文言へ丸める。
 */
const SIGN_IN_FAILURE_MESSAGES: Record<string, string> = {
  Configuration: "認証の設定に問題があります。時間をおいて再度お試しください。",
  AccessDenied:
    "アクセスが拒否されました。別の Google アカウントでお試しください。",
  Verification:
    "リンクの有効期限が切れています。もう一度ログインしてください。",
};

function isFlashKind(value: string): value is FlashKind {
  return Object.prototype.hasOwnProperty.call(FLASHES, value);
}

/**
 * 遷移先 URL にフラッシュを載せる。
 *
 * 戻り値は必ず自サイト内の絶対パス（`pathname` + `search`）。
 * 同じパラメータが既にあれば上書きし、二重に付けない。
 */
export function withFlash(
  url: string,
  kind: FlashKind,
  reason?: string,
): string {
  // 第2引数はパースを通すためのダミー。pathname と search しか使わない
  const parsed = new URL(url || "/", "http://localhost");
  parsed.searchParams.set(FLASH_PARAM, kind);
  if (reason) {
    parsed.searchParams.set(FLASH_REASON_PARAM, reason);
  } else {
    parsed.searchParams.delete(FLASH_REASON_PARAM);
  }
  return `${parsed.pathname}${parsed.search}`;
}

/**
 * クエリパラメータを表示用のフラッシュへ変換する。
 *
 * @returns 対応表に無い値なら null（何も表示しない）
 */
export function parseFlash(
  kind: string | null | undefined,
  reason?: string | null,
): Flash | null {
  if (!kind || !isFlashKind(kind)) return null;

  const base = FLASHES[kind];
  if (kind !== "sign-in-failed" || !reason) {
    return { kind, ...base };
  }

  const detailed = Object.prototype.hasOwnProperty.call(
    SIGN_IN_FAILURE_MESSAGES,
    reason,
  )
    ? SIGN_IN_FAILURE_MESSAGES[reason]
    : base.message;

  return { kind, tone: base.tone, message: detailed };
}
