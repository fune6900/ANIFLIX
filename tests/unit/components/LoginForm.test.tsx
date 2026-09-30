import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import type { TurnstileApi, TurnstileRenderOptions } from "@/types/turnstile";
import type { LoginActionState } from "@/lib/login-action";

/**
 * ログインフォームの Turnstile 配線（#58）。
 *
 * 一番壊れやすいのは「検証に失敗したらウィジェットをリセットする」所。
 * トークンは単回使用なので、リセットしないと 1 回失敗した利用者は永久にログインできない。
 * `next/script` と `window.turnstile` のスタブは TurnstileWidget.test.tsx と同じ（例外 7）。
 * Server Action は props で受け取るので、テストでは普通の関数を渡す。
 */

/** next/script に渡された props（読み込み失敗を起こすために捕まえる） */
let scriptProps: { onError?: () => void } = {};

vi.mock("next/script", () => ({
  default: (props: { onError?: () => void }) => {
    scriptProps = props;
    return null;
  },
}));

const { default: LoginForm } = await import("@/components/LoginForm");

let api: {
  render: ReturnType<typeof vi.fn<TurnstileApi["render"]>>;
  reset: ReturnType<typeof vi.fn<TurnstileApi["reset"]>>;
  remove: ReturnType<typeof vi.fn<TurnstileApi["remove"]>>;
  getResponse: ReturnType<typeof vi.fn<TurnstileApi["getResponse"]>>;
};

function lastOptions(): TurnstileRenderOptions {
  const options = api.render.mock.calls.at(-1)?.[1];
  if (!options) throw new Error("turnstile.render() が呼ばれていない");
  return options;
}

function button(): HTMLButtonElement {
  return screen.getByRole("button");
}

beforeEach(() => {
  api = {
    render: vi.fn<TurnstileApi["render"]>(() => "widget-1"),
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

/** 毎回新しいオブジェクトで失敗を返す（実物の Server Action と同じ） */
function failingAction() {
  return vi.fn(
    async (
      _state: LoginActionState,
      _form: FormData,
    ): Promise<LoginActionState> => ({ error: "invalid-token" }),
  );
}

async function submit() {
  await act(async () => {
    fireEvent.submit(button().closest("form") as HTMLFormElement); // ボタンは必ず form の中
  });
}

describe("LoginForm", () => {
  it("siteKey が無ければウィジェットを描画せず、ボタンを押せる", () => {
    render(<LoginForm action={failingAction()} siteKey={null} />);

    expect(api.render).not.toHaveBeenCalled();
    expect(button()).toBeEnabled();
  });

  it("Turnstile を通過するまでボタンは押せない", () => {
    render(<LoginForm action={failingAction()} siteKey="site-key-1" />);

    expect(api.render).toHaveBeenCalledTimes(1);
    expect(button()).toBeDisabled();
  });

  it("通過したら押せる。トークンが失効したらまた押せなくなる", () => {
    render(<LoginForm action={failingAction()} siteKey="site-key-1" />);

    act(() => lastOptions().callback?.("token-abc"));
    expect(button()).toBeEnabled();

    act(() => lastOptions()["expired-callback"]?.());
    expect(button()).toBeDisabled();
  });

  it("検証に失敗したらウィジェットをリセットし、ボタンを塞ぎ直し、理由を出す", async () => {
    const action = failingAction();
    render(<LoginForm action={action} siteKey="site-key-1" />);
    act(() => lastOptions().callback?.("token-abc"));

    await submit();

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.reset).toHaveBeenCalledWith("widget-1"));
    expect(button()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("有効期限");
  });

  it("同じ理由で続けて失敗しても毎回リセットする", async () => {
    const action = failingAction();
    render(<LoginForm action={action} siteKey="site-key-1" />);

    for (let i = 1; i <= 2; i++) {
      act(() => lastOptions().callback?.(`token-${i}`));
      await submit();
      await waitFor(() => expect(api.reset).toHaveBeenCalledTimes(i));
    }
  });

  it("api.js を読み込めなかったら、その旨を出す（広告ブロッカー等）", () => {
    render(<LoginForm action={failingAction()} siteKey="site-key-1" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => scriptProps.onError?.());

    expect(screen.getByRole("alert")).toHaveTextContent("読み込めませんでした");
  });
});
