/**
 * 定義（genres / eras / studios / diagnosis）の `color` は
 * `from-* via-* to-*` の 3 段の Tailwind グラデーション。
 *
 * 呼び出し側で終点だけ差し替えたい時（例: ヒーローをページ背景 `#141414` へ
 * 溶かす）に `to-[#141414]` を後ろへ足しても効かない。Tailwind は CSS を
 * クラス属性の並びではなく自前の順で出力し、`.to-purple-950` が
 * `.to-[#141414]` より後に来るため定義側の終点が勝つ。
 * 終点を差し替える時は、この関数で定義の `to-*` を落としてから足すこと。
 */
export function gradientStart(color: string): string {
  return color
    .split(/\s+/)
    .filter((c) => c !== "" && !c.startsWith("to-"))
    .join(" ");
}
