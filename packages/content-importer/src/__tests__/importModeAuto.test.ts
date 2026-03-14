import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createImportPlan } from "../index.js";

const tempDirs: string[] = [];

afterEach(async () => {
  delete process.env.LMNAS_IMPORT_ARTIFACTS_DIR;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "content-import-mode-auto-"));
  tempDirs.push(dir);
  return dir;
}

describe("createImportPlan auto import mode metadata", () => {
  it("records per-section confidence decisions and summary", async () => {
    const dir = await createTempDir();
    process.env.LMNAS_IMPORT_ARTIFACTS_DIR = dir;

    const htmlPath = path.join(dir, "auto-mode.html");
    await writeFile(
      htmlPath,
      [
        "<html><head><title>Auto</title></head><body>",
        '<section><h1>High confidence</h1><p>Readable content</p></section>',
        '<section><div style="unknown-prop:abc;line-height:1.5">Lower confidence</div></section>',
        "</body></html>"
      ].join(""),
      "utf8"
    );

    const plan = await createImportPlan({
      slug: "auto-mode",
      locale: "en",
      html: htmlPath
    });

    expect(plan.source.importMode?.mode).toBe("auto");
    expect(plan.source.importMode?.threshold).toBe(0.85);
    expect(plan.source.importMode?.sections.length).toBeGreaterThan(0);

    const sectionModes = plan.source.importMode?.sections.map((section) => section.mode) ?? [];
    expect(sectionModes).toContain("snapshot");

    const totalSections = plan.source.importMode?.sections.length ?? 0;
    const strictCount = plan.source.importMode?.summary.strictCount ?? 0;
    const snapshotCount = plan.source.importMode?.summary.snapshotCount ?? 0;
    expect(strictCount + snapshotCount).toBe(totalSections);

    expect(plan.source.fidelity?.status).toBe("pending");
    expect(plan.source.fidelity?.threshold).toBe(0.005);
    expect(plan.source.fidelity?.artifactPath).toContain("fidelity-report-auto-mode.json");
  });
});
