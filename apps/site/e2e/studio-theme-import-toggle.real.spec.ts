import { expect, test } from "playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const HTML_FIXTURE_PATH = path.resolve(process.cwd(), "docs/testing-artifacts/code.html");
const EVIDENCE_DIR = path.resolve(process.cwd(), "docs/phase0_1/proof/evidence/h010");

type ThemesPayload = {
  ok: boolean;
  source?: "strapi" | "fallback";
  schemaSource?: "canonical" | "legacy" | "fallback";
  data?: Array<{
    id: string;
    themeKey: string;
    name: string;
    status: "active" | "inactive" | "draft";
  }>;
};

type PublishPayload = {
  ok: boolean;
  data?: {
    source: "strapi" | "fallback";
    persistence?: {
      source: "strapi" | "fallback";
      mutated: boolean;
      pageId: string | null;
    };
    warnings?: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }>;
  };
};

type BlocksPayload = {
  ok: boolean;
  data?: Array<{
    id: string;
    key: string;
    name: string;
    previewHtml?: string;
    targetPreviewHtml?: string;
  }>;
};

type ShellsPayload = {
  ok: boolean;
  data?: Array<{
    id: string;
    key: string;
    status: "active" | "inactive" | "draft";
  }>;
};

type PagesSavePayload = {
  ok: boolean;
  data?: {
    page?: {
      id: string;
      slug: string;
      name: string;
    };
  };
};

type PagesListPayload = {
  ok: boolean;
  data?: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
};

function normalizeHtml(input: string | null): string {
  return (input ?? "").replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

function createRuntimeErrorGate(page: import("playwright/test").Page): () => void {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const ignorePatterns = [
    /favicon\.ico/i,
    /chrome-extension:\/\//i,
    /Blocked script execution in 'about:srcdoc'/i,
    /ERR_NAME_NOT_RESOLVED/i,
    /^Event$/i,
    /Failed to load resource: the server responded with a status of 404/i
  ];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    const text = message.text();
    if (ignorePatterns.some((pattern) => pattern.test(text))) {
      return;
    }
    consoleErrors.push(text);
  });

  return () => {
    expect(pageErrors, `Unexpected pageerror(s):\n${pageErrors.join("\n")}`).toEqual([]);
    expect(consoleErrors, `Unexpected console error(s):\n${consoleErrors.join("\n")}`).toEqual([]);
  };
}

async function ensureEvidenceDir(): Promise<void> {
  await mkdir(EVIDENCE_DIR, { recursive: true });
}

async function resetStudioState(page: import("playwright/test").Page): Promise<boolean> {
  let lastStatus = 0;
  let lastPayload: { ok?: boolean; source?: string } | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await page.request.post("/api/platform/studio/reset");
    lastStatus = response.status();
    if (!response.ok()) {
      await page.waitForTimeout(500);
      continue;
    }
    const payload = (await response.json()) as { ok: boolean; source?: string };
    if (payload.ok && payload.source === "strapi") {
      return true;
    }
    lastPayload = payload;
    await page.waitForTimeout(500);
  }
  console.warn(`reset route never recovered; last status=${lastStatus}; last payload=${JSON.stringify(lastPayload)}`);
  return false;
}

async function gotoStable(page: import("playwright/test").Page, href: string): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(href, { waitUntil: "domcontentloaded" });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(400);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function processHtmlImport(page: import("playwright/test").Page, html: string): Promise<void> {
  await gotoStable(page, "/platform/onboarding/import");
  await expect(page.getByRole("heading", { name: "Import Content" })).toBeVisible();
  const sourceInput = page.getByTestId("import-source-input");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.getByTestId("import-source-tab-html").click({ force: true });
    if (await sourceInput.isVisible().catch(() => false)) {
      break;
    }
    await page.waitForTimeout(250);
  }
  await expect(sourceInput).toBeVisible();
  await sourceInput.fill(html);

  const [processResponse] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/import/process")),
    page.getByTestId("import-process-source").click()
  ]);

  expect(processResponse.ok()).toBe(true);
  await expect(page.getByTestId("import-target-preview")).toBeVisible();
}

