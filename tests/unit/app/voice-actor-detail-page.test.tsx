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

    const originals = [...container.querySelectorAll("img")].filter((img) =>
      imageSrc(img).includes("/original/"),
    );
    expect(originals).toEqual([]);
    expect(container.querySelector(".blur-sm")).toBeNull();
  });

  it("通常のプロフィール写真は残す", async () => {
    const { container } = await renderAt();

    const profile = [...container.querySelectorAll("img")].filter(
      (img) => img.getAttribute("alt") === "声優A",
    );
    expect(profile).toHaveLength(1);
    expect(imageSrc(profile[0])).toContain("/w500/face.jpg");
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

  it("出演作品の列数はどの段でも 30 件を割り切る（最終行を欠けさせない）", async () => {
    const { container } = await renderAt();

    const grid = workLinks(container)[0]?.parentElement;
    const counts = (grid?.className ?? "")
      .split(/\s+/)
      .map((c) => c.match(/(?:^|:)grid-cols-(\d+)$/)?.[1])
      .filter((n): n is string => Boolean(n))
      .map(Number);

    expect(counts.length).toBeGreaterThan(0);
    for (const n of counts) expect(30 % n, `${n} 列`).toBe(0);
  });
});
