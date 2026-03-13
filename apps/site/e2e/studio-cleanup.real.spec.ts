import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

type CleanupPayload = {
  ok: boolean;
  source: string;
  data: {
    sterile?: boolean;
    legacyBlockTemplatesAfter?: number;
    pagesWithLegacyBlocksAfter?: number;
  };
  cleanup?: {
    sterile: boolean;
    blockTemplates: {
      after: Array<unknown>;
    };
    pages: {
      after: Array<{ legacyBlockCount: number }>;
    };
  };
};

test("@real TV-E2E-01 cleanup removes legacy faq/hero content and reports sterile state", async ({ page }) => {
  test.skip(
    process.env.LMNAS_E2E_REAL_STACK !== "1",
    "Run with LMNAS_E2E_REAL_STACK=1 and a reachable local Strapi stack."
  );
  test.skip(process.env.STUDIO_ENABLE_LEGACY_WIPE !== "1", "Set STUDIO_ENABLE_LEGACY_WIPE=1 for destructive cleanup.");

  const response = await page.request.post("/api/platform/studio/reset");
  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as CleanupPayload;
  expect(payload.ok).toBe(true);
  expect(payload.source).toBe("strapi");
  expect(payload.data.sterile).toBe(true);
  expect(payload.data.legacyBlockTemplatesAfter).toBe(0);
  expect(payload.data.pagesWithLegacyBlocksAfter).toBe(0);
  expect(payload.cleanup?.sterile).toBe(true);
  expect(payload.cleanup?.blockTemplates.after.length).toBe(0);
  expect(payload.cleanup?.pages.after.every((pageEntry) => pageEntry.legacyBlockCount === 0)).toBe(true);

  const evidenceDir = path.resolve(process.cwd(), "docs/phase0_1/proof/evidence/h001");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(path.join(evidenceDir, "tv-e2e-01-sterile-state.json"), JSON.stringify(payload, null, 2), "utf8");
});
