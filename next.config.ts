import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  images: {
    // TMDb / AniList の CDN がすでに最適化済みの画像を配信しているため、
    // Next.js の画像最適化を無効化する。
    // Cloudflare Workers 上では最適化サーバーが動かない（Images 課金対象）ので必須。
    // ※アプリ内の全Image使用箇所が外部CDNのURLのみのため副作用なし。
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "s4.anilist.co",
        pathname: "/file/anilistcdn/**",
      },
      {
        protocol: "https",
        hostname: "img.anili.st",
      },
    ],
  },
};

export default nextConfig;

// OpenNext (Cloudflare) のローカル開発サポート。
// `next dev` から Cloudflare のバインディング（R2 / Durable Object）へアクセスできるようにする。
// 本番ビルド・デプロイには影響しない。
// 参照: https://opennext.js.org/cloudflare/get-started
initOpenNextCloudflareForDev();
