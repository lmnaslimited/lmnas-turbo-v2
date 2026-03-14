import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

const evidenceDir = path.resolve(process.cwd(), "docs/phase0_1/proof/evidence/h005");
const governedCodeHtmlPath = path.resolve(process.cwd(), "docs/testing-artifacts/code.html");

function ensureEvidenceDir(): void {
  mkdirSync(evidenceDir, { recursive: true });
}

function writeJsonEvidence(fileName: string, payload: unknown): void {
  ensureEvidenceDir();
  writeFileSync(path.join(evidenceDir, fileName), JSON.stringify(payload, null, 2), "utf8");
}

async function resetStudioState(page: import("playwright/test").Page): Promise<void> {
  await page.request.post("/api/platform/studio/reset");
}

test.describe("H-005 page workflow real-stack tests", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      process.env.LMNAS_E2E_REAL_STACK !== "1",
      "Run with LMNAS_E2E_REAL_STACK=1 and a reachable local Strapi stack."
    );
    ensureEvidenceDir();
    await resetStudioState(page);
  });

  test("@real TV-E2E-04 compile page template with shared page workflow containers", async ({ page }) => {
    await page.goto("/platform/onboarding/pages");

    await expect(page.getByTestId("pages-list-container")).toBeVisible();
    await expect(page.getByTestId("pages-detail-container")).toBeVisible();
    await expect(page.getByTestId("pages-action-container")).toBeVisible();
    await expect(page.getByText("Browse existing pages and select one for composition editing.")).toBeVisible();

    await page.getByTestId("studio-action-pages-create-draft").click();
    await page.getByTestId("pages-name-input").fill("TV-E2E-04 Page");
    await page.getByTestId("pages-slug-input").fill("tv-e2e-04-page");

    const blockSelect = page.getByTestId("pages-add-block-select");
    await expect(blockSelect).toBeVisible();
    await expect
      .poll(async () => {
        return await blockSelect.locator("option").count();
      })
      .toBeGreaterThan(0);

    await page.getByTestId("pages-add-block-button").click();
    await expect(page.getByTestId("pages-composed-block-0")).toBeVisible();

    await page.getByTestId("studio-action-pages-save-draft").click();
    await expect(page.getByText("Draft saved successfully.")).toBeVisible();

    await page.getByTestId("studio-action-pages-publish-template").click();
    await expect(page.getByText(/Page published|Page saved locally/)).toBeVisible();

    await page.getByTestId("pages-preview-mode-production").click();
    await expect(page.getByTestId("pages-preview-frame")).toBeVisible();

    const pagePayloadResponse = await page.request.get("/api/platform/studio/pages?slug=tv-e2e-04-page");
    expect(pagePayloadResponse.ok()).toBe(true);
    const pagePayload = (await pagePayloadResponse.json()) as {
      ok: boolean;
      data: {
        slug: string;
        blockOrder: string[];
      } | null;
    };
    expect(pagePayload.ok).toBe(true);
    expect(pagePayload.data?.slug).toBe("tv-e2e-04-page");
    expect(pagePayload.data?.blockOrder.length).toBeGreaterThan(0);

    await page.screenshot({
      path: path.join(evidenceDir, "tv-e2e-04-page-composition-shared-container.png"),
      fullPage: true
    });

    writeJsonEvidence("tv-e2e-04-page-template-compile-log.json", {
      pageDocument: pagePayload
    });
  });

  test("@real TV-MTR-09 full markup import creates block rows and zero route-slug entities", async ({ page }) => {
    const strapiUrl = process.env.STRAPI_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:1337";
    const strapiToken = process.env.STRAPI_API_TOKEN;
    const strapiHeaders = {
      "content-type": "application/json",
      ...(strapiToken ? { Authorization: `Bearer ${strapiToken}` } : {})
    };

    const beforePagesResponse = await page.request.get(`${strapiUrl}/api/pages?pagination[pageSize]=1`, {
      headers: strapiHeaders
    });
    expect(beforePagesResponse.ok()).toBe(true);
    const beforePagesPayload = (await beforePagesResponse.json()) as {
      meta?: { pagination?: { total?: number } };
    };

    const governedHtml = readFileSync(governedCodeHtmlPath, "utf8");
    const importResponse = await page.request.post("/api/platform/studio/pages", {
      data: {
        mode: "import-blocks",
        html: governedHtml,
        sourceRef: "docs/testing-artifacts/code.html"
      }
    });
    expect(importResponse.ok()).toBe(true);

    const importPayload = (await importResponse.json()) as {
      ok: boolean;
      source: string;
      data: {
        blockCount: number;
        routeSlugEntitiesCreated: number;
        pageCountBefore: number | null;
        pageCountAfter: number | null;
        importedBlocks: Array<{ key: string; family: string }>;
      };
    };

    expect(importPayload.ok).toBe(true);
    expect(importPayload.data.blockCount).toBeGreaterThan(0);
    expect(importPayload.data.routeSlugEntitiesCreated).toBe(0);

    const afterPagesResponse = await page.request.get(`${strapiUrl}/api/pages?pagination[pageSize]=1`, {
      headers: strapiHeaders
    });
    expect(afterPagesResponse.ok()).toBe(true);
    const afterPagesPayload = (await afterPagesResponse.json()) as {
      meta?: { pagination?: { total?: number } };
    };

    const beforeTotal = beforePagesPayload.meta?.pagination?.total ?? 0;
    const afterTotal = afterPagesPayload.meta?.pagination?.total ?? 0;
    expect(afterTotal).toBe(beforeTotal);

    await page.goto("/platform/onboarding/pages");
    await expect(page.getByText("Browse existing pages and select one for composition editing.")).toBeVisible();
    await page.getByTestId("studio-action-pages-create-draft").click();
    const blockSelect = page.getByTestId("pages-add-block-select");
    await expect(blockSelect).toBeVisible();
    await expect
      .poll(async () => {
        return await blockSelect.locator("option").count();
      })
      .toBeGreaterThan(0);
    await page.getByTestId("pages-add-block-button").click();
    await page.getByTestId("studio-action-pages-publish-template").click();
    await page.getByTestId("pages-preview-mode-draft").click();
    await page.getByTestId("pages-add-block-button").click();
    await page.getByTestId("pages-preview-mode-production").click();
    await expect(page.getByTestId("pages-preview-frame")).toBeVisible();

    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-09-import-blocks-no-route-slug.png"),
      fullPage: true
    });

    writeJsonEvidence("tv-mtr-09-import-blocks-no-route-slug-log.json", {
      strapiPageCountBefore: beforeTotal,
      strapiPageCountAfter: afterTotal,
      importResponse: importPayload
    });
  });
});
