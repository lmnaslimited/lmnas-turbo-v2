import { expect, test } from "playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const HTML_FIXTURE_PATH = path.resolve(process.cwd(), "docs/testing-artifacts/code.html");
const EVIDENCE_DIR = path.resolve(process.cwd(), "docs/phase0_1/proof/evidence/h011");

type BlocksPayload = {
  ok: boolean;
  data?: Array<{
    id: string;
    key: string;
    name: string;
    targetPreviewHtml?: string;
    previewHtml?: string;
  }>;
};

type ThemesPayload = {
  ok: boolean;
  data?: Array<{
    id: string;
    themeKey: string;
    name: string;
    status: "active" | "inactive" | "draft";
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

type PagesPayload = {
  ok: boolean;
  data?: Array<{
    id: string;
    slug: string;
    name: string;
    previewHtml?: string;
    status?: string;
  }> | {
    id: string;
    slug: string;
    name: string;
    previewHtml?: string;
    status?: string;
  } | null;
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
    const payload = (await response.json()) as { ok?: boolean; source?: string };
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
  await page.getByTestId("import-source-tab-html").click({ force: true });
  await page.getByTestId("import-source-input").fill(html);

  const [processResponse] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/import/process")),
    page.getByTestId("import-process-source").click()
  ]);

  expect(processResponse.ok()).toBe(true);
  await expect(page.getByTestId("import-target-preview")).toBeVisible();

  const [publishBlocksResponse] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/blocks/publish")),
    page.getByTestId("import-publish-selected").click()
  ]);
  expect(publishBlocksResponse.ok()).toBe(true);
}

async function fetchJson<T>(page: import("playwright/test").Page, href: string): Promise<T> {
  const response = await page.request.get(href);
  expect(response.ok()).toBe(true);
  return (await response.json()) as T;
}

