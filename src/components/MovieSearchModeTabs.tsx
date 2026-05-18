"use client";

import { useRouter } from "next/navigation";

interface MovieSearchModeTabsProps {
  currentMode: "keyword" | "filter";
  /** URL に確定済みのキーワード（フォーム未送信時のフォールバック） */
  query: string;
  /** URL に確定済みのジャンル ID */
  genreId: string;
  sort: string;
}

/**
 * アニメ映画検索のモード切替タブ。
 *
 * - キーワード検索 ↔ 詳細フィルター を切り替える際、URL に確定済みの値だけでなく
 *   現在フォームに入力されている未送信の値（input/select の現在値）も保持する。
 * - 「アニメ検索 →」リンクで /search にも現在のキーワードを引き連れて遷移する。
 */
export default function MovieSearchModeTabs({
  currentMode,
  query,
  genreId,
  sort,
}: MovieSearchModeTabsProps) {
  const router = useRouter();

  /** 現在 DOM に表示されているフォームの live な値を読む（無ければ URL 値で補完） */
  function readLiveValues(): { q: string; genre: string; sort: string } {
    const formId =
      currentMode === "filter"
        ? "movie-search-filter-form"
        : "movie-search-keyword-form";
    const form =
      typeof document !== "undefined"
        ? (document.getElementById(formId) as HTMLFormElement | null)
        : null;

    if (!form) {
      return { q: query, genre: genreId, sort };
    }

    const fd = new FormData(form);
    const read = (name: string, fallback: string) => {
      const v = fd.get(name);
      return typeof v === "string" ? v : fallback;
    };

    return {
      q: read("q", query),
      genre: read("genre", genreId),
      sort: read("sort", sort),
    };
  }

  function buildMovieUrl(targetMode: "keyword" | "filter"): string {
    const v = readLiveValues();
    const sp = new URLSearchParams();
    if (v.q) sp.set("q", v.q);
    if (v.genre) sp.set("genre", v.genre);
    if (v.sort && v.sort !== "popularity.desc") sp.set("sort", v.sort);
    if (targetMode === "filter") sp.set("mode", "filter");
    const qs = sp.toString();
    return qs ? `/browse/movies?${qs}` : "/browse/movies";
  }

  function buildAnimeUrl(): string {
    const v = readLiveValues();
    return v.q ? `/search?q=${encodeURIComponent(v.q)}` : "/search";
  }

  const isFilter = currentMode === "filter";

  return (
    <div className="flex border-b border-gray-700 mb-8 gap-0">
      <button
        type="button"
        onClick={() => router.push(buildMovieUrl("keyword"))}
        className={`px-5 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
          !isFilter
            ? "text-white border-[#E50914]"
            : "text-gray-500 border-transparent hover:text-gray-300"
        }`}
      >
        🔍 キーワード検索
      </button>
      <button
        type="button"
        onClick={() => router.push(buildMovieUrl("filter"))}
        className={`px-5 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
          isFilter
            ? "text-white border-[#E50914]"
            : "text-gray-500 border-transparent hover:text-gray-300"
        }`}
      >
        🎛️ 詳細フィルター
      </button>
      <button
        type="button"
        onClick={() => router.push(buildAnimeUrl())}
        className="px-5 py-2.5 text-sm font-semibold transition text-gray-500 hover:text-gray-300 ml-auto"
      >
        📺 アニメ検索 →
      </button>
    </div>
  );
}
