import { describe, expect, it } from "vitest";
import { buildThemeScreenshotPath, runThemeFidelity } from "../fidelity/themeRunner.js";

describe("theme fidelity runner", () => {
  it("runs once per theme and reports metrics per theme", async () => {
    const captureCalls: Array<{ themeKey: string; screenshotPath: string }> = [];
    let tick = 100;

    const result = await runThemeFidelity({
      themes: ["dark", "light", "dark"],
      outputDir: "/tmp/fidelity",
      threshold: 0.1,
      now: () => {
        tick += 5;
        return tick;
      },
      captureTheme: async (themeKey, screenshotPath) => {
        captureCalls.push({ themeKey, screenshotPath });
        return {
          diffRatio: themeKey === "dark" ? 0.12 : 0.04
        };
      }
    });

    expect(captureCalls).toEqual([
      { themeKey: "dark", screenshotPath: "/tmp/fidelity/fidelity-dark.png" },
      { themeKey: "light", screenshotPath: "/tmp/fidelity/fidelity-light.png" }
    ]);

    expect(result.runs).toHaveLength(2);
    expect(result.runs[0]).toMatchObject({
      themeKey: "dark",
      screenshotPath: "/tmp/fidelity/fidelity-dark.png",
      metric: {
        diffRatio: 0.12,
        withinThreshold: false
      }
    });
    expect(result.runs[1]).toMatchObject({
      themeKey: "light",
      screenshotPath: "/tmp/fidelity/fidelity-light.png",
      metric: {
        diffRatio: 0.04,
        withinThreshold: true
      }
    });
    expect(result.summary).toEqual({
      themeCount: 2,
      failedThemes: ["dark"],
      averageDiffRatio: 0.08
    });
  });

  it("builds deterministic screenshot path per theme", () => {
    expect(buildThemeScreenshotPath("/tmp/output", "brand")).toBe("/tmp/output/fidelity-brand.png");
  });
});
