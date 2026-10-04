import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * モバイルの下部ナビの内容契約。
 * `next/navigation` をモックする理由は `Footer.test.tsx` と同じ（例外 3）。
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ back: vi.fn() }),
}));

const BottomNav = (await import("@/components/BottomNav")).default;

afterEach(() => {
  cleanup();
});

describe("BottomNav", () => {
  it("映画の項目は「アニメ映画」と呼ぶ（#90）", () => {
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /アニメ映画/ })).toHaveAttribute(
      "href",
      "/browse/movies",
    );
    expect(screen.queryByText("映画")).not.toBeInTheDocument();
  });

  it("「キャラ」はキャラクターページ（/characters）へ（#104）", () => {
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /キャラ/ })).toHaveAttribute(
      "href",
      "/characters",
    );
  });

  it("声優の右にキャラを並べる", () => {
    render(<BottomNav />);

    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/",
      "/browse/airing",
      "/browse/movies",
      "/voice-actors",
      "/characters",
    ]);
  });
});
