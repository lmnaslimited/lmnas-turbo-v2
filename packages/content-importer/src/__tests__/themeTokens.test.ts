import { describe, expect, it } from "vitest";
import {
  buildThemeScopeClass,
  findNearestColorToken,
  matchThemeToken,
  normalizeThemeKey,
  type ThemeTokenRegistry
} from "../import/themeTokens.js";

const registry: ThemeTokenRegistry = {
  colors: {
    primary: "#112233",
    accent: "#445566"
  },
  typography: {
    headingWeight: "700",
    bodySize: "16px"
  },
  radius: {
    md: "8px"
  },
  shadow: {
    md: "0 4px 6px rgba(0,0,0,0.1),0 2px 4px rgba(0,0,0,0.06)"
  }
};

describe("themeTokens", () => {
  it("normalizes theme key and scope class deterministically", () => {
    expect(normalizeThemeKey("  Enterprise Blue  ")).toBe("enterprise-blue");
    expect(buildThemeScopeClass("Enterprise Blue")).toBe("theme-enterprise-blue");
    expect(buildThemeScopeClass("default")).toBe("theme-default");
  });

  it("classifies nearest color matches using thresholds", () => {
    const accept = findNearestColorToken("#112233", registry, () => 2);
    const soft = findNearestColorToken("#223344", registry, () => 7.25);
    const reject = findNearestColorToken("#334455", registry, () => 12.5);

    expect(accept).toMatchObject({ matchedTokenKey: "accent", status: "accept" });
    expect(soft).toMatchObject({ matchedTokenKey: "accent", status: "soft" });
    expect(reject).toMatchObject({ matchedTokenKey: "accent", status: "reject" });
  });

  it("matches non-color tokens exactly and reports unknown values", () => {
    const exactTypography = matchThemeToken("typography", "700", registry);
    const unknownTypography = matchThemeToken("typography", "900", registry);

    expect(exactTypography).toMatchObject({ status: "exact", tokenType: "typography", tokenKey: "headingWeight" });
    expect(unknownTypography).toMatchObject({ status: "unknown", tokenType: "typography" });
  });
});
