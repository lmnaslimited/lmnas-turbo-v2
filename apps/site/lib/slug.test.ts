import { describe, expect, it } from "vitest";
import { resolveCmsSlug } from "./slug";

describe("resolveCmsSlug", () => {
  it("returns home for empty values", () => {
    expect(resolveCmsSlug(undefined)).toBe("home");
    expect(resolveCmsSlug([])).toBe("home");
  });

  it("joins slug segments with slash", () => {
    expect(resolveCmsSlug(["products", "cpq"])).toBe("products/cpq");
    expect(resolveCmsSlug(["solutions", "tender-intelligence"])).toBe("solutions/tender-intelligence");
  });
});
