import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeOnboard, resolveOnboardOptions } from "../onboard.js";

const basePlan = {
  page: {
    slug: "home",
    locale: "en",
    sourceUrl: "https://lmnas.com/en",
    pageType: "home" as const,
    layoutKey: "homeLayout" as const,
    conversionConfig: {
      intent: "book" as const,
      eventName: "hero_primary_cta_click"
    },
    seo: {
      metaTitle: "Home",
      metaDescription: "Desc",
      canonical: "https://lmnas.com/en",
      robots: "index,follow"
    }
  },
  blocks: [{ __component: "blocks.hero", heading: "Hi" }],
  publish: { state: "draft" as const },
  source: { fetchedAt: "2026-02-28T00:00:00.000Z", schemaVersion: "content-plan.v1" as const }
};

const baseUpsertResult = {
  mode: "upsert" as const,
  action: "updated" as const,
  finalSlug: "home",
  documentId: "doc-1",
  status: "draft" as const,
  existing: { found: true, count: 1 }
};

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "content-onboard-test-"));
  tempDirs.push(dir);
  return dir;
}

describe("onboard command", () => {
  it("errors when both --url and --html are provided", () => {
    expect(() =>
      resolveOnboardOptions(
        {
          slug: "home",
          locale: "en",
          url: "https://lmnas.com/en",
          html: "/tmp/home.html"
        },
        "/repo"
      )
    ).toThrow("Provide exactly one of --url or --html");
  });

  it("errors when neither --url nor --html is provided", () => {
    expect(() =>
      resolveOnboardOptions(
        {
          slug: "home",
          locale: "en"
        },
        "/repo"
      )
    ).toThrow("Provide exactly one of --url or --html");
  });

  it("uses default output path docs/import-plans/<slug>.<locale>.json", async () => {
    const cwd = await createTempDir();
    const createPlan = vi.fn(async () => basePlan);
    const applyPlan = vi.fn(async () => baseUpsertResult);
    const logs: string[] = [];

    await executeOnboard(
      {
        slug: "home",
        locale: "en",
        url: "https://lmnas.com/en"
      },
      {
        cwd: () => cwd,
        createPlan,
        applyPlan,
        log: (line) => logs.push(line)
      }
    );

    const expectedPath = path.join(cwd, "docs", "import-plans", "home.en.json");
    const written = await readFile(expectedPath, "utf8");

    expect(written).toContain('"slug": "home"');
    expect(logs).toContain("PLAN: generated");
    expect(logs).toContain("PLAN_PATH: docs/import-plans/home.en.json");
    expect(applyPlan).not.toHaveBeenCalled();
  });

  it("applies precedence: default skip, --apply executes, --apply with --dry-run=true skips", async () => {
    const cwd = await createTempDir();

    const defaultApply = vi.fn(async () => baseUpsertResult);
    await executeOnboard(
      {
        slug: "home",
        locale: "en",
        url: "https://lmnas.com/en"
      },
      {
        cwd: () => cwd,
        createPlan: async () => basePlan,
        applyPlan: defaultApply,
        log: () => {}
      }
    );
    expect(defaultApply).not.toHaveBeenCalled();

    const executeApply = vi.fn(async () => baseUpsertResult);
    await executeOnboard(
      {
        slug: "home",
        locale: "en",
        url: "https://lmnas.com/en",
        apply: true
      },
      {
        cwd: () => cwd,
        createPlan: async () => basePlan,
        applyPlan: executeApply,
        log: () => {}
      }
    );
    expect(executeApply).toHaveBeenCalledTimes(1);

    const skipApply = vi.fn(async () => baseUpsertResult);
    await executeOnboard(
      {
        slug: "home",
        locale: "en",
        url: "https://lmnas.com/en",
        apply: true,
        "dry-run": "true"
      },
      {
        cwd: () => cwd,
        createPlan: async () => basePlan,
        applyPlan: skipApply,
        log: () => {}
      }
    );
    expect(skipApply).not.toHaveBeenCalled();
  });

  it("prints stable output keys PLAN_PATH/APPLY/UPSERT_RESULT", async () => {
    const cwd = await createTempDir();
    const logs: string[] = [];

    await executeOnboard(
      {
        slug: "home",
        locale: "en",
        url: "https://lmnas.com/en",
        apply: true
      },
      {
        cwd: () => cwd,
        createPlan: async () => basePlan,
        applyPlan: async () => baseUpsertResult,
        log: (line) => logs.push(line)
      }
    );

    expect(logs.some((line) => line.startsWith("PLAN_PATH:"))).toBe(true);
    expect(logs.some((line) => line.startsWith("APPLY:"))).toBe(true);
    expect(logs.some((line) => line.startsWith("UPSERT_RESULT:"))).toBe(true);
  });
});
