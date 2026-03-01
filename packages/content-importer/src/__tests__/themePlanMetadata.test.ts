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
  const dir = await mkdtemp(path.join(os.tmpdir(), "content-theme-plan-test-"));
  tempDirs.push(dir);
  return dir;
}

describe("createImportPlan theme metadata", () => {
  it("stores custom theme metadata and applies themeScopeClass in classMap", async () => {
    const dir = await createTempDir();
    process.env.LMNAS_IMPORT_ARTIFACTS_DIR = dir;

    const htmlPath = path.join(dir, "theme.html");
    await writeFile(
      htmlPath,
      '<html><head><title>Theme Page</title></head><body><h1 style="font-weight:700">Theme Heading</h1><p>Body</p></body></html>',
      "utf8"
    );

    const plan = await createImportPlan({
      slug: "theme",
      locale: "en",
      html: htmlPath,
      theme: "Brand Light"
    });

    expect(plan.source.theme).toEqual({
      themeKey: "brand-light",
      themeScopeClass: "theme-brand-light"
    });

    const snapshot = plan.blocks.find((block) => block?.__component === "blocks.imported-dom-snapshot");
    const classMap = (snapshot as { classMap?: Record<string, string> } | undefined)?.classMap ?? {};

    expect(Object.values(classMap).some((value) => value.includes("theme-brand-light"))).toBe(true);
  });

  it("defaults to theme-default when theme is not provided", async () => {
    const dir = await createTempDir();
    process.env.LMNAS_IMPORT_ARTIFACTS_DIR = dir;

    const htmlPath = path.join(dir, "theme-default.html");
    await writeFile(
      htmlPath,
      '<html><head><title>Theme Page</title></head><body><h1>Default Theme</h1><p>Body</p></body></html>',
      "utf8"
    );

    const plan = await createImportPlan({
      slug: "theme-default",
      locale: "en",
      html: htmlPath
    });

    expect(plan.source.theme).toEqual({
      themeKey: "default",
      themeScopeClass: "theme-default"
    });
  });
});
