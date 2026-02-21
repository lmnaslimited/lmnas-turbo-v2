import { describe, expect, it } from "vitest";
import { LayoutRegistry } from "./index";

describe("LayoutRegistry", () => {
  it("resolves all required layout keys", () => {
    expect(typeof LayoutRegistry.homeLayout).toBe("function");
    expect(typeof LayoutRegistry.productLayout).toBe("function");
    expect(typeof LayoutRegistry.solutionLayout).toBe("function");
    expect(typeof LayoutRegistry.industryLayout).toBe("function");
    expect(typeof LayoutRegistry.simpleLayout).toBe("function");
  });
});
