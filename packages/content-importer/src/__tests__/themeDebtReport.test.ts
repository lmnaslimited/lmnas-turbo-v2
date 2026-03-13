import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildThemeDebtEntriesFromCss,
  buildThemeDebtReport,
  writeThemeDebtReport,
  type ThemeDebtDeclarationInput
} from "../import/themeDebtReport.js";
import type { ThemeTokenRegistry } from "../import/themeTokens.js";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "theme-debt-report-test-"));
  tempDirs.push(dir);
  return dir;
}

const registry: ThemeTokenRegistry = {
  colors: {
    primary: "#112233"
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

describe("themeDebtReport", () => {
  it("builds debt entries from css declarations deterministically", () => {
    const entries = buildThemeDebtEntriesFromCss([
      {
        path: "0.0",
        declarations: {
          "font-weight": "700",
          color: "#112233",
          "border-radius": "8px"
        }
      }
    ]);

    expect(entries).toEqual([
      { tokenType: "colors", tokenKey: "0.0.color", rawValue: "#112233" },
      { tokenType: "radius", tokenKey: "0.0.border-radius", rawValue: "8px" },
      { tokenType: "typography", tokenKey: "0.0.font-weight", rawValue: "700" }
    ]);
  });

  it("emits unknown/soft/hard failure counts using thresholds", () => {
    const declarations: ThemeDebtDeclarationInput[] = [
      { tokenType: "colors", tokenKey: "0.color", rawValue: "#112233" },
      { tokenType: "colors", tokenKey: "0.1.color", rawValue: "#223344" },
      { tokenType: "colors", tokenKey: "0.2.color", rawValue: "#abcdef" },
      { tokenType: "typography", tokenKey: "0.font-weight", rawValue: "900" }
    ];

    const report = buildThemeDebtReport({
      themeKey: "Acme Light",
      generatedAt: "2026-03-01T00:00:00.000Z",
      declarations,
      registry,
      distanceFn: (leftHex) => {
        if (leftHex === "#223344") {
          return 7.1;
        }
        if (leftHex === "#abcdef") {
          return 12.6;
        }
        return 0;
      }
    });

    expect(report.schemaVersion).toBe("theme-debt.v1");
    expect(report.themeKey).toBe("acme-light");
    expect(report.summary).toEqual({
      unknownCount: 1,
      softMatchCount: 1,
      hardFailureCount: 1
    });
    expect(report.nearestMatches[0]).toMatchObject({ tokenType: "colors", matchedTokenKey: "primary" });
    expect(report.hardFailures[0]?.tokenType).toBe("colors");
  });

  it("writes report JSON deterministically", async () => {
    const dir = await createTempDir();
    const filePath = path.join(dir, "theme-debt.default.json");
    const report = buildThemeDebtReport({
      themeKey: "default",
      generatedAt: "2026-03-01T00:00:00.000Z",
      declarations: [],
      registry
    });

    await writeThemeDebtReport(filePath, report);
    const written = await readFile(filePath, "utf8");

    expect(written).toContain('"schemaVersion": "theme-debt.v1"');
    expect(written).toContain('"themeKey": "default"');
  });
});
