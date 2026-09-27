import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
} from "@testing-library/react";
import FlashMessage, {
  AUTO_DISMISS_MS,
  EXIT_MS,
} from "@/components/FlashMessage";

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

/**
 * 退出アニメーションの分だけ時間を進める。
 * 表示 → 退出 → DOM から除去 の 2 段階なので、まとめて進めるだけでは足りない
 * （退出タイマーは表示が終わってから仕掛けられる）。
 */
function runExit() {
  act(() => {
    vi.advanceTimersByTime(EXIT_MS);
  });
}

/** 自動消滅から DOM 除去までを一気に進める */
function runAutoDismiss() {
  act(() => {
    vi.advanceTimersByTime(AUTO_DISMISS_MS);
  });
  runExit();
}

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
      vi.useFakeTimers();
      setLocation("/anime/1429", "flash=signed-in");
      const replaceState = vi.spyOn(window.history, "replaceState");

      render(<FlashMessage />);
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      runExit();

      expect(replaceState).toHaveBeenCalledWith(null, "", "/anime/1429");
    });

    it("自動で消えた時もパラメータを落とす", () => {
      vi.useFakeTimers();
      setLocation("/", "flash=signed-in");
      const replaceState = vi.spyOn(window.history, "replaceState");

      render(<FlashMessage />);
      runAutoDismiss();

      expect(replaceState).toHaveBeenCalledWith(null, "", "/");
    });

    it("フラッシュ以外のクエリは残す", () => {
      vi.useFakeTimers();
      setLocation("/search", "q=naruto&flash=signed-in&reason=X");
      const replaceState = vi.spyOn(window.history, "replaceState");

      render(<FlashMessage />);
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      runExit();

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

      runAutoDismiss();

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("閉じるボタンで消せる", () => {
      vi.useFakeTimers();
      setLocation("/", "flash=signed-in");
      render(<FlashMessage />);

      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      runExit();

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("見た目と動き", () => {
    /** トーストの外枠（位置とスライドを担う要素） */
    function toast() {
      return screen.getByRole("status");
    }

    it("右上に表示する", () => {
      setLocation("/", "flash=signed-in");
      render(<FlashMessage />);

      const className = toast().className;
      expect(className).toContain("right-");
      expect(className).toContain("top-");
      // 中央寄せの名残が残っていないこと
      expect(className).not.toContain("left-1/2");
    });

    it("右からスライドして入る", () => {
      setLocation("/", "flash=signed-in");
      render(<FlashMessage />);

      const className = toast().className;
      // 画面外（translate-x-full）から 0 へ動かすための土台
      expect(className).toContain("transition");
      expect(className).toContain("translate-x-0");
    });

    it("閉じる時は右へスライドして出る", () => {
      vi.useFakeTimers();
      setLocation("/", "flash=signed-in");
      render(<FlashMessage />);

      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

      // まだ DOM には居て、画面外へ移動している途中
      expect(toast().className).toContain("translate-x-full");
    });

    it("残り時間のバーを出す", () => {
      setLocation("/", "flash=signed-in");
      const { container } = render(<FlashMessage />);

      const bar = container.querySelector("[data-flash-timer]");
      expect(bar).not.toBeNull();
    });

    it("バーは読み上げ対象にしない", () => {
      // 文言そのものは role=status / role=alert で伝わる。
      // 残り時間まで読み上げると邪魔になる
      setLocation("/", "flash=signed-in");
      const { container } = render(<FlashMessage />);

      const wrapper =
        container.querySelector("[data-flash-timer]")?.parentElement;
      expect(wrapper).toHaveAttribute("aria-hidden", "true");
    });

    it("バーの所要時間が自動消滅の時間と一致する", () => {
      // ずれると「バーが空なのに消えない」「消えたのにバーが残る」が起きる
      setLocation("/", "flash=signed-in");
      const { container } = render(<FlashMessage />);

      const bar = container.querySelector<HTMLElement>("[data-flash-timer]");
      expect(bar?.style.transitionDuration).toBe(`${AUTO_DISMISS_MS}ms`);
    });

    it("バーは時間とともに減る向きに動かす", () => {
      setLocation("/", "flash=signed-in");
      const { container } = render(<FlashMessage />);

      const bar = container.querySelector<HTMLElement>("[data-flash-timer]");
      // 入場後は 0% へ向かって縮む
      expect(bar?.style.width).toBe("0%");
    });
  });
});
