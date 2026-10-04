import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { TMDbPersonCreditCast, TMDbPersonDetail } from "@/types/tmdb";

/**
 * 声優詳細ページ（#103）。
 * - 上部のぼかし拡大プロフィール写真（original サイズの背景）を出さない
 * - 出演作品は 1 ページ 30 件
 * `@/lib/tmdb` は自前の lib なのでモックする。演じたキャラ（AniList）は
 * `VoicedCharacters.test.tsx` が受け持つので、ここでは描画しない
 */

function credit(i: number): TMDbPersonCreditCast {
  return {
    id: i + 1,
    name: `作品${i + 1}`,
    character: `役${i + 1}`,
    media_type: "tv",
    poster_path: `/p${i + 1}.jpg`,
    // 評価の降順に並べ替えられても番号順のままになるよう、番号が大きいほど低くする
    vote_average: 9 - i * 0.01,
  };
}

/** アニメ出演 65 件 = 30 件ずつ 3 ページ */
const PERSON: TMDbPersonDetail = {
  id: 9,
  name: "声優A",
  original_name: "Seiyuu A",
  profile_path: "/face.jpg",
  known_for_department: "Acting",
  popularity: 12.3,
  biography: "",
  birthday: null,
  deathday: null,
  place_of_birth: null,
  also_known_as: [],
  combined_credits: { cast: Array.from({ length: 65 }, (_, i) => credit(i)) },
};

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb")>();
  return {
    ...actual,
    getPersonDetail: () => Promise.resolve(PERSON),
  };
});

vi.mock("@/components/VoicedCharacters", () => ({
  default: () => null,
}));

const { default: VoiceActorDetailPage } =
  await import("@/app/voice-actors/[id]/page");

async function renderAt(page?: string) {
  return render(
    await VoiceActorDetailPage({
      params: Promise.resolve({ id: "9" }),
      searchParams: Promise.resolve(page ? { page } : {}),
    }),
  );
}

/**
 * 画像の元 URL。Vitest では next.config の `unoptimized: true` が効かず
 * `/_next/image?url=<エンコード済み>` になるため、デコードして比べる
 */
function imageSrc(img: Element): string {
  return decodeURIComponent(img.getAttribute("src") ?? "");
}

function workLinks(container: HTMLElement): HTMLAnchorElement[] {
  return [
    ...container.querySelectorAll<HTMLAnchorElement>('a[href^="/anime/"]'),
  ];
}

describe("声優詳細ページ", () => {
  it("上部にぼかし拡大したプロフィール写真の背景を出さない", async () => {
    const { container } = await renderAt();

    // 画像は w500 のプロフィール写真 1 枚と出演作のポスターだけ。
    // サイズ・alt・クラスを変えた背景画像を足してもここで落ちる
    const outsideWorks = [...container.querySelectorAll("img")].filter(
      (img) => !img.closest('a[href^="/anime/"]'),
    );
    expect(outsideWorks.map(imageSrc)).toEqual([
      expect.stringContaining("/w500/face.jpg"),
    ]);
    expect(container.querySelector(".blur-sm")).toBeNull();
  });

  it("通常のプロフィール写真は残し、最初に読み込む（priority）", async () => {
    const { container } = await renderAt();

    const profile = [...container.querySelectorAll("img")].filter(
      (img) => img.getAttribute("alt") === "声優A",
    );
    expect(profile).toHaveLength(1);
    expect(imageSrc(profile[0])).toContain("/w500/face.jpg");
    // Next 15 の next/image は priority を付けると loading="lazy" を外して preload する
    // （fetchpriority は付かない）。付けなければ他のポスターと同じく lazy になる
    expect(profile[0].getAttribute("loading")).not.toBe("lazy");
  });

  it("本文は固定ヘッダーの下から始める（pt-24・負のマージンで上に重ねない）", async () => {
    const { container } = await renderAt();

    const wrapper = container.querySelector(".site-container")?.parentElement;
    const classes = (wrapper?.className ?? "").split(/\s+/);
    expect(classes).toContain("pt-24");
    expect(classes.filter((c) => /(^|:)-mt-/.test(c))).toEqual([]);
  });

  it("出演作品は 1 ページ 30 件", async () => {
    const { container } = await renderAt();

    expect(workLinks(container)).toHaveLength(30);
    expect(container.textContent).toContain("65件");
    expect(container.textContent).toContain("1 / 3 ページ");
  });

  it("最終ページには残りの 5 件を出す", async () => {
    const { container } = await renderAt("3");

    const links = workLinks(container);
    expect(links).toHaveLength(5);
    expect(links[0].getAttribute("href")).toBe("/anime/61");
  });
});
