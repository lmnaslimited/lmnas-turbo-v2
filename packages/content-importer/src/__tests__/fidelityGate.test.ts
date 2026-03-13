import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { contentPlanSchema, type ContentPlan } from "../contracts/contentPlan.schema.js";
import { enforceFidelityGateForApply, runFidelityGate } from "../fidelity/gate.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "content-fidelity-gate-"));
  tempDirs.push(dir);
  return dir;
}

function createSnapshotPlan(): ContentPlan {
  return contentPlanSchema.parse({
    page: {
      slug: "snapshot",
      locale: "en",
      sourceUrl: "https://example.com",
      pageType: "simple",
      layoutKey: "simpleLayout",
      conversionConfig: {
        intent: "book",
        eventName: "hero_primary_cta_click"
      },
      seo: {
        metaTitle: "Snapshot",
        metaDescription: "Snapshot",
        canonical: "https://example.com",
        robots: "index,follow"
      }
    },
    blocks: [
      {
        __component: "blocks.imported-dom-snapshot",
        domJson: { kind: "root", children: [] },
        classMap: {},
        stylesheetRef: "/generated/imported/imported-abc.css"
      }
    ],
    publish: {
      state: "draft"
    },
    source: {
      fetchedAt: "2026-03-01T00:00:00.000Z",
      schemaVersion: "content-plan.v1",
      theme: {
        themeKey: "default",
        themeScopeClass: "theme-default"
      },
      fidelity: {
        threshold: 0.005,
        status: "pending",
        artifactPath: "/tmp/fidelity-report-snapshot.json"
      }
    }
  });
}

describe("fidelity gate", () => {
  it("marks report as fail when threshold is exceeded without force", async () => {
    const dir = await createTempDir();
    const plan = createSnapshotPlan();

    const report = await runFidelityGate({
      plan,
      outputDir: dir,
      threshold: 0.005,
      captureTheme: async ({ themeKey, screenshotPath }) => ({
        screenshotPath,
        diffRatio: themeKey === "default" ? 0.02 : 0.001
      })
    });

    expect(report.status).toBe("fail");
    expect(report.summary.failedThemes).toEqual(["default"]);
    expect(report.summary.maxDiffRatio).toBe(0.02);

    const written = await readFile(report.artifactPath as string, "utf8");
    expect(written).toContain('"schemaVersion": "import-fidelity.v1"');
    expect(written).toContain('"status": "fail"');
  });

  it("marks report as forced when threshold is exceeded with force", async () => {
    const dir = await createTempDir();
    const plan = createSnapshotPlan();

    const report = await runFidelityGate({
      plan,
      outputDir: dir,
      force: true,
      threshold: 0.005,
      captureTheme: async ({ screenshotPath }) => ({
        screenshotPath,
        diffRatio: 0.01
      })
    });

    expect(report.status).toBe("forced");
    expect(report.summary.failedThemes).toEqual(["default"]);
  });

  it("blocks apply when snapshot plan has no completed fidelity report", () => {
    const plan = createSnapshotPlan();

    expect(() => enforceFidelityGateForApply(plan)).toThrow("fidelity gate missing report");

    const forced = enforceFidelityGateForApply(plan, { force: true });
    expect(forced).toEqual({
      status: "forced",
      threshold: 0.005,
      failedThemes: ["unverified"],
      artifactPath: "/tmp/fidelity-report-snapshot.json"
    });
  });
});
