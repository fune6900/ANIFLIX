import { describe, it, expect } from "vitest";
import { gradientStart } from "@/lib/gradient";

describe("gradientStart", () => {
  it("from / via だけを残し、終点の to-* を落とす", () => {
    expect(gradientStart("from-red-950 via-red-900 to-orange-950")).toBe(
      "from-red-950 via-red-900",
    );
  });

  it("via が無くても from は残す", () => {
    expect(gradientStart("from-blue-950 to-slate-900")).toBe("from-blue-950");
  });

  it("余分な空白は詰める", () => {
    expect(gradientStart("  from-a-1   via-b-2  to-c-3 ")).toBe(
      "from-a-1 via-b-2",
    );
  });
});
