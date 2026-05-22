"use client";

import { useState, useEffect, useRef, useCallback, useId } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { TMDbAnime, TMDbMovie } from "@/types/tmdb";
import { getImageUrl } from "@/lib/tmdb";

interface HiddenField {
  name: string;
  value: string;
}

interface SearchPageInputProps {
  /** "tv" → /api/search、"movie" → /api/search/movies */
  mode: "tv" | "movie";
  /** 初期値（URL のクエリパラメータから渡される） */
  defaultValue?: string;
  /** フォーム送信先 URL（"/search" or "/browse/movies"） */
  formAction: string;
  /** hidden input として埋め込む追加フィールド（フィルター値の引き継ぎ用） */
  hiddenFields?: HiddenField[];
}

type SuggestionItem =
  | { kind: "tv"; data: TMDbAnime }
  | { kind: "movie"; data: TMDbMovie };

function buildDetailHref(item: SuggestionItem): string {
  if (item.kind === "tv") return `/anime/${item.data.id}`;
  return `/movie/${item.data.id}`;
}

function getItemTitle(item: SuggestionItem): string {
  if (item.kind === "tv") return item.data.name;
  return item.data.title;
}

function getItemSubtitle(item: SuggestionItem): string {
  if (item.kind === "tv") return item.data.original_name;
  return item.data.original_title;
}

function getItemYear(item: SuggestionItem): string {
  const raw =
    item.kind === "tv" ? item.data.first_air_date : item.data.release_date;
  return raw ? raw.split("-")[0] : "";
}

function getItemScore(item: SuggestionItem): number {
  return item.data.vote_average;
}

function getItemPosterPath(item: SuggestionItem): string | null {
  return item.data.poster_path;
}

export default function SearchPageInput({
  mode,
  defaultValue = "",
  formAction,
  hiddenFields,
}: SearchPageInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const listId = useId();
  const inputId = useId();

  const endpoint = mode === "tv" ? "/api/search" : "/api/search/movies";
  const placeholder =
    mode === "tv"
      ? "タイトル、キーワードで検索"
      : "映画タイトル、キーワードで検索";

  const closeSuggestions = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  // コンテナ外クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeSuggestions();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeSuggestions]);

  // アンマウント時に in-flight fetch を破棄
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (q.trim().length === 0) {
        setSuggestions([]);
        setOpen(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const res = await fetch(
          `${endpoint}?q=${encodeURIComponent(q.trim())}`,
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(5000),
            ]),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw: unknown = await res.json();
        if (!raw || typeof raw !== "object") throw new Error("不正な応答");
        const data = raw as { results?: unknown };
        const items: unknown[] = Array.isArray(data.results)
          ? data.results
          : [];

        const mapped: SuggestionItem[] =
          mode === "tv"
            ? (items as TMDbAnime[]).slice(0, 8).map((a) => ({
                kind: "tv" as const,
                data: a,
              }))
            : (items as TMDbMovie[]).slice(0, 8).map((m) => ({
                kind: "movie" as const,
                data: m,
              }));

        setSuggestions(mapped);
        setOpen(mapped.length > 0 || q.trim().length > 0);
        setActiveIndex(-1);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
        }
      }
    },
    [endpoint, mode],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (v.trim().length === 0) {
      abortRef.current?.abort();
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;

    const total = suggestions.length;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, total - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
        break;
      case "Enter":
        if (activeIndex >= 0 && activeIndex < total) {
          e.preventDefault();
          const item = suggestions[activeIndex];
          router.push(buildDetailHref(item));
          closeSuggestions();
        }
        break;
      case "Escape":
        closeSuggestions();
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  const handleItemClick = (item: SuggestionItem) => {
    router.push(buildDetailHref(item));
    closeSuggestions();
  };

  const handleAllResultsClick = () => {
    const q = value.trim();
    if (!q) return;
    const params = new URLSearchParams({ q });
    hiddenFields?.forEach(({ name, value: fieldValue }) => {
      if (fieldValue) params.append(name, fieldValue);
    });
    router.push(`${formAction}?${params.toString()}`);
    closeSuggestions();
  };

  const handleFocus = () => {
    if (suggestions.length > 0 && value.trim().length > 0) {
      setOpen(true);
    }
  };

  const activeDescendant =
    activeIndex >= 0 ? `${listId}-item-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className="relative mb-10 max-w-xl">
      <form action={formAction} method="GET">
        {hiddenFields?.map((f) => (
          <input key={f.name} type="hidden" name={f.name} value={f.value} />
        ))}
        <div className="flex items-center border border-gray-600 bg-[#1a1a1a] rounded overflow-hidden focus-within:border-white transition-colors">
          <svg
            className="w-5 h-5 text-gray-400 ml-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            name="q"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder={placeholder}
            maxLength={100}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={activeDescendant}
            className="flex-1 bg-transparent text-white px-4 py-3 text-sm outline-none placeholder-gray-500"
          />
          {loading && (
            <svg
              className="w-4 h-4 text-gray-400 animate-spin mr-2 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
          )}
          <button
            type="submit"
            className="bg-[#E50914] text-white px-5 py-3 text-sm font-semibold hover:bg-red-700 transition"
          >
            検索
          </button>
        </div>
      </form>

      {/* サジェストドロップダウン */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-[#1f1f1f] border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={mode === "tv" ? "アニメの候補" : "映画の候補"}
            className="max-h-[60vh] overflow-y-auto"
          >
            {suggestions.map((item, idx) => {
              const title = getItemTitle(item);
              const subtitle = getItemSubtitle(item);
              const year = getItemYear(item);
              const score = getItemScore(item);
              const posterPath = getItemPosterPath(item);
              const isActive = idx === activeIndex;

              return (
                <li
                  key={item.data.id}
                  id={`${listId}-item-${idx}`}
                  role="option"
                  aria-selected={isActive}
                >
                  <button
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={`flex items-center gap-3 w-full px-3 py-2 transition text-left ${
                      isActive ? "bg-[#2a2a2a]" : "hover:bg-[#2a2a2a]"
                    }`}
                  >
                    <div className="relative w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-gray-800">
                      {posterPath ? (
                        <Image
                          src={getImageUrl(posterPath, "w185")}
                          alt={title}
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">
                        {title}
                      </p>
                      {subtitle && subtitle !== title && (
                        <p className="text-gray-400 text-xs truncate">
                          {subtitle}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        {year && (
                          <span className="text-gray-500 text-xs">{year}</span>
                        )}
                        {score > 0 && (
                          <span className="text-green-400 text-xs font-bold">
                            {score.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* すべての結果を見る */}
          {value.trim() && (
            <button
              type="button"
              onClick={handleAllResultsClick}
              className="w-full px-4 py-3 text-center text-[#54b9c5] text-sm hover:bg-[#2a2a2a] transition border-t border-gray-700"
            >
              「{value.trim()}」のすべての結果を見る →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
