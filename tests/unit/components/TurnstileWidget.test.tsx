import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { createRef } from "react";
import type {
  TurnstileApi,
  TurnstileRenderOptions,
  TurnstileWidgetHandle,
} from "@/types/turnstile";

/**
 * Cloudflare Turnstile ウィジェットの配線（#58）。
 *
 * 壊れると利用者がログインできなくなるのに、手動検証しか無かった所を固定する。
 * - `next/script` は `api.js` を読み込むだけで検証対象ではないので潰す
 * - `window.turnstile` は Cloudflare の api.js が生やすグローバル。スタブで差し込む
 * （testing.md モック方針の例外 7）
 */

/** next/script に渡された props（api.js の読み込み完了を起こすために捕まえる） */
let scriptProps: { onReady?: () => void; onError?: () => void } = {};

vi.mock("next/script", () => ({
  default: (props: { onReady?: () => void; onError?: () => void }) => {
    scriptProps = props;
    return null;
  },
}));

const { default: TurnstileWidget } =
  await import("@/components/TurnstileWidget");

const WIDGET_ID = "widget-1";

let api: {
  render: ReturnType<typeof vi.fn<TurnstileApi["render"]>>;
  reset: ReturnType<typeof vi.fn<TurnstileApi["reset"]>>;
  remove: ReturnType<typeof vi.fn<TurnstileApi["remove"]>>;
  getResponse: ReturnType<typeof vi.fn<TurnstileApi["getResponse"]>>;
};

/** render() に渡された options（直近） */
function lastOptions(): TurnstileRenderOptions {
  const options = api.render.mock.calls.at(-1)?.[1];
  if (!options) throw new Error("turnstile.render() が呼ばれていない");
  return options;
}

beforeEach(() => {
  scriptProps = {};
  api = {
    render: vi.fn<TurnstileApi["render"]>(() => WIDGET_ID),
    reset: vi.fn<TurnstileApi["reset"]>(),
    remove: vi.fn<TurnstileApi["remove"]>(),
    getResponse: vi.fn<TurnstileApi["getResponse"]>(),
  };
  vi.stubGlobal("turnstile", api);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderWidget(onToken = vi.fn(), siteKey = "site-key-1") {
  const ref = createRef<TurnstileWidgetHandle>();
  const utils = render(
    <TurnstileWidget
      ref={ref}
      siteKey={siteKey}
      onToken={onToken}
      onScriptError={vi.fn()}
    />,
  );
  return { ...utils, ref, onToken };
}

describe("TurnstileWidget", () => {
  it("マウント時に turnstile.render() を sitekey 付きで 1 回だけ呼ぶ", () => {
    renderWidget();

    expect(api.render).toHaveBeenCalledTimes(1);
    expect(api.render.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
    expect(lastOptions().sitekey).toBe("site-key-1");
  });

  it("Managed の常時表示オプションと action を渡す", () => {
    renderWidget();

    expect(lastOptions()).toMatchObject({
      appearance: "always",
      theme: "dark",
      action: "login",
    });
  });

  it("検証に通ったらトークンを通知する", () => {
    const { onToken } = renderWidget();

    act(() => lastOptions().callback?.("token-abc"));

    expect(onToken).toHaveBeenCalledWith("token-abc");
  });

  it.each([
    ["expired-callback"],
    ["timeout-callback"],
    ["error-callback"],
  ] as const)(
    "%s で null を通知する（消えたトークンで送信させない）",
    (key) => {
      const { onToken } = renderWidget();

      act(() => lastOptions()[key]?.());

      expect(onToken).toHaveBeenCalledWith(null);
    },
  );

  it("親の再レンダーで render() を呼び直さない（通過したチェックを消さない）", () => {
    const { rerender, ref } = renderWidget();
    const nextOnToken = vi.fn();

    rerender(
      <TurnstileWidget
        ref={ref}
        siteKey="site-key-1"
        onToken={nextOnToken}
        onScriptError={vi.fn()}
      />,
    );

    expect(api.render).toHaveBeenCalledTimes(1);
    expect(api.remove).not.toHaveBeenCalled();
    // コールバックは最新の親の関数へ届く（ref に逃がしてある）
    act(() => lastOptions().callback?.("token-xyz"));
    expect(nextOnToken).toHaveBeenCalledWith("token-xyz");
  });

  it("アンマウント時に widgetId 付きで remove() を呼ぶ", () => {
    const { unmount } = renderWidget();

    unmount();

    expect(api.remove).toHaveBeenCalledWith(WIDGET_ID);
  });

  it("ref の reset() で widgetId 付きの reset を呼ぶ", () => {
    const { ref } = renderWidget();

    act(() => ref.current?.reset());

    expect(api.reset).toHaveBeenCalledWith(WIDGET_ID);
  });

  it("bfcache から戻ったらリセットし、トークンを捨てる", () => {
    const { onToken } = renderWidget();

    act(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      );
    });

    expect(api.reset).toHaveBeenCalledWith(WIDGET_ID);
    expect(onToken).toHaveBeenCalledWith(null);
  });

  it("初回訪問: api.js が後から読み込まれたら、その時点で render() する", () => {
    // 初めて開いた時は window.turnstile がまだ無い。onReady を合図に描画する
    vi.unstubAllGlobals();
    renderWidget();
    expect(api.render).not.toHaveBeenCalled();

    vi.stubGlobal("turnstile", api);
    act(() => scriptProps.onReady?.());

    expect(api.render).toHaveBeenCalledTimes(1);
    expect(lastOptions().sitekey).toBe("site-key-1");
  });

  it("window.turnstile が未定義のままでも throw しない（マウント・reset・アンマウント）", () => {
    vi.unstubAllGlobals();

    const { ref, unmount } = renderWidget();

    expect(() => act(() => ref.current?.reset())).not.toThrow();
    expect(() => unmount()).not.toThrow();
  });

  it("描画後に window.turnstile が消えても reset・アンマウントで throw しない", () => {
    const { ref, unmount } = renderWidget();
    expect(api.render).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();

    expect(() => act(() => ref.current?.reset())).not.toThrow();
    expect(() => unmount()).not.toThrow();
  });
});
