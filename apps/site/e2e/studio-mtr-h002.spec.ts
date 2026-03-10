import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

const evidenceDir = path.resolve(process.cwd(), "docs/phase0_1/proof/evidence/h002");

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

test.describe("H-002 matrix tests (TV-MTR)", () => {
  test.beforeEach(async ({ page }) => {
    await resetStudioState(page);
    ensureEvidenceDir();
  });

  test("TV-MTR-01 swatch preview toggles instantly and resets after refresh", async ({ page }) => {
    const response = await page.request.post("/api/platform/studio/themes", {
      data: {
        mode: "create",
        sourceType: "html_upload",
        theme: {
          id: "theme-tv-mtr-01",
          themeKey: "tv-mtr-01",
          name: "TV MTR 01 Theme",
          status: "draft",
          sourceRef: "tv-mtr-01",
          createdAt: "2026-03-10",
          updatedAt: "2026-03-10",
          tokenCoverage: 0.87,
          themeDebt: "none",
          darkMode: true,
          tokens: [
            {
              key: "surface-bg",
              label: "Surface Background",
              category: "color",
              value: "#111827",
              cssVariable: "--theme-surface-bg",
              mapped: true
            },
            {
              key: "surface-text",
              label: "Surface Text",
              category: "color",
              value: "#f9fafb",
              cssVariable: "--theme-surface-text",
              mapped: true
            },
            {
              key: "surface-accent",
              label: "Surface Accent",
              category: "color",
              value: "#22c55e",
              cssVariable: "--theme-surface-accent",
              mapped: true
            }
          ]
        }
      }
    });
    expect(response.ok()).toBe(true);

    await page.goto("/platform/onboarding/theme");
    await page.getByRole("button", { name: /TV MTR 01 Theme/ }).first().click();
    await page.getByTestId("studio-action-apply-swatch").click();
    await expect(page.getByTestId("theme-swatch-banner")).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-01-swatch-applied.png"),
      fullPage: true
    });

    await page.reload();
    await expect(page.getByTestId("theme-swatch-banner")).toHaveCount(0);
    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-01-after-refresh-active-theme.png"),
      fullPage: true
    });
  });

  test("TV-MTR-02 derive sample preview and duplicate warning trap", async ({ page }) => {
    await page.goto("/platform/onboarding/theme");
    await page.getByTestId("theme-open-derive").click();
    await page.getByTestId("theme-name-input").fill("LMNAs Default");
    await page.getByTestId("theme-key-input").fill("default");
    await page.getByTestId("theme-source-textarea").fill("<section style='color:#22c55e'>Theme preview</section>");
    await page.getByTestId("theme-generate-preview").click();

    await expect(page.getByTestId("theme-sample-preview")).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-02-theme-sample-preview.png"),
      fullPage: true
    });

    await page.getByTestId("studio-action-save-candidate").click();
    await expect(page.getByTestId("theme-duplicate-warning")).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-02-duplicate-warning-dialog.png"),
      fullPage: true
    });
  });

  test("TV-MTR-03 where-used dependency blocks deletion", async ({ page }) => {
    const pageSaveResponse = await page.request.post("/api/platform/studio/pages", {
      data: {
        page: {
          id: "tv-mtr-03-page",
          name: "TV MTR 03 Page",
          slug: "tv-mtr-03-page",
          locale: "en",
          blockOrder: ["blk-hero-1"],
          fieldValues: {},
          actionOverrides: {},
          previewHtml: "<main>tv-mtr-03</main>"
        }
      }
    });
    expect(pageSaveResponse.ok()).toBe(true);

    await page.goto("/platform/onboarding/blocks");
    await expect(page.getByTestId("blocks-group-hero")).toBeVisible();
    await page.getByTestId("blocks-group-hero").click();
    await page.getByRole("button", { name: /Hero Section/ }).first().click();
    await page.getByTestId("studio-action-delete-block").click();
    await expect(page.getByTestId("blocks-where-used-modal")).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-03-where-used-rejection-modal.png"),
      fullPage: true
    });
  });

  test("TV-MTR-04 browse is default and action mapping remains native in block detail", async ({ page }) => {
    await page.goto("/platform/onboarding/blocks");
    await expect(page.getByTestId("blocks-group-hero")).toBeVisible();
    await page.getByTestId("blocks-group-hero").click();
    await page.getByRole("button", { name: /Hero Section/ }).first().click();
    await expect(page.getByTestId("blocks-native-action-map")).toBeVisible();

    const actionMappingResponse = await page.request.get("/platform/onboarding/action-mapping");
    const actionsResponse = await page.request.get("/platform/onboarding/actions");
    expect(actionMappingResponse.status()).toBe(404);
    expect(actionsResponse.status()).toBe(404);

    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-04-browse-default-and-native-actions.png"),
      fullPage: true
    });
  });

  test("TV-MTR-05 fallback rendering strips CDN scripts and keeps structural classes", async ({ page }) => {
    const createResponse = await page.request.post("/api/platform/studio/blocks", {
      data: {
        block: {
          id: "blk-fallback-cdn",
          key: "blk-fallback-cdn",
          name: "Fallback CDN Block",
          family: "hero",
          status: "active",
          themeKey: "default",
          sourceType: "raw_html",
          sourceRef: "tv-mtr-05",
          confidence: 0.9,
          editableFields: ["heading"],
          actions: [],
          previewHtml:
            "<script src='https://cdn.tailwindcss.com'></script><script id='tailwind-config'>window.tailwind={};</script><section class='p-8'><h2>Fallback Block</h2></section>",
          inUseCount: 0,
          createdAt: "2026-03-10",
          updatedAt: "2026-03-10"
        }
      }
    });
    expect(createResponse.ok()).toBe(true);

    await page.goto("/platform/onboarding/blocks");
    await page.getByTestId("blocks-group-hero").click();
    await page.getByRole("button", { name: /Fallback CDN Block/ }).first().click();

    const srcDoc = await page.getByTestId("blocks-browse-preview").getAttribute("srcdoc");
    expect(srcDoc).toContain("lmnas-block-fallback-frame");
    expect(srcDoc).not.toContain("cdn.tailwindcss.com");
    expect(srcDoc).not.toContain("tailwind-config");

    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-05-fallback-render.png"),
      fullPage: true
    });
  });

  test("TV-MTR-08 shell mapping updates propagate in global onboarding wrappers", async ({ page }) => {
    await page.goto("/platform/onboarding/shells");
    await page.getByRole("button", { name: /Main Shell/ }).first().click();

    const footerHeroToggle = page.getByTestId("shell-footer-map-blk-hero-1");
    if (!(await footerHeroToggle.isChecked())) {
      await footerHeroToggle.click();
    }

    await expect(page.getByTestId("studio-shell-global-footer")).toContainText("Hero Section");
    await expect(page.getByTestId("shell-block-mapping")).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-08-shell-global-mapping.png"),
      fullPage: true
    });

    const [themesResponse, blocksResponse, shellsResponse, pagesResponse] = await Promise.all([
      page.request.get("/api/platform/studio/themes"),
      page.request.get("/api/platform/studio/blocks"),
      page.request.get("/api/platform/studio/shells"),
      page.request.get("/api/platform/studio/pages")
    ]);

    writeJsonEvidence("tv-mtr-08-studio-entity-snapshot.json", {
      themes: await themesResponse.json(),
      blocks: await blocksResponse.json(),
      shells: await shellsResponse.json(),
      pages: await pagesResponse.json()
    });
  });
});
