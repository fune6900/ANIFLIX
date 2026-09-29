import "server-only";
import type { TurnstileSiteVerifyResponse } from "@/types/turnstile";
import { TURNSTILE_LOGIN_ACTION } from "@/lib/turnstile-action";

/**
 * Cloudflare Turnstile のサーバー側検証。
 *
 * ログイン画面（`/login`）は Middleware のガード対象外で、未認証のまま
 * 無制限に到達できる唯一のページ。ここのフォーム送信を人間に限定するために使う。
 *
 * `TURNSTILE_SECRET_KEY` 未設定時の扱いは環境で変える:
 * - 本番: 検証失敗（fail-closed）。設定漏れで bot 対策が無言で消えるのを防ぐ
 * - それ以外: 検証をスキップ。Cloudflare アカウント無しでもローカル開発できる
 */

const SITEVERIFY_ENDPOINT =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** siteverify の応答待ち上限（ミリ秒）。他の外部 API クライアントと揃える */
const VERIFY_TIMEOUT_MS = 8000;

/** 検証に失敗した理由。利用者向け文言は `@/lib/turnstile-messages` が持つ */
export type TurnstileFailureReason =
  /** 本番なのにシークレットが無い（設定事故） */
  | "misconfigured"
  /** シークレットはあるがトークンが送られてこなかった */
  | "missing-token"
  /** siteverify が success: false を返した（失効・二重使用・改竄） */
  | "invalid-token"
  /** siteverify へ到達できなかった */
  | "network-error"
  /** 別の action（別フォーム用のウィジェット）で解かれたトークン */
  | "action-mismatch"
  /** 想定外のドメインで解かれたトークン（開発用ウィジェットの使い回し等） */
  | "hostname-mismatch";

/**
 * 検証結果。
 * `skipped` を成功側にだけ持たせることで、「検証を通った」と
 * 「検証をスキップした」を呼び出し側が区別できる。
 */
export type TurnstileVerdict =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: TurnstileFailureReason };

/** "Host:443" / "Host, 中継" から先頭のホスト名だけを小文字で取り出す（siteverify の hostname はポートを含まない） */
function toHostname(raw: string | undefined | null): string | null {
  const first = raw?.split(",")[0]?.trim().toLowerCase();
  if (!first) return null;
  try {
    return new URL(`http://${first}`).hostname || null;
  } catch {
    return null;
  }
}

/**
 * トークンを解いてよいホスト名。優先順:
 * 1. `TURNSTILE_ALLOWED_HOSTNAMES`（カンマ区切り）
 * 2. `AUTH_URL` のホスト名
 * 3. リクエストの Host（x-forwarded-host を優先。リバースプロキシ配下で内部の Host にずれないように）
 *
 * @returns null なら照合しない（本番以外で許可リストを明示していないとき。
 *   Cloudflare のテストキーは hostname に example.com を返すため、照合すると開発でログインできない）
 */
function allowedHostnames(requestHost: string | undefined): string[] | null {
  const explicit = (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map((h) => toHostname(h))
    .filter((h): h is string => h !== null);
  if (explicit.length > 0) return explicit;

  if (process.env.NODE_ENV !== "production") return null;

  let authHost: string | null = null;
  try {
    authHost = process.env.AUTH_URL ? new URL(process.env.AUTH_URL).hostname : null;
  } catch {
    authHost = null;
  }
  if (authHost) return [authHost.toLowerCase()];

  const reqHost = toHostname(requestHost);
  // 照合先が 1 つも決まらない本番は弾く（fail-closed）
  return reqHost ? [reqHost] : [];
}

/**
 * Turnstile のトークンを検証する。
 *
 * **この関数は throw しない。** 呼び出し元の Server Action で try/catch が
 * 必要になると、`signIn()` が投げる NEXT_REDIRECT まで巻き込んで握り潰し、
 * 「ボタンを押しても何も起きない」サイレント障害を生むため。
 *
 * @param token フォームの `cf-turnstile-response`。未取得なら null
 * @param remoteIp 利用者の IP。任意だが渡すと Cloudflare 側の判定精度が上がる
 * @param requestHost リクエストの Host（x-forwarded-host 優先）。hostname 照合の最後の拠り所
 */
export async function verifyTurnstileToken(
  token: string | null,
  remoteIp?: string,
  requestHost?: string,
): Promise<TurnstileVerdict> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();

  // シークレットの判定はトークンより必ず先に行う。
  // 開発環境ではサイトキーも未設定でウィジェットが描画されず、トークンは
  // 必ず空になる。順序を逆にすると開発環境で誰もログインできなくなる
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[turnstile.verifyTurnstileToken] TURNSTILE_SECRET_KEY が未設定のため検証を拒否しました",
      );
      return { ok: false, reason: "misconfigured" };
    }
    console.warn(
      "[turnstile.verifyTurnstileToken] TURNSTILE_SECRET_KEY が未設定のため検証をスキップします",
    );
    return { ok: true, skipped: true };
  }

  if (!token) {
    return { ok: false, reason: "missing-token" };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(SITEVERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      // 単回使用のトークンがキャッシュに載ると、同じトークンで何度でも通せる
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        "[turnstile.verifyTurnstileToken] siteverify error:",
        response.status,
        response.statusText,
      );
      return { ok: false, reason: "network-error" };
    }

    const data: TurnstileSiteVerifyResponse = await response.json();

    if (data.success) {
      // Cloudflare 推奨の多層防御。success だけでは「どのフォームで・どのドメインで」
      // 解かれたかを見ておらず、設定を誤って同じウィジェットを使い回すと素通りする
      if (data.action !== TURNSTILE_LOGIN_ACTION) {
        console.error(
          "[turnstile.verifyTurnstileToken] action mismatch:",
          data.action ?? "(none)",
        );
        return { ok: false, reason: "action-mismatch" };
      }

      const allowed = allowedHostnames(requestHost);
      if (allowed !== null) {
        const solvedOn = toHostname(data.hostname);
        if (!solvedOn || !allowed.includes(solvedOn)) {
          // hostname は Cloudflare 由来のドメイン名で、トークンもシークレットも含まない
          console.error(
            "[turnstile.verifyTurnstileToken] hostname mismatch:",
            solvedOn ?? "(none)",
          );
          return { ok: false, reason: "hostname-mismatch" };
        }
      }

      return { ok: true, skipped: false };
    }

    // error-codes は Cloudflare 由来の固定文字列で、トークンもシークレットも含まない
    console.error(
      "[turnstile.verifyTurnstileToken] siteverify rejected:",
      data["error-codes"]?.join(", ") ?? "(no error codes)",
    );
    return { ok: false, reason: "invalid-token" };
  } catch (err) {
    // シークレットとトークンは出さない。到達可否と理由だけ残す
    const detail =
      err instanceof Error && err.name === "TimeoutError"
        ? `timeout (>${VERIFY_TIMEOUT_MS}ms)`
        : err instanceof Error
          ? err.name
          : "unknown error";
    console.error(
      "[turnstile.verifyTurnstileToken] siteverify failed:",
      detail,
    );
    return { ok: false, reason: "network-error" };
  }
}
