// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * `/api/videos`（ContentRow のホバープレビュー）。
 * 映画のカードでも使えるよう `type=movie` を受ける（#90）。
 * `@/lib/tmdb` は自前の lib なのでモックする。
 */

const fetchTMDb = vi.fn(async (_endpoint: string) => ({
  id: 1,
  results: [
    {
      id: "v",
      key: "abc",
      name: "PV",
      site: "YouTube",
      type: "Trailer",
      official: true,
    },
  ],
}));

vi.mock("@/lib/tmdb", () => ({
  fetchTMDb: (endpoint: string) => fetchTMDb(endpoint),
}));

const { GET } = await import("@/app/api/videos/route");

function call(query: string) {
  return GET(new NextRequest(`http://localhost/api/videos?${query}`));
}

afterEach(() => {
  fetchTMDb.mockClear();
});

describe("/api/videos", () => {
  it("type が無ければ TV の動画を引く", async () => {
    const res = await call("id=1429");

    expect(res.status).toBe(200);
    expect(fetchTMDb).toHaveBeenCalledWith("/tv/1429/videos");
    expect(await res.json()).toEqual({ key: "abc" });
  });

  it("type=movie なら映画の動画を引く", async () => {
    const res = await call("id=129&type=movie");

    expect(res.status).toBe(200);
    expect(fetchTMDb).toHaveBeenCalledWith("/movie/129/videos");
  });

  it("想定外の type は 400（TMDb へ渡さない）", async () => {
    const res = await call("id=129&type=person");

    expect(res.status).toBe(400);
    expect(fetchTMDb).not.toHaveBeenCalled();
  });

  it("セキュリティヘッダーを付ける", async () => {
    const res = await call("id=129&type=movie");

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });
});
