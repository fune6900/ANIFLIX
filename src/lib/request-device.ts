// リクエストの User-Agent から 1 ページの件数を決める（Server Component 用）

import { headers } from "next/headers";
import { detectDevice, itemsPerPage } from "@/lib/device";

/**
 * このリクエストのデバイス別件数（mobile=10 / tablet=16 / desktop=20）。
 * `next/headers` の読み取りをここに閉じ込め、ページ側を描画テストできるようにする
 */
export async function requestItemsPerPage(): Promise<number> {
  const ua = (await headers()).get("user-agent") ?? "";
  return itemsPerPage(detectDevice(ua));
}