async function searchImportedBlocks(page: import("playwright/test").Page): Promise<void> {
  await page.getByTestId("blocks-search-input").fill("import-source");
  await page.getByTestId("blocks-search-input").press("Enter");
  await expect(page.locator("[data-testid^='blocks-item-']").first()).toBeVisible();
}

test.describe("@real theme import toggle flow", () => {
  test.skip(
    process.env.LMNAS_E2E_REAL_STACK !== "1",
    "Run with LMNAS_E2E_REAL_STACK=1 and reachable canonical Strapi stack."
  );

  test("import-created theme is canonical, visible in Theme & Shell, and changes import and blocks previews after activation toggle", async ({ page }) => {
    await ensureEvidenceDir();
    const assertNoRuntimeErrors = createRuntimeErrorGate(page);
    const html = await readFile(HTML_FIXTURE_PATH, "utf8");

    await resetStudioState(page);
    await processHtmlImport(page, html);
    await page.getByPlaceholder("Create theme preset").fill(`E2E Imported Theme ${Date.now()}`);

    const [createThemeResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/themes")),
      page.getByTestId("import-create-theme-from-extraction").click()
    ]);

    expect(createThemeResponse.ok()).toBe(true);
    await expect(page.getByText(/Created and applied extracted Theme Preset:/)).toBeVisible();
    const importTargetWithImportedTheme = normalizeHtml(await page.getByTestId("import-target-preview").getAttribute("srcdoc"));
    expect(importTargetWithImportedTheme).toContain("lmnas-preview-tailwind-config");
    expect(importTargetWithImportedTheme).toContain("cdn.tailwindcss.com");

    const themesResponse = await page.request.get("/api/platform/studio/themes");
    expect(themesResponse.ok()).toBe(true);
    const themesPayload = (await themesResponse.json()) as ThemesPayload;
    expect(themesPayload.ok).toBe(true);
    expect(themesPayload.source).toBe("strapi");
    expect(themesPayload.schemaSource).toBe("canonical");

    const createdTheme = (themesPayload.data ?? []).find((theme) => theme.status === "active");
    expect(createdTheme?.themeKey).toBeTruthy();
    const alternateTheme = (themesPayload.data ?? []).find((theme) => theme.id !== createdTheme?.id);
    expect(alternateTheme?.id).toBeTruthy();

    const [publishBlocksResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/blocks/publish")),
      page.getByTestId("import-publish-selected").click()
    ]);
    expect(publishBlocksResponse.ok()).toBe(true);

    await gotoStable(page, "/platform/onboarding/blocks");
    await expect(page.getByRole("heading", { name: "Reusable Blocks" })).toBeVisible();
    await searchImportedBlocks(page);
    const blocksPreviewWithImportedTheme = normalizeHtml(
      await page.locator("[data-testid^='blocks-item-preview-'] iframe").first().getAttribute("srcdoc")
    );
    expect(blocksPreviewWithImportedTheme).toContain("lmnas-preview-tailwind-config");
    expect(blocksPreviewWithImportedTheme).toContain("cdn.tailwindcss.com");

    await gotoStable(page, "/platform/onboarding/theme");
    await expect(page.getByRole("heading", { name: "Theme & Shell Studio" })).toBeVisible();
    await expect(page.getByText(createdTheme?.name ?? "")).toBeVisible();

    await page.getByTestId(`theme-card-${alternateTheme?.id}`).click();
    const [activateThemeResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/themes/activate")),
      page.getByTestId(`theme-activate-${alternateTheme?.id}`).click()
    ]);
    expect(activateThemeResponse.ok()).toBe(true);

    const themesAfterToggleResponse = await page.request.get("/api/platform/studio/themes");
    expect(themesAfterToggleResponse.ok()).toBe(true);
    const themesAfterToggle = (await themesAfterToggleResponse.json()) as ThemesPayload;
    expect(themesAfterToggle.ok).toBe(true);
    expect(themesAfterToggle.data?.find((theme) => theme.status === "active")?.themeKey).not.toBe(createdTheme?.themeKey);

    await processHtmlImport(page, html);
    const importTargetAfterToggle = normalizeHtml(await page.getByTestId("import-target-preview").getAttribute("srcdoc"));
    expect(importTargetAfterToggle).not.toBe(importTargetWithImportedTheme);

    await gotoStable(page, "/platform/onboarding/blocks");
    await searchImportedBlocks(page);
    const blocksPreviewAfterToggle = normalizeHtml(
      await page.locator("[data-testid^='blocks-item-preview-'] iframe").first().getAttribute("srcdoc")
    );
    expect(blocksPreviewAfterToggle).not.toBe(blocksPreviewWithImportedTheme);

    await page.getByTestId(`blocks-theme-swatch-${createdTheme?.id}`).click();
    await expect
      .poll(async () => normalizeHtml(await page.locator("[data-testid^='blocks-item-preview-'] iframe").first().getAttribute("srcdoc")))
      .not.toBe(blocksPreviewAfterToggle);

    await gotoStable(page, "/platform/onboarding/pages");
    await expect(page.getByRole("heading", { name: "Page Composer" })).toBeVisible();
    await expect
      .poll(async () => normalizeHtml(await page.getByTestId("pages-preview-frame").getAttribute("srcdoc")), {
        timeout: 15_000
      })
      .toContain("lmnas-preview-tailwind-config");
    const pagesPreview = normalizeHtml(await page.getByTestId("pages-preview-frame").getAttribute("srcdoc"));
    expect(pagesPreview).toContain("lmnas-preview-tailwind-config");
    expect(pagesPreview).toContain("cdn.tailwindcss.com");

    const pagesPreviewBeforeSwatchToggle = pagesPreview;
    await page.getByTestId(`pages-theme-swatch-${createdTheme?.id}`).click();
    await expect
      .poll(async () => normalizeHtml(await page.getByTestId("pages-preview-frame").getAttribute("srcdoc")))
      .not.toBe(pagesPreviewBeforeSwatchToggle);

    const blocksApiResponse = await page.request.get("/api/platform/studio/blocks?search=import-source");
    expect(blocksApiResponse.ok()).toBe(true);
    const blocksPayload = (await blocksApiResponse.json()) as BlocksPayload;
    expect(blocksPayload.ok).toBe(true);
    expect((blocksPayload.data ?? []).length).toBeGreaterThan(0);

    const shellsApiResponse = await page.request.get("/api/platform/studio/shells");
    expect(shellsApiResponse.ok()).toBe(true);
    const shellsPayload = (await shellsApiResponse.json()) as ShellsPayload;
    expect(shellsPayload.ok).toBe(true);

    const activeThemeAfterToggle = themesAfterToggle.data?.find((theme) => theme.status === "active");
    const activeShell = shellsPayload.data?.find((shell) => shell.status === "active") ?? shellsPayload.data?.[0];
    const publishPageSlug = `publish-e2e-${Date.now()}`;
    const publishPagePreview = [
      "<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body>",
      blocksPayload.data?.[0]?.targetPreviewHtml ?? blocksPayload.data?.[0]?.previewHtml ?? "<section><h1>Publish Preview</h1></section>",
      "</body></html>"
    ].join("");

    const createPageResponse = await page.request.post("/api/platform/studio/pages", {
      data: {
        mode: "save",
        page: {
          id: `page-${Date.now()}`,
          name: "E2E Publish Page",
          slug: publishPageSlug,
          locale: "en",
          themeId: activeThemeAfterToggle?.id,
          themeKey: activeThemeAfterToggle?.themeKey,
          shellKey: activeShell?.key,
          blockOrder: (blocksPayload.data ?? []).slice(0, 2).map((block) => block.id),
          productMapping: "lmnas-platform",
          industryMapping: ["enterprise"],
          primaryCta: { text: "Book Demo", url: "/contact" },
          conversionConfig: { trackConversions: true, strategy: "Track Conversions", valuePoints: 10 },
          campaignUtmStrategy: { source: "lmnas", medium: "studio", campaign: "publish-e2e" },
          taxonomyState: { valid: true, tags: ["import"] },
          seoMetadata: { metaTitle: "E2E Publish Page", metaDescription: "Canonical publish validation" },
          seoJsonLdValid: true,
          blockSchemaValid: true,
          previewValid: true,
          previewHtml: publishPagePreview
        }
      }
    });
    expect(createPageResponse.ok()).toBe(true);
    const createPagePayload = (await createPageResponse.json()) as PagesSavePayload;
    expect(createPagePayload.ok).toBe(true);
    const canonicalPublishPageId = createPagePayload.data?.page?.id ?? "";
    expect(canonicalPublishPageId).toBeTruthy();

    await gotoStable(page, "/platform/onboarding/publish");
    await expect(page.getByRole("heading", { name: "Publish Center" })).toBeVisible();
    await page.getByTestId("publish-governance-page").selectOption(canonicalPublishPageId);
    const productionPreview = normalizeHtml(await page.getByTestId("publish-production-preview").getAttribute("srcdoc"));
    const stagingPreview = normalizeHtml(await page.getByTestId("publish-staging-preview").getAttribute("srcdoc"));
    expect(stagingPreview).toContain("lmnas-preview-tailwind-config");
    expect(stagingPreview).toContain("cdn.tailwindcss.com");
    expect(stagingPreview).not.toBe(productionPreview);
    await page.getByTestId("publish-safety-toggle").click();
    await expect(page.getByTestId("publish-safety-lock")).toBeChecked();
    await expect(page.getByTestId("publish-live-button")).toBeEnabled();
    const [publishResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/publish")),
      page.getByTestId("publish-live-button").click()
    ]);
    expect(publishResponse.ok()).toBe(true);
    const publishPayload = (await publishResponse.json()) as PublishPayload;
    expect(publishPayload.ok).toBe(true);
    expect(publishPayload.data?.source).toBe("strapi");
    expect(publishPayload.data?.persistence?.source).toBe("strapi");
    expect(publishPayload.data?.persistence?.mutated).toBe(true);
    expect(publishPayload.data?.persistence?.pageId).toBeTruthy();
    expect((publishPayload.data?.warnings ?? []).some((warning) => warning.code === "publish.strapi_persist_failed")).toBe(false);
    await expect
      .poll(async () => normalizeHtml(await page.getByTestId("publish-production-preview").getAttribute("srcdoc")), {
        timeout: 15_000
      })
      .toContain("lmnas-preview-tailwind-config");
    const productionPreviewAfterPublish = normalizeHtml(await page.getByTestId("publish-production-preview").getAttribute("srcdoc"));
    expect(productionPreviewAfterPublish).toContain("cdn.tailwindcss.com");
    expect(productionPreviewAfterPublish).toContain("EUROGRID");
    expect(productionPreviewAfterPublish).not.toBe(productionPreview);
    expect(productionPreviewAfterPublish).toBe(stagingPreview);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "tv-e2e-10-theme-shell-import-toggle.png"),
      fullPage: true
    });

    await writeFile(
      path.join(EVIDENCE_DIR, "tv-e2e-10-theme-shell-import-toggle.json"),
      JSON.stringify(
        {
          createdTheme,
          alternateTheme,
          importTargetChanged: importTargetAfterToggle !== importTargetWithImportedTheme,
          blocksPreviewChanged: blocksPreviewAfterToggle !== blocksPreviewWithImportedTheme,
          publishPayload
        },
        null,
        2
      ),
      "utf8"
    );

    assertNoRuntimeErrors();
  });
});
