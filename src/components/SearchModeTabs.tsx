"use client";

import { useRouter } from "next/navigation";

interface SearchModeTabsProps {
  currentMode: "keyword" | "filter";
  /** URL に確定済みのキーワード（フォーム未送信時のフォールバック） */
  query: string;
  /** URL に確定済みのフィルター（フォーム未送信時のフォールバック） */
  genreId: string;
  season: string;
  sort: string;
}

/**
 * アニメ検索のモード切替タブ。
 *
 * - キーワード検索 ↔ 詳細フィルター を切り替える際、URL に確定済みの値だけでなく
 *   現在フォームに入力されている未送信の値（input/select の現在値）も保持する。
 * - 「アニメ映画検索 →」リンクも同様に現在のキーワードを引き連れて遷移する。
 */
export default function SearchModeTabs({
  currentMode,
  query,
  genreId,
  season,
  sort,
}: SearchModeTabsProps) {
  const router = useRouter();

  /** 現在 DOM に表示されているフォームの live な値を読む（無ければ URL 値で補完） */
  function readLiveValues(): {
    q: string;
    genre: string;
    season: string;
    sort: string;
  } {
    const formId =
      currentMode === "filter" ? "search-filter-form" : "search-keyword-form";
    const form =
      typeof document !== "undefined"
        ? (document.getElementById(formId) as HTMLFormElement | null)
        : null;

    if (!form) {
      return { q: query, genre: genreId, season, sort };
    }

    const fd = new FormData(form);
    const read = (name: string, fallback: string) => {
      const v = fd.get(name);
      return typeof v === "string" ? v : fallback;
    };

    return {
      q: read("q", query),
      genre: read("genre", genreId),
      season: read("season", season),
      sort: read("sort", sort),
    };
  }

  function buildSearchUrl(targetMode: "keyword" | "filter"): string {
    const v = readLiveValues();
    const sp = new URLSearchParams();
    if (v.q) sp.set("q", v.q);
    if (v.genre) sp.set("genre", v.genre);
    if (v.season) sp.set("season", v.season);
    if (v.sort && v.sort !== "popularity.desc") sp.set("sort", v.sort);
    if (targetMode === "filter") sp.set("mode", "filter");
    const qs = sp.toString();
    return qs ? `/search?${qs}` : "/search";
  }

  function buildMoviesUrl(): string {
    const v = readLiveValues();
    return v.q
      ? `/search/movies?q=${encodeURIComponent(v.q)}`
      : "/search/movies";
  }

  const isFilter = currentMode === "filter";

  return (
    <div className="flex border-b border-gray-700 mb-8 gap-0">
      <button
        type="button"
        onClick={() => router.push(buildSearchUrl("keyword"))}
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
        onClick={() => router.push(buildSearchUrl("filter"))}
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
        onClick={() => router.push(buildMoviesUrl())}
        className="px-5 py-2.5 text-sm font-semibold transition text-gray-500 hover:text-gray-300 ml-auto"
      >
        🎬 アニメ映画検索 →
      </button>
    </div>
  );
}
