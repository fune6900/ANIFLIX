import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  within,
  fireEvent,
  act,
} from "@testing-library/react";
import type { ContentRowItem } from "@/components/ContentRow";

/**
 * ホバープレビューの URL 組み立て（`@/lib/video-preview`）は自前の lib なのでスパイする。
 * fetch 自体はモックしない（testing.md: コンポーネントのテストで fetch を素でモックしない）。
 * 返す URL を中身だけの data: URL にして、通信を発生させずに配線だけを見る
 */
const previewVideoUrl = vi.fn(
  (_id: number, _mediaType?: "tv" | "movie") =>
    'data:application/json,{"key":null}',
);

vi.mock("@/lib/video-preview", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video-preview")>();
  return {
    ...actual,
    previewVideoUrl: (id: number, mediaType?: "tv" | "movie") =>
      previewVideoUrl(id, mediaType),
  };
});

const { default: ContentRow } = await import("@/components/ContentRow");

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
  vi.useRealTimers();
  previewVideoUrl.mockClear();
});

describe("ContentRow のホバープレビュー", () => {
  function hoverCard(href: string) {
    const link = document.querySelector(`a[href="${href}"]`);
    const card = link?.firstElementChild;
    if (!card) throw new Error(`${href} のカードが無い`);
    fireEvent.mouseEnter(card);
    // 800ms ホバーでプレビューを開き、動画を取りに行く
    act(() => {
      vi.advanceTimersByTime(800);
    });
  }

  it("映画のカードは映画の動画を引く（TV と ID が衝突するため）", () => {
    vi.useFakeTimers();
    const movie: ContentRowItem = {
      id: 129,
      title: "千と千尋の神隠し",
      posterPath: "/p.jpg",
      backdropPath: "/b.jpg",
      href: "/movie/129",
      mediaType: "movie",
    };
    render(<ContentRow title="🆕 最新作" items={[movie]} />);

    hoverCard("/movie/129");

    expect(previewVideoUrl).toHaveBeenCalledWith(129, "movie");
  });

  it("mediaType の無いカードは TV の動画を引く（既存の挙動）", () => {
    vi.useFakeTimers();
    const anime: ContentRowItem = {
      id: 1429,
      title: "進撃の巨人",
      posterPath: "/p.jpg",
      backdropPath: "/b.jpg",
      href: "/anime/1429",
    };
    render(<ContentRow title="📈 今週のトレンド" items={[anime]} />);

    hoverCard("/anime/1429");

    expect(previewVideoUrl).toHaveBeenCalledTimes(1);
    expect(previewVideoUrl.mock.calls[0][1] ?? "tv").toBe("tv");
  });
});

describe("ContentRow の声優カード", () => {
  it("ホバーしなくても写真の中に名前を出す", () => {
    render(<ContentRow title="🎤 人気声優" items={[VOICE_ACTOR]} />);

    const photo = screen.getByAltText("花澤香菜").parentElement;

    expect(photo).not.toBeNull();
    const name = within(photo as HTMLElement).getByText("花澤香菜");
    expect(name).toBeVisible();

    // jsdom は Tailwind を評価しない。スマホで隠すクラスが祖先に無いことを見る
    for (
      let el: HTMLElement | null = name;
      el && el !== photo;
      el = el.parentElement
    ) {
      expect(el.className.split(/\s+/)).not.toContain("hidden");
    }
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
