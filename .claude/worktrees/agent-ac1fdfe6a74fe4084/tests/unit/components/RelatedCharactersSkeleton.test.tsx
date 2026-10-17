import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import RelatedCharactersSkeleton from "@/components/RelatedCharactersSkeleton";

describe("RelatedCharactersSkeleton", () => {
  it("本物と同じ id と scroll-mt を持ち、#related-characters の直リンクで着地できる", () => {
    const { container } = render(<RelatedCharactersSkeleton />);
    const root = container.firstElementChild;

    expect(root?.id).toBe("related-characters");
    expect(root?.className).toContain("scroll-mt-24");
  });
});
