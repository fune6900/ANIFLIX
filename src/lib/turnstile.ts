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

/** ログに出す action の上限。action はクライアントの render() で決まる（Cloudflare 側で最大 32 文字） */
const ACTION_LOG_MAX = 32;

/**
 * ホスト名を比較用に正規化する（小文字・ポート無し・末尾ドット無し）。
 * 設定値に `https://aniflix.example/login` のような URL が書かれても読めるようにする
 */
function toHostname(raw: string | undefined | null): string | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `http://${value}`);
    return url.hostname.replace(/\.$/, "") || null;
  } catch {
    return null;
  }
}

type HostnamePolicy =
  | { kind: "check"; allowed: string[] }
  /** 開発環境で許可リストを明示していない（照合しない） */
  | { kind: "skip" }
  /** 本番で許可リストが無い、または有効な値が 1 つも無い */
  | { kind: "misconfigured" };

/**
 * トークンを解いてよいホスト名は `TURNSTILE_ALLOWED_HOSTNAMES`（カンマ区切り）だけで決める。
 *
 * リクエストの Host / X-Forwarded-Host には頼らない。bot はブラウザではないので
 * どちらも自由に書け、「攻撃者が解いたホスト名」を「攻撃者が申告したホスト名」と
 * 比べるだけになる。AUTH_URL も使わない（www やプレビューを取りこぼして全員を締め出す）。
 */
function hostnamePolicy(): HostnamePolicy {
  const raw = process.env.TURNSTILE_ALLOWED_HOSTNAMES;
  const allowed = (raw ?? "")
    .split(",")
    .map((h) => toHostname(h))
    .filter((h): h is string => h !== null);

  if (allowed.length > 0) return { kind: "check", allowed };
  if (raw?.trim()) {
    // 設定しているのに 1 件も読めない = 書き間違い。黙って照合を外さない
    console.error(
      "[turnstile.verifyTurnstileToken] TURNSTILE_ALLOWED_HOSTNAMES に有効なホスト名がありません",
    );
    return { kind: "misconfigured" };
  }
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[turnstile.verifyTurnstileToken] TURNSTILE_ALLOWED_HOSTNAMES が未設定のため検証を拒否しました",
    );
    return { kind: "misconfigured" };
  }
  return { kind: "skip" };
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
 */
export async function verifyTurnstileToken(
  token: string | null,
  remoteIp?: string,
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
      // 公式テストキーの応答は action を返さず hostname も example.com 固定。
      // 開発では照合を外して通し、本番に入っていたら設定事故として弾く
      if (data.metadata?.result_with_testing_key === true) {
        if (process.env.NODE_ENV === "production") {
          console.error(
            "[turnstile.verifyTurnstileToken] 本番でテストキーの応答を受け取ったため検証を拒否しました",
          );
          return { ok: false, reason: "misconfigured" };
        }
        return { ok: true, skipped: false };
      }

      // Cloudflare 推奨の多層防御。success だけでは「どのフォームで・どのドメインで」
      // 解かれたかを見ておらず、設定を誤って同じウィジェットを使い回すと素通りする
      if (data.action !== TURNSTILE_LOGIN_ACTION) {
        console.error(
          "[turnstile.verifyTurnstileToken] action mismatch:",
          data.action?.slice(0, ACTION_LOG_MAX) ?? "(none)",
        );
        return { ok: false, reason: "action-mismatch" };
      }

      const policy = hostnamePolicy();
      if (policy.kind === "misconfigured") {
        return { ok: false, reason: "misconfigured" };
      }
      if (policy.kind === "check") {
        const solvedOn = toHostname(data.hostname);
        if (!solvedOn || !policy.allowed.includes(solvedOn)) {
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
