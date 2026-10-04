import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { searchResultsHref } from "@/lib/search-results";

/**
 * ヘッダー検索の遷移先（#101）。Enter と「すべての結果を見る」は
 * 部門別の検索結果画面 `/search/<部門>?q=` へ飛ぶ。
 *
 * `next/navigation` のモックは例外 3（ルーター本体は検証対象外）。
 * ライブ結果の取得（fetch）はデバウンス 300ms の後でしか走らないため、
 * 偽のタイマーで止めたまま操作する。fetch はモックしない。
 */

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const SearchDropdown = (await import("@/components/SearchDropdown")).default;

beforeEach(() => {
  vi.useFakeTimers();
  try {
    localStorage.clear();
  } catch {
    // localStorage が無い環境でも検証対象には影響しない
  }
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  push.mockClear();
});

function typeQuery(value: string): HTMLInputElement {
  const input = screen.getByRole("searchbox");
  if (!(input instanceof HTMLInputElement)) throw new Error("入力欄が無い");
  fireEvent.change(input, { target: { value } });
  return input;
}

function pressEnter(input: HTMLInputElement) {
  const form = input.closest("form");
  if (!form) throw new Error("入力欄が form の中に無い");
  fireEvent.submit(form);
}

const TAB_LABELS = {
  anime: /アニメ/,
  movies: /映画/,
  "voice-actors": /声優/,
  characters: /キャラ/,
} as const;

describe("SearchDropdown の遷移先", () => {
  it.each(Object.entries(TAB_LABELS))(
    "%s タブで Enter → その部門の検索結果画面",
    (slug, label) => {
      const onClose = vi.fn();
      render(<SearchDropdown onClose={onClose} />);

      // キーワード未入力のうちにタブを切り替える（入力後だと即座に取得が走る）
      fireEvent.click(screen.getByRole("button", { name: label }));
      pressEnter(typeQuery("  進撃  "));

      expect(push).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith(
        searchResultsHref(slug as keyof typeof TAB_LABELS, "進撃"),
      );
      expect(onClose).toHaveBeenCalled();
    },
  );

  it.each(Object.entries(TAB_LABELS))(
    "%s タブで「すべての結果を見る」→ その部門の検索結果画面",
    (slug, label) => {
      render(<SearchDropdown onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: label }));
      typeQuery("鬼滅");
      fireEvent.click(
        screen.getByRole("button", { name: /すべての結果を見る/ }),
      );

      expect(push).toHaveBeenCalledWith(
        searchResultsHref(slug as keyof typeof TAB_LABELS, "鬼滅"),
      );
    },
  );

  it("旧 URL（/search?q= /browse/movies?q= /voice-actors?q=）へは飛ばさない", () => {
    render(<SearchDropdown onClose={vi.fn()} />);

    pressEnter(typeQuery("進撃"));

    const [href] = push.mock.lastCall ?? [""];
    expect(String(href).startsWith("/search/")).toBe(true);
  });

  it("空白だけなら遷移しない", () => {
    render(<SearchDropdown onClose={vi.fn()} />);

    pressEnter(typeQuery("   "));

    expect(push).not.toHaveBeenCalled();
  });
});
