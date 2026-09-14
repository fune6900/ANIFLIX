// OpenNext Cloudflare アダプタ設定
//
// incrementalCache: SSG/ISR ページと fetch データキャッシュを R2 に保存する。
//   src/lib/{tmdb,anilist,annict}.ts が指定する next.revalidate をここで効かせ、
//   TMDb / AniList / Annict へのリクエスト数を抑える。
// queue: 時間ベース revalidation の再生成を Durable Object で捌く（重複排除あり）。
//
// tagCache は設定しない。revalidateTag / revalidatePath を使っていないため不要。

import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
});
