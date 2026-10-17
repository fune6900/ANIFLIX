/**
 * Vitest 用の `server-only` スタブ。
 *
 * `server-only` は node_modules に実体が無く、Next のバンドラが内部 alias で
 * 解決している仮想モジュール。Vitest からは解決できずテストが丸ごと落ちるため、
 * `vitest.config.ts` の resolve.alias でこの空モジュールへ向ける。
 */
export {};
