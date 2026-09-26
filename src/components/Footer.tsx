"use client";

import { usePathname } from "next/navigation";
import { isAuthRoute } from "@/lib/auth-routes";

/**
 * サイト共通のフッター。
 *
 * かつて Netflix を模したメニュー（ヘルプセンター・利用規約 等）を並べていたが、
 * 全て `href="#"` の張りぼてで、押しても何も起きないまま利用者に選択肢があるかの
 * ように見せていたため撤去した。
 *
 * 代わりに TMDb の帰属表示を置く。TMDb の利用規約は API 利用者に対して
 * 「TMDb を利用しているが TMDb による承認・認証を受けたものではない」旨の
 * 明示を求めており、これまでサイト内のどこにも無かった。
 */
export default function Footer() {
  const pathname = usePathname();

  // 認証画面はフルスクリーンの背景演出を敷くため、サイト共通のフッターを出さない
  if (isAuthRoute(pathname)) return null;

  return (
    <footer className="py-10 text-gray-500 text-xs">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="max-w-4xl space-y-2">
          <p>© 2026 ANIFLIX. All rights reserved.</p>
          <p>
            本製品は TMDB API を利用していますが、TMDB
            による承認・認証を受けたものではありません。
          </p>
        </div>
      </div>
    </footer>
  );
}
