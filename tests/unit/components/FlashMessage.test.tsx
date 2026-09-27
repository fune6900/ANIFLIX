import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
} from "@testing-library/react";
import FlashMessage from "@/components/FlashMessage";

/**
 * フラッシュメッセージの表示。
 *
 * `next/navigation` のモックは App Router のコンテキストが無いため
 * （`@.claude/rules/testing.md` モック方針の例外）。
 */

let params = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
}));

/** クエリと現在のパスを整える */
function setLocation(pathname: string, query: string) {
  params = new URLSearchParams(query);
  window.history.replaceState(
    null,
    "",
    `${pathname}${query ? `?${query}` : ""}`,
  );
}

beforeEach(() => {
  setLocation("/", "");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("FlashMessage", () => {
  describe("表示するかどうか", () => {
    it("フラッシュが無ければ何も描画しない", () => {
      const { container } = render(<FlashMessage />);
      expect(container).toBeEmptyDOMElement();
    });

    it("未知の種別は表示しない", () => {
      setLocation("/", "flash=totally-unknown");
      const { container } = render(<FlashMessage />);
      expect(container).toBeEmptyDOMElement();
    });

    it("クエリの値をそのまま画面へ出さない", () => {
      setLocation("/", "flash=%3Cimg+src%3Dx%3E");
      const { container } = render(<FlashMessage />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("文言と役割", () => {
    it("ログイン成功を status として出す", () => {
      setLocation("/anime/1429", "flash=signed-in");
      render(<FlashMessage />);

      const alert = screen.getByRole("status");
      expect(alert).toHaveTextContent("ログインしました");
    });

    it("ログアウトを status として出す", () => {
      setLocation("/login", "flash=signed-out");
      render(<FlashMessage />);

      expect(screen.getByRole("status")).toHaveTextContent(
        "ログアウトしました",
      );
    });

    it("ログイン失敗は alert として出す", () => {
      setLocation("/login", "flash=sign-in-failed");
      render(<FlashMessage />);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "ログインに失敗しました",
      );
    });

    it("失敗理由に応じた文言を出す", () => {
      setLocation("/login", "flash=sign-in-failed&reason=AccessDenied");
      render(<FlashMessage />);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "アクセスが拒否されました",
      );
    });
  });

  describe("URL の後始末", () => {
    it("表示している間はパラメータを消さない", () => {
      // Next の App Router は history.replaceState を検知して
      // useSearchParams() を更新する。表示直後に掃除すると、その更新で
      // 通知自体が消えて一瞬も画面に出ない（実ブラウザで踏んだ）。
      // 掃除は「消える時」に回すこと
      setLocation("/anime/1429", "flash=signed-in");
      const replaceState = vi.spyOn(window.history, "replaceState");

      render(<FlashMessage />);

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(replaceState).not.toHaveBeenCalled();
    });

    it("閉じたらパラメータを URL から落とす", () => {
      // 残したままだと再読み込みの度に同じ通知が出る
      setLocation("/anime/1429", "flash=signed-in");
      const replaceState = vi.spyOn(window.history, "replaceState");

      render(<FlashMessage />);
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

      expect(replaceState).toHaveBeenCalledWith(null, "", "/anime/1429");
    });

    it("自動で消えた時もパラメータを落とす", () => {
      vi.useFakeTimers();
      setLocation("/", "flash=signed-in");
      const replaceState = vi.spyOn(window.history, "replaceState");

      render(<FlashMessage />);
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(replaceState).toHaveBeenCalledWith(null, "", "/");
    });

    it("フラッシュ以外のクエリは残す", () => {
      setLocation("/search", "q=naruto&flash=signed-in&reason=X");
      const replaceState = vi.spyOn(window.history, "replaceState");

      render(<FlashMessage />);
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

      expect(replaceState).toHaveBeenCalledWith(null, "", "/search?q=naruto");
    });

    it("フラッシュが無ければ URL を触らない", () => {
      vi.useFakeTimers();
      setLocation("/search", "q=naruto");
      const replaceState = vi.spyOn(window.history, "replaceState");

      render(<FlashMessage />);
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(replaceState).not.toHaveBeenCalled();
    });
  });

  describe("消え方", () => {
    it("一定時間で自動的に消える", () => {
      vi.useFakeTimers();
      setLocation("/", "flash=signed-in");
      render(<FlashMessage />);

      expect(screen.getByRole("status")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("閉じるボタンで消せる", () => {
      setLocation("/", "flash=signed-in");
      render(<FlashMessage />);

      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
