"use client";

import { usePathname } from "next/navigation";
import { isAuthRoute } from "@/lib/auth-routes";

export default function Footer() {
  const pathname = usePathname();

  // 認証画面はフルスクリーンの背景演出を敷くため、サイト共通のフッターを出さない
  if (isAuthRoute(pathname)) return null;

  return (
    <footer className="py-10 text-gray-500 text-xs">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="max-w-4xl">
          <div className="flex gap-5 mb-4 flex-wrap">
            {[
              "音声説明",
              "ヘルプセンター",
              "ギフトカード",
              "メディアセンター",
              "投資家向け情報",
              "採用情報",
              "利用規約",
              "プライバシー",
              "法的事項",
              "Cookie設定",
              "会社概要",
              "お問い合わせ",
            ].map((item) => (
              <a key={item} href="#" className="hover:underline">
                {item}
              </a>
            ))}
          </div>
          <button className="border border-gray-500 text-gray-400 px-4 py-2 text-sm hover:text-white hover:border-white transition mb-4">
            サービスコード
          </button>
          <p>© 2026 ANIFLIX. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
