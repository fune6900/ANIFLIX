import { describe, it, expect } from "vitest";
import {
  STREAMING_SERVICES,
  findStreamingService,
  matchesStreamingService,
  streamingServicesIn,
} from "@/lib/providers";
import type {
  TMDbWatchProvider,
  TMDbWatchProvidersResponse,
} from "@/types/tmdb";

/**
 * 配信サービスの判定（#77）。
 *
 * TMDb の provider_name は同じサービスでも表記がゆれる（`Amazon Prime Video` /
 * `Prime Video` 等）。詳細ページの「配信中のサービス」と一覧のフィルターで
 * 判定が食い違わないよう、ここ 1 か所で持つ。
 */

function provider(name: string, id = 1): TMDbWatchProvider {
  return {
    provider_id: id,
    provider_name: name,
    logo_path: null,
    display_priority: 1,
  };
}

describe("STREAMING_SERVICES", () => {
  it("ISSUE の 8 サービスを持つ", () => {
    expect(STREAMING_SERVICES.map((s) => s.slug)).toEqual([
      "netflix",
      "prime-video",
      "u-next",
      "d-anime",
      "disney-plus",
      "hulu",
      "abema",
      "dmm-tv",
    ]);
  });

  it("slug は URL にそのまま載せられる形", () => {
    for (const s of STREAMING_SERVICES) {
      expect(s.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe("findStreamingService", () => {
  it("slug から引ける", () => {
    expect(findStreamingService("netflix")?.label).toBe("Netflix");
  });

  it("未知の slug・プロトタイプのキーは undefined", () => {
    expect(findStreamingService("crunchyroll")).toBeUndefined();
    expect(findStreamingService("constructor")).toBeUndefined();
    expect(findStreamingService("")).toBeUndefined();
  });
});

describe("matchesStreamingService: 表記ゆれ", () => {
  it.each([
    ["netflix", "Netflix"],
    ["netflix", "Netflix basic with Ads"],
    ["prime-video", "Amazon Prime Video"],
    ["prime-video", "Prime Video"],
    ["prime-video", "Amazon Prime Video with Ads"],
    ["u-next", "U-NEXT"],
    ["u-next", "U-Next"],
    ["d-anime", "dAnime Store"],
    ["d-anime", "d Anime Store"],
    ["disney-plus", "Disney Plus"],
    ["disney-plus", "Disney+"],
    ["hulu", "Hulu"],
    ["abema", "ABEMA"],
    ["abema", "Abema TV"],
    ["dmm-tv", "DMM TV"],
  ])("%s は %s を拾う", (slug, name) => {
    expect(matchesStreamingService(slug, name)).toBe(true);
  });

  it.each([
    ["prime-video", "Crunchyroll Amazon Channel"],
    ["netflix", "Hulu"],
    ["d-anime", "Disney Plus"],
    ["dmm-tv", "DMM.com"],
  ])("%s は %s を拾わない", (slug, name) => {
    expect(matchesStreamingService(slug, name)).toBe(false);
  });
});

describe("streamingServicesIn", () => {
  it("日本リージョンの見放題・広告付き・無料で配信中のサービスを返す", () => {
    const res: TMDbWatchProvidersResponse = {
      id: 1,
      results: {
        JP: {
          link: "",
          flatrate: [provider("Netflix"), provider("dAnime Store", 2)],
          ads: [provider("ABEMA", 3)],
          free: [provider("Hulu", 4)],
        },
      },
    };

    expect([...streamingServicesIn(res)].sort()).toEqual([
      "abema",
      "d-anime",
      "hulu",
      "netflix",
    ]);
  });

  it("レンタル・購入だけのサービスは「配信中」に数えない", () => {
    const res: TMDbWatchProvidersResponse = {
      id: 1,
      results: {
        JP: {
          link: "",
          rent: [provider("Amazon Prime Video")],
          buy: [provider("U-NEXT", 2)],
        },
      },
    };

    expect(streamingServicesIn(res).size).toBe(0);
  });

  it("日本以外のリージョンは見ない", () => {
    const res: TMDbWatchProvidersResponse = {
      id: 1,
      results: { US: { link: "", flatrate: [provider("Netflix")] } },
    };

    expect(streamingServicesIn(res).size).toBe(0);
  });

  it("結果が無くても落ちない", () => {
    expect(
      streamingServicesIn({ id: 1, results: {} })
        .size,
    ).toBe(0);
  });
});
