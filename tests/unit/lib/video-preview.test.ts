import { describe, it, expect } from "vitest";
import { previewCacheKey, previewVideoUrl } from "@/lib/video-preview";

/**
 * ContentRow のホバープレビューが叩く URL（#90）。
 * TV と映画は ID 空間が別で、映画の ID で TV の動画を引くと別作品のトレーラーが出る。
 */
describe("previewVideoUrl", () => {
  it("TV（既定）は従来どおり id だけ", () => {
    expect(previewVideoUrl(1429)).toBe("/api/videos?id=1429");
    expect(previewVideoUrl(1429, "tv")).toBe("/api/videos?id=1429");
  });

  it("映画は type=movie を付ける", () => {
    expect(previewVideoUrl(129, "movie")).toBe("/api/videos?id=129&type=movie");
  });
});

describe("previewCacheKey", () => {
  it("同じ ID でも TV と映画を別に覚える", () => {
    expect(previewCacheKey(129, "tv")).not.toBe(previewCacheKey(129, "movie"));
  });
});
