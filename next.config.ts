import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  images: {
    // TMDb CDN（image.tmdb.org）がすでに最適化済みの画像を配信しているため、
    // Vercelの画像変換（Image Optimization Transformations）を無効化する。
    // これにより無料枠5,000回の消費を防ぐ。
    // ※アプリ内の全Image使用箇所がTMDb外部URLのみのため副作用なし。
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
