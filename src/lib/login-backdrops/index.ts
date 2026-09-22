import pattern1 from "./pattern-1.json";
import pattern2 from "./pattern-2.json";
import pattern3 from "./pattern-3.json";
import pattern4 from "./pattern-4.json";
import pattern5 from "./pattern-5.json";

/** ログイン画面の背景に流す 1 枚分のデータ */
export interface LoginBackdrop {
  id: number;
  title: string;
  /** TMDb の backdrop_path（16:9 の横長画像）。URL 化は getImageUrl() を通す */
  backdropPath: string;
}

/** 静的 JSON 1 ファイル分 */
export interface LoginBackdropPattern {
  generatedAt: string;
  source: string;
  items: LoginBackdrop[];
}

/**
 * 背景パターン。
 *
 * TMDb を実行時に叩くとログイン画面が外部 API の可用性に依存し、
 * 未認証ユーザーでも API クォータを消費できてしまう（bot 対策の趣旨に反する）。
 * そのため開発時に取得した結果を静的 JSON として固定し、ビルドへ同梱する。
 * 内容を更新する場合は JSON を作り直すこと。
 */
const PATTERNS: LoginBackdropPattern[] = [
  pattern1,
  pattern2,
  pattern3,
  pattern4,
  pattern5,
];

/**
 * 背景パターンを 1 つランダムに返す。
 * Server Component から呼び、結果をクライアントへ渡すこと
 * （クライアント側で抽選するとハイドレーション不一致になる）。
 */
export function pickRandomLoginBackdrops(): LoginBackdrop[] {
  const index = Math.floor(Math.random() * PATTERNS.length);
  return PATTERNS[index].items;
}
