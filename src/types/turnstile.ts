/**
 * Cloudflare Turnstile の型定義。
 *
 * 公式 `api.js` は型を配布しておらず、npm パッケージも追加しない方針のため
 * ここで手書きする。ウィジェット側（`window.turnstile`）とサーバー側
 * （siteverify のレスポンス）の両方をまとめる。
 */

/** `turnstile.render()` に渡す設定。ハイフン付きキーは公式の名前をそのまま使う */
export interface TurnstileRenderOptions {
  sitekey: string;
  /** "always" でウィジェット枠を常時表示する（Managed の既定挙動） */
  appearance?: "always" | "execute" | "interaction-only";
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
  /** Cloudflare ダッシュボードで分析軸になるラベル */
  action?: string;
  language?: string;
  /** 検証成功。引数のトークンが siteverify へ渡す値 */
  callback?: (token: string) => void;
  /** トークンが失効した（発行から約 300 秒） */
  "expired-callback"?: () => void;
  /** チャレンジ自体がタイムアウトした */
  "timeout-callback"?: () => void;
  /** 実行時エラー（ドメイン不一致・ネットワーク断など） */
  "error-callback"?: (code?: string) => void;
}

/**
 * `window.turnstile`。
 *
 * すべて optional なプロパティとして宣言することが重要で、
 * `window.turnstile?.render(...)` の形で `as` を使わずに絞り込める。
 * 必須にすると読み込み前の undefined と型が食い違い、キャストが必要になる。
 */
export interface TurnstileApi {
  /** 失敗時は undefined を返しうる */
  render(
    container: HTMLElement | string,
    options: TurnstileRenderOptions,
  ): string | undefined;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
  getResponse(widgetId?: string): string | undefined;
}

/** `TurnstileWidget` が親へ公開する操作 */
export interface TurnstileWidgetHandle {
  /** 消費済み・失効したトークンを捨て、新しいチャレンジを出し直す */
  reset(): void;
}

/**
 * siteverify のレスポンス。
 * `error-codes` はハイフン付きのまま受ける（実際の JSON と対応を崩さないため）。
 */
export interface TurnstileSiteVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