test.describe("@real page preview publish flow", () => {
  test.skip(
    process.env.LMNAS_E2E_REAL_STACK !== "1",
    "Run with LMNAS_E2E_REAL_STACK=1 and reachable canonical Strapi stack."
  );

  test("html import drives draft preview separately from production until publish center applies canonical live publish", async ({ page }) => {
    await ensureEvidenceDir();
    const assertNoRuntimeErrors = createRuntimeErrorGate(page);
    const html = await readFile(HTML_FIXTURE_PATH, "utf8");

    await resetStudioState(page);
    await processHtmlImport(page, html);

    const blocksPayload = await fetchJson<BlocksPayload>(page, "/api/platform/studio/blocks?search=import-source");
    const block = (blocksPayload.data ?? [])[0];
    const secondBlock = (blocksPayload.data ?? [])[1] ?? block;
    expect(block?.id).toBeTruthy();
    expect(secondBlock?.id).toBeTruthy();

    const themesPayload = await fetchJson<ThemesPayload>(page, "/api/platform/studio/themes");
    const activeTheme = (themesPayload.data ?? []).find((theme) => theme.status === "active") ?? themesPayload.data?.[0];
    expect(activeTheme?.themeKey).toBeTruthy();

    const shellsPayload = await fetchJson<ShellsPayload>(page, "/api/platform/studio/shells");
    const activeShell = (shellsPayload.data ?? []).find((shell) => shell.status === "active") ?? shellsPayload.data?.[0];
    expect(activeShell?.key).toBeTruthy();

    const pageId = `page-${Date.now()}`;
    const slug = `page-preview-publish-${Date.now()}`;

    const createDraftResponse = await page.request.post("/api/platform/studio/pages", {
      data: {
        mode: "save",
        page: {
          id: pageId,
          name: "E2E Page Preview Publish",
          slug,
          locale: "en",
          themeKey: activeTheme?.themeKey,
          shellKey: activeShell?.key,
          blockOrder: [block?.id],
          fieldValues: {},
          actionOverrides: {},
          productMapping: "lmnas-platform",
          industryMapping: ["enterprise"],
          primaryCta: { text: "Book Demo", url: "/contact" },
          conversionConfig: { trackConversions: true, strategy: "Track Conversions", valuePoints: 10 },
          campaignUtmStrategy: { source: "lmnas", medium: "studio", campaign: "page-preview-publish" },
          taxonomyState: { valid: true, tags: ["import"] },
          seoMetadata: { metaTitle: "Draft production split test", metaDescription: "Draft production split test" },
          seoJsonLdValid: true,
          blockSchemaValid: true,
          previewValid: true,
          previewHtml: ""
        }
      }
    });
    const createDraftResponseText = await createDraftResponse.text();
    expect(createDraftResponse.ok(), createDraftResponseText).toBe(true);
    const savedDraftPages = await fetchJson<PagesPayload>(page, "/api/platform/studio/pages?status=draft");
    const savedDraftPage = Array.isArray(savedDraftPages.data) ? savedDraftPages.data.find((entry) => entry.slug === slug) : null;
    expect(savedDraftPage?.id).toBeTruthy();
    const canonicalPageId = savedDraftPage?.id ?? pageId;

    await gotoStable(page, "/platform/onboarding/pages");
    await expect(page.getByRole("heading", { name: "Page Composer" })).toBeVisible();
    await page.getByTestId(`pages-item-${canonicalPageId}`).click();

    let publishRequestCount = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/platform/studio/publish")) {
        publishRequestCount += 1;
      }
    });

    const [previewSaveResponse, previewPopup] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/pages")),
      page.waitForEvent("popup"),
      page.getByTestId("pages-preview-page-button").click()
    ]);
    expect(previewSaveResponse.ok()).toBe(true);
    const previewSavePayload = (await previewSaveResponse.json()) as {
      ok: boolean;
      source?: string;
      data?: { applied?: boolean; previewRoute?: string };
    };
    expect(previewSavePayload.ok).toBe(true);
    expect(previewSavePayload.source).toBe("strapi");
    expect(previewSavePayload.data?.applied).toBe(false);
    expect(previewSavePayload.data?.previewRoute).toContain("/api/preview?");

    await previewPopup.waitForLoadState("domcontentloaded");
    await expect(previewPopup.locator("iframe[title='studio-page-preview']")).toBeVisible();
    await expect
      .poll(async () => normalizeHtml(await previewPopup.locator("iframe[title='studio-page-preview']").getAttribute("srcdoc")))
      .toContain("lmnas-preview-tailwind-config");
    const initialPreviewPopupDoc = normalizeHtml(await previewPopup.locator("iframe[title='studio-page-preview']").getAttribute("srcdoc"));
    expect(publishRequestCount).toBe(0);

    const publishedBeforePreview = await fetchJson<PagesPayload>(page, "/api/platform/studio/pages?status=published");
    expect(Array.isArray(publishedBeforePreview.data) ? publishedBeforePreview.data.find((entry) => entry.slug === slug) : null).toBeUndefined();

    await page.getByRole("button", { name: "Production", exact: true }).click();
    await expect
      .poll(async () => normalizeHtml(await page.getByTestId("pages-preview-frame").getAttribute("srcdoc")))
      .toContain("No published version");
    await page.getByRole("button", { name: "Draft", exact: true }).click();

    await gotoStable(page, "/platform/onboarding/publish");
    await expect(page.getByRole("heading", { name: "Publish Center" })).toBeVisible();
    await page.getByTestId("publish-governance-page").selectOption(canonicalPageId);
    const stagingBeforePublish = normalizeHtml(await page.getByTestId("publish-staging-preview").getAttribute("srcdoc"));
    expect(stagingBeforePublish).toContain("lmnas-preview-tailwind-config");
    expect(stagingBeforePublish).toBe(initialPreviewPopupDoc);
    await expect
      .poll(async () => normalizeHtml(await page.getByTestId("publish-production-preview").getAttribute("srcdoc")))
      .toContain("No published version");

    await page.getByTestId("publish-safety-toggle").click();
    const [publishResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/publish")),
      page.getByTestId("publish-live-button").click()
    ]);
    expect(publishResponse.ok()).toBe(true);

    await expect
      .poll(async () => normalizeHtml(await page.getByTestId("publish-production-preview").getAttribute("srcdoc")), { timeout: 15_000 })
      .not.toContain("No published version");
    const productionAfterPublish = normalizeHtml(await page.getByTestId("publish-production-preview").getAttribute("srcdoc"));
    expect(productionAfterPublish).toBe(stagingBeforePublish);

    await gotoStable(page, "/platform/onboarding/pages");
    await page.getByTestId(`pages-item-${canonicalPageId}`).click();
    await page.getByTestId("pages-add-block-select").selectOption(secondBlock?.id ?? block?.id ?? "");
    await page.getByTestId("pages-add-block-button").click();
    const [saveDraftResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/pages")),
      page.getByRole("button", { name: "Save Draft" }).click()
    ]);
    expect(saveDraftResponse.ok()).toBe(true);
    await expect
      .poll(async () => normalizeHtml(await page.getByTestId("pages-preview-frame").getAttribute("srcdoc")), { timeout: 15_000 })
      .not.toBe(productionAfterPublish);
    const draftPreviewAfterEdit = normalizeHtml(await page.getByTestId("pages-preview-frame").getAttribute("srcdoc"));

    const [draftPreviewResponse, draftPreviewPopup] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/pages")),
      page.waitForEvent("popup"),
      page.getByTestId("pages-preview-page-button").click()
    ]);
    expect(draftPreviewResponse.ok()).toBe(true);
    await draftPreviewPopup.waitForLoadState("domcontentloaded");
    const popupAfterEdit = normalizeHtml(await draftPreviewPopup.locator("iframe[title='studio-page-preview']").getAttribute("srcdoc"));
    expect(popupAfterEdit).toBe(draftPreviewAfterEdit);
    expect(publishRequestCount).toBe(1);

    await page.getByRole("button", { name: "Production", exact: true }).click();
    await expect
      .poll(async () => normalizeHtml(await page.getByTestId("pages-preview-frame").getAttribute("srcdoc")))
      .toBe(productionAfterPublish);

    await gotoStable(page, "/platform/onboarding/publish");
    await page.getByTestId("publish-governance-page").selectOption(canonicalPageId);
    await expect
      .poll(async () => normalizeHtml(await page.getByTestId("publish-staging-preview").getAttribute("srcdoc")), { timeout: 15_000 })
      .not.toBe(productionAfterPublish);
    const stagingAfterEdit = normalizeHtml(await page.getByTestId("publish-staging-preview").getAttribute("srcdoc"));
    expect(stagingAfterEdit).toBe(draftPreviewAfterEdit);
    expect(normalizeHtml(await page.getByTestId("publish-production-preview").getAttribute("srcdoc"))).toBe(productionAfterPublish);

    const publishedAfterDraftEdit = await fetchJson<PagesPayload>(page, "/api/platform/studio/pages?status=published");
    const publishedRecord = Array.isArray(publishedAfterDraftEdit.data)
      ? publishedAfterDraftEdit.data.find((entry) => entry.slug === slug)
      : null;
    expect(normalizeHtml(publishedRecord?.previewHtml ?? "")).toBe(productionAfterPublish);

    await gotoStable(page, `/en/${slug}`);
    await expect(page.getByText("Trusted by European transformer manufacturers")).toBeVisible();
    await expect(page.getByTestId("studio-runtime-page")).toBeVisible();

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "tv-e2e-11-page-preview-publish.png"),
      fullPage: true
    });

    await writeFile(
      path.join(EVIDENCE_DIR, "tv-e2e-11-page-preview-publish.json"),
      JSON.stringify(
        {
          pageId,
          canonicalPageId,
          slug,
          publishRequestCount,
          stagingBeforePublish,
          productionAfterPublish,
          draftPreviewAfterEdit
        },
        null,
        2
      ),
      "utf8"
    );

    assertNoRuntimeErrors();
  });
});
