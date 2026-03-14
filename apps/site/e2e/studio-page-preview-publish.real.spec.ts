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

function extractBodyInnerHtml(input: string | null): string {
  const match = (input ?? "").match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return normalizeHtml(match?.[1] ?? "");
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

async function processHtmlImport(page: import("playwright/test").Page, html: string): Promise<string[]> {
  const response = await page.request.post("/api/platform/studio/pages", {
    data: {
      mode: "import-blocks",
      sourceRef: "docs/testing-artifacts/code.html",
      html
    }
  });
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as {
    ok: boolean;
    source?: string;
    data?: {
      blockCount?: number;
      importedBlocks?: Array<{ key: string }>;
    };
  };
  expect(payload.ok).toBe(true);
  expect(payload.source).toBe("strapi");
  expect(payload.data?.blockCount).toBeGreaterThan(0);
  return (payload.data?.importedBlocks ?? []).map((entry) => entry.key).filter((entry) => entry.trim().length > 0);
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

  test("html import drives draft preview separately from production until publish center applies canonical live publish", async ({ page, browser }) => {
    await ensureEvidenceDir();
    const assertNoRuntimeErrors = createRuntimeErrorGate(page);
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    const assertNoPublicRuntimeErrors = createRuntimeErrorGate(publicPage);
    const html = await readFile(HTML_FIXTURE_PATH, "utf8");

    try {
      await resetStudioState(page);
      const importedBlockKeys = await processHtmlImport(page, html);
      expect(importedBlockKeys.length).toBeGreaterThan(0);

      const blocksPayload = await fetchJson<BlocksPayload>(page, "/api/platform/studio/blocks");
      const importedBlocks = (blocksPayload.data ?? []).filter((entry) => importedBlockKeys.includes(entry.key));
      const block = importedBlocks[0];
      const secondBlock = importedBlocks[1] ?? block;
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
      const reimportedBlockKeys = await processHtmlImport(page, html);
      expect([...reimportedBlockKeys].sort()).toEqual([...importedBlockKeys].sort());

      await gotoStable(page, "/platform/onboarding/pages");
      await expect(page.getByRole("heading", { name: "Page Composer" })).toBeVisible();
      await page.getByTestId(`pages-item-${canonicalPageId}`).click();
      await expect
        .poll(async () => normalizeHtml(await page.getByTestId("pages-preview-frame").getAttribute("srcdoc")), { timeout: 15_000 })
        .toContain("EUROGRID");
      await expect(page.getByTestId("pages-canvas-block-0")).not.toContainText("Preview unavailable for this block.");
      const canvasBlockPreview = normalizeHtml(await page.getByTestId("pages-canvas-block-0").locator("iframe").getAttribute("srcdoc"));
      expect(canvasBlockPreview).toContain("lmnas-preview-tailwind-config");
      expect(canvasBlockPreview).toContain("EUROGRID");

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
        .toContain("EUROGRID");
      const [acceptPreviewResponse] = await Promise.all([
        previewPopup.waitForResponse(
          (response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/pages")
        ),
        previewPopup.getByTestId("preview-accept-button").click()
      ]);
      expect(acceptPreviewResponse.ok()).toBe(true);
      await expect(previewPopup.getByTestId("preview-accept-button")).toContainText("Preview Accepted");
      const initialPreviewPopupDoc = normalizeHtml(await previewPopup.locator("iframe[title='studio-page-preview']").getAttribute("srcdoc"));
      expect(initialPreviewPopupDoc).toContain("lmnas-preview-tailwind-config");
      expect(initialPreviewPopupDoc).toContain("/studio-runtime.css");
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
      expect(stagingBeforePublish).toContain("EUROGRID");
      expect(initialPreviewPopupDoc).toContain("EUROGRID");
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
      await page.getByTestId("pages-add-block-select").selectOption(secondBlock?.key ?? block?.key ?? "");
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
      expect(popupAfterEdit).toContain("EUROGRID");
      expect(popupAfterEdit).toContain("lmnas-preview-tailwind-config");
      expect(publishRequestCount).toBe(1);

      await page.getByRole("button", { name: "Production", exact: true }).click();
      await expect
        .poll(async () => extractBodyInnerHtml(await page.getByTestId("pages-preview-frame").getAttribute("srcdoc")))
        .toBe(extractBodyInnerHtml(productionAfterPublish));

      await gotoStable(page, "/platform/onboarding/publish");
      await page.getByTestId("publish-governance-page").selectOption(canonicalPageId);
      await expect
        .poll(async () => normalizeHtml(await page.getByTestId("publish-staging-preview").getAttribute("srcdoc")), { timeout: 15_000 })
        .not.toBe(productionAfterPublish);
      const stagingAfterEdit = normalizeHtml(await page.getByTestId("publish-staging-preview").getAttribute("srcdoc"));
      expect(extractBodyInnerHtml(stagingAfterEdit)).toBe(extractBodyInnerHtml(draftPreviewAfterEdit));
      expect(extractBodyInnerHtml(await page.getByTestId("publish-production-preview").getAttribute("srcdoc"))).toBe(
        extractBodyInnerHtml(productionAfterPublish)
      );

      const publishedAfterDraftEdit = await fetchJson<PagesPayload>(page, "/api/platform/studio/pages?status=published");
      const publishedRecord = Array.isArray(publishedAfterDraftEdit.data)
        ? publishedAfterDraftEdit.data.find((entry) => entry.slug === slug)
        : null;
      expect(extractBodyInnerHtml(publishedRecord?.previewHtml ?? "")).toBe(extractBodyInnerHtml(productionAfterPublish));

      await expect
        .poll(
          async () => {
            const response = await publicPage.request.get(`/en/${slug}`);
            return await response.text();
          },
          { timeout: 30_000 }
        )
        .toContain('data-studio-runtime="governed"');
      await expect
        .poll(
          async () => {
            const response = await publicPage.request.get(`/en/${slug}`);
            return await response.text();
          },
          { timeout: 30_000 }
        )
        .not.toContain("Studio page is blocked");

      await gotoStable(publicPage, `/en/${slug}`);
      await expect(publicPage.getByTestId("studio-runtime-page")).toBeVisible();
      await expect(publicPage.locator("[data-studio-runtime='governed']")).toBeVisible();
      await expect(publicPage.getByTestId("studio-runtime-page")).toContainText("EUROGRID");
      await expect(publicPage.getByTestId("studio-runtime-page")).not.toContainText("Trusted by European transformer manufacturers");

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
      assertNoPublicRuntimeErrors();
    } finally {
      await publicContext.close();
    }
  });
});
