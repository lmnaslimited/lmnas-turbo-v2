import { describe, expect, it } from "vitest";
import { evaluateStudioFidelity } from "./fidelity";

const ACTIVE_THEME_LIGHT = {
  id: "theme-light",
  themeKey: "light",
  name: "Light Theme",
  status: "active" as const,
  sourceRef: "seed",
  createdAt: "2026-03-10",
  updatedAt: "2026-03-10",
  tokenCoverage: 0.9,
  themeDebt: "none",
  darkMode: false,
  tokens: [
    {
      key: "font-display",
      label: "Display Font",
      category: "typography" as const,
      value: "Manrope, sans-serif",
      cssVariable: "--font-display",
      mapped: true
    }
  ]
};

describe("studio fidelity evaluator", () => {
  it("flags dark-mode mismatch when source defines @media(dark)", () => {
    const report = evaluateStudioFidelity({
      sourceHtml: [
        "<style>",
        "@media(dark){ body { background:#000; color:#fff; } }",
        "body { font-family: 'Comic Sans MS', cursive; }",
        "</style>"
      ].join(""),
      activeTheme: ACTIVE_THEME_LIGHT,
      threshold: 0.25
    });

    expect(report.hasDarkMediaQuery).toBe(true);
    expect(report.darkModeMismatchRatio).toBeGreaterThan(0.25);
    expect(report.typographyMismatchRatio).toBeGreaterThan(0.25);
    expect(report.exceedsThreshold).toBe(true);
  });
});
