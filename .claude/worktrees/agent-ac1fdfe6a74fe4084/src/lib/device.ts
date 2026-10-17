/**
 * サーバーコンポーネント向け UA ベースのデバイス判定
 *
 * 戻り値:
 *   "mobile"  – スマートフォン（2カラム前提）
 *   "tablet"  – タブレット（4カラム前提）
 *   "desktop" – デスクトップ（5カラム前提）
 */
export function detectDevice(ua: string): "mobile" | "tablet" | "desktop" {
  if (/Mobile|Android(?!.*Tablet)|iPhone|iPod/i.test(ua)) return "mobile";
  if (/iPad|Android.*Tablet|Tablet/i.test(ua)) return "tablet";
  return "desktop";
}

/**
 * デバイスごとの1ページあたり表示件数
 *
 * カラム数との対応（グリッドが偶数分割で埋まるよう設定）:
 *   mobile  → 2 cols × 5 rows = 10
 *   tablet  → 4 cols × 4 rows = 16
 *   desktop → 5 cols × 4 rows = 20
 */
export function itemsPerPage(device: "mobile" | "tablet" | "desktop"): number {
  if (device === "mobile") return 10;
  if (device === "tablet") return 16;
  return 20;
}
