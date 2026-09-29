import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import ContentRow from "@/components/ContentRow";
import type { ContentRowItem } from "@/components/ContentRow";

/**
 * ホームの横スクロール行。
 *
 * 声優カード（縦長）は名前がホバーパネルの中にしか無く、タッチ端末では
 * 誰の写真か分からなかった。写真の中に常に名前を出す。
 */

const VOICE_ACTOR: ContentRowItem = {
  id: 1,
  title: "花澤香菜",
  year: "役: 千石撫子",
  rating: "CV",
  posterPath: "/kana.jpg",
  backdropPath: null,
  isPortrait: true,
  href: "/voice-actors/1",
};

afterEach(() => {
  cleanup();
});

describe("ContentRow の声優カード", () => {
  it("ホバーしなくても写真の中に名前を出す", () => {
    render(<ContentRow title="🎤 人気声優" items={[VOICE_ACTOR]} />);

    const photo = screen.getByAltText("花澤香菜").parentElement;

    expect(photo).not.toBeNull();
    expect(within(photo as HTMLElement).getByText("花澤香菜")).toBeVisible();
  });

  it("写真が無い声優も名前が出る", () => {
    render(
      <ContentRow
        title="🎤 人気声優"
        items={[{ ...VOICE_ACTOR, posterPath: null }]}
      />,
    );

    expect(screen.getByText("花澤香菜")).toBeInTheDocument();
  });
});
