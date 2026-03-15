import { expect, test } from "playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const EVIDENCE_DIR = path.resolve(process.cwd(), "docs/phase0_1/proof/evidence/h009");
const HTML_FIXTURE_PATH = path.resolve(process.cwd(), "docs/testing-artifacts/code.html");

const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "tablet", width: 1024, height: 1366 },
  { label: "mobile", width: 390, height: 844 }
] as const;

type ProcessPayload = {
  ok: boolean;
  persistence?: {
    source?: "strapi" | "fallback";
    schemaSource?: "canonical" | "legacy" | "fallback";
    proposalsPersisted?: number;
    warnings?: string[];
    proposalBlocks?: Array<{ proposalId: string; blockKey: string }>;
    importMaster?: {
      id: string;
      importKey: string;
      status: string;
      selectedThemeKey: string;
      selectedShellKey: string;
      importMode: "blocks" | "page";
    };
  };
  error?: string;
};

type ImportFlowArtifacts = {
  processPayload: ProcessPayload;
  createdThemeKey?: string;
  targetPreviewChanged: boolean;
  activeThemeKeys: string[];
  importMasterSummary?: {
    sourceAssetBasesCount: number;
    stylesheets: number;
    scripts: number;
    media: number;
    hasThemeSummary: boolean;
  };
};

type BlocksPayload = {
  ok: boolean;
  source?: "strapi" | "fallback";
  schemaSource?: "canonical" | "legacy" | "fallback";
  data?: Array<{
    id: string;
    key: string;
    status?: string;
  }>;
};

type PagesPayload = {
  ok: boolean;
  source?: "strapi" | "fallback";
  data?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
};

type ThemesPayload = {
  ok: boolean;
  source?: "strapi" | "fallback";
  schemaSource?: "canonical" | "legacy" | "fallback";
  data?: Array<{
    id: string;
    themeKey: string;
    status: "active" | "inactive" | "draft";
    tokenCoverage?: number;
    tokens?: Array<{ key: string; value: string }>;
  }>;
};

function createRuntimeErrorGate(page: import("playwright/test").Page): () => void {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const ignorePatterns = [
    /favicon\.ico/i,
    /chrome-extension:\/\//i,
    /Blocked script execution in 'about:srcdoc'/i,
    /ERR_NAME_NOT_RESOLVED/i,
    /^Event$/i,
    /hydrated but some attributes of the server rendered HTML didn't match/i,
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

async function resetStudioState(page: import("playwright/test").Page): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await page.request.post("/api/platform/studio/reset");
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.ok).toBe(true);
    if (payload.source === "strapi") {
      return payload;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error("Studio reset did not return canonical Strapi source after retries.");
}

async function importHtmlFixtureAsBlocks(page: import("playwright/test").Page): Promise<ImportFlowArtifacts> {
  const html = await readFile(HTML_FIXTURE_PATH, "utf8");

  await page.goto("/platform/onboarding/import");
  await expect(page.getByRole("heading", { name: "Import Content" })).toBeVisible();

  await page.getByTestId("import-source-tab-html").click();
  await page.getByTestId("import-source-input").fill(html);

  const processResponsePromise = page.waitForResponse((response) => {
    return response.request().method() === "POST" && response.url().includes("/api/platform/studio/import/process");
  });

  await page.getByTestId("import-process-source").click();
  const processApiResponse = await processResponsePromise;
  const processPayload = (await processApiResponse.json()) as ProcessPayload;

  expect(processPayload.ok).toBe(true);
  expect(processPayload.persistence?.source).toBe("strapi");
  expect(processPayload.persistence?.schemaSource).toBe("canonical");
  expect(processPayload.persistence?.proposalsPersisted ?? 0).toBeGreaterThan(0);
  expect(processPayload.persistence?.warnings ?? []).toEqual([]);
  expect(processPayload.persistence?.importMaster?.id).toBeTruthy();
  expect(processPayload.persistence?.importMaster?.importKey).toBeTruthy();

  await expect(page.getByTestId("import-source-preview")).toBeVisible();
  await expect(page.getByTestId("import-target-preview")).toBeVisible();

  const targetPreviewBeforeThemeCreate = await page.getByTestId("import-target-preview").getAttribute("srcdoc");

  const firstProposalName = page.locator("[data-testid^='import-proposal-name-']").first();
  await expect(firstProposalName).toBeVisible();
  await firstProposalName.fill("Imported Hero Edited");
  await firstProposalName.blur();
  await expect(firstProposalName).toHaveValue("Imported Hero Edited");

  const createThemeResponsePromise = page.waitForResponse((response) => {
    return response.request().method() === "POST" && response.url().includes("/api/platform/studio/themes");
  });
  await page.getByTestId("import-create-theme-from-extraction").click();
  const createThemeResponse = await createThemeResponsePromise;
  expect(createThemeResponse.ok()).toBe(true);
  const createThemePayload = (await createThemeResponse.json()) as ThemesPayload;
  expect(createThemePayload.ok).toBe(true);
  expect(createThemePayload.source).toBe("strapi");
  expect(createThemePayload.schemaSource).toBe("canonical");

  await expect(page.getByText(/Created and applied extracted Theme Preset:/)).toBeVisible();
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, "tv-e2e-09-import-after-theme-extraction.png"),
    fullPage: true
  });

  const targetPreviewAfterThemeCreate = await page.getByTestId("import-target-preview").getAttribute("srcdoc");
  const targetPreviewChanged = (targetPreviewAfterThemeCreate ?? "") !== (targetPreviewBeforeThemeCreate ?? "");
  expect(targetPreviewChanged).toBe(true);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, "tv-e2e-09-import-source-target-compare.png"),
    fullPage: true
  });

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, "tv-e2e-09-import-after-process.png"),
    fullPage: true
  });

  const importMasterKey = processPayload.persistence?.importMaster?.importKey;
  let importMasterSummary: ImportFlowArtifacts["importMasterSummary"];
  if (importMasterKey) {
    const importMasterResponse = await page.request.get(`/api/platform/studio/import/masters?importKey=${encodeURIComponent(importMasterKey)}`);
    expect(importMasterResponse.ok()).toBe(true);
    const importMasterPayload = (await importMasterResponse.json()) as {
      ok: boolean;
      source?: "strapi" | "fallback";
      schemaSource?: "canonical" | "legacy" | "fallback";
      data?: Array<{
        importKey: string;
        id: string;
        sourceAssetBases?: string[];
        sourceAssetManifest?: {
          stylesheets?: unknown[];
          scripts?: unknown[];
          media?: unknown[];
        };
        sourceThemeCharacteristics?: Record<string, unknown>;
      }>;
    };
    expect(importMasterPayload.ok).toBe(true);
    expect(importMasterPayload.source).toBe("strapi");
    expect(importMasterPayload.schemaSource).toBe("canonical");
    expect((importMasterPayload.data ?? []).some((entry) => entry.importKey === importMasterKey)).toBe(true);
    const importMasterRecord = (importMasterPayload.data ?? []).find((entry) => entry.importKey === importMasterKey);
    expect((importMasterRecord?.sourceAssetBases?.length ?? 0)).toBeGreaterThan(0);
    const expectedSourceScript = Array.isArray(importMasterRecord?.sourceAssetManifest?.scripts)
      ? importMasterRecord?.sourceAssetManifest?.scripts.find((entry): entry is string => typeof entry === "string" && entry.length > 0)
      : undefined;
    if (expectedSourceScript) {
      const sourcePreviewSrcDoc = await page.getByTestId("import-source-preview").getAttribute("srcdoc");
      expect(sourcePreviewSrcDoc ?? "").toContain(expectedSourceScript);
    }
    importMasterSummary = {
      sourceAssetBasesCount: importMasterRecord?.sourceAssetBases?.length ?? 0,
      stylesheets: Array.isArray(importMasterRecord?.sourceAssetManifest?.stylesheets) ? importMasterRecord.sourceAssetManifest.stylesheets.length : 0,
      scripts: Array.isArray(importMasterRecord?.sourceAssetManifest?.scripts) ? importMasterRecord.sourceAssetManifest.scripts.length : 0,
      media: Array.isArray(importMasterRecord?.sourceAssetManifest?.media) ? importMasterRecord.sourceAssetManifest.media.length : 0,
      hasThemeSummary: Boolean(importMasterRecord?.sourceThemeCharacteristics)
    };
  }

  const themesResponse = await page.request.get("/api/platform/studio/themes");
  expect(themesResponse.ok()).toBe(true);
  const themesPayload = (await themesResponse.json()) as ThemesPayload;
  expect(themesPayload.ok).toBe(true);
  expect(themesPayload.source).toBe("strapi");
  expect(themesPayload.schemaSource).toBe("canonical");
  const activeThemeKeys = (themesPayload.data ?? []).filter((theme) => theme.status === "active").map((theme) => theme.themeKey);
  expect(activeThemeKeys).toHaveLength(1);
  const createdTheme = (themesPayload.data ?? []).find((theme) => !activeThemeKeys.includes("default") && theme.themeKey === activeThemeKeys[0]);

  const publishResponsePromise = page.waitForResponse((response) => {
    return response.request().method() === "POST" && response.url().includes("/api/platform/studio/blocks/publish");
  });

  await page.getByRole("button", { name: "As Blocks" }).click();
  await page.getByTestId("import-publish-selected").click();

  const publishResponse = await publishResponsePromise;
  expect(publishResponse.ok()).toBe(true);
  const publishPayload = (await publishResponse.json()) as {
    ok: boolean;
    source?: "strapi" | "fallback";
    result?: {
      applied: boolean;
    };
  };

  expect(publishPayload.ok).toBe(true);
  expect(publishPayload.source).toBe("strapi");
  expect(publishPayload.result?.applied).toBe(true);

  return {
    processPayload,
    createdThemeKey: createdTheme?.themeKey,
    targetPreviewChanged,
    activeThemeKeys,
    importMasterSummary
  };
}

function resolveBlockIdFromTestId(value: string | null): string {
  if (!value || !value.startsWith("blocks-item-")) {
    throw new Error(`Unable to resolve block id from test id: ${value ?? "<null>"}`);
  }
  return value.slice("blocks-item-".length);
}

test.describe("@real TV-E2E-09 blocks and pages hardening", () => {
  test.skip(
    process.env.LMNAS_E2E_REAL_STACK !== "1",
    "Run with LMNAS_E2E_REAL_STACK=1 and reachable canonical Strapi stack."
  );

  test("Blocks page is canonical-only with real preview + 3-dot actions across desktop/tablet/mobile", async ({ page }) => {
    await ensureEvidenceDir();
    const assertNoRuntimeErrors = createRuntimeErrorGate(page);
    const resetPayload = await resetStudioState(page);
    const importArtifacts = await importHtmlFixtureAsBlocks(page);
    const processPayload = importArtifacts.processPayload;
    const importMasterKey = processPayload.persistence?.importMaster?.importKey;

    const canonicalBlocksResponse = await page.request.get("/api/platform/studio/blocks?search=import-source");
    expect(canonicalBlocksResponse.ok()).toBe(true);
    const canonicalBlocks = (await canonicalBlocksResponse.json()) as BlocksPayload;
    expect(canonicalBlocks.ok).toBe(true);
    expect(canonicalBlocks.source).toBe("strapi");
    expect(canonicalBlocks.schemaSource).toBe("canonical");
    expect((canonicalBlocks.data ?? []).length).toBeGreaterThan(0);
    if (importMasterKey) {
      expect((canonicalBlocks.data ?? []).some((entry) => entry.key.includes("import-source"))).toBe(true);
    }

    let toggledActionResult: { status?: string; source?: string; schemaSource?: string } | null = null;
    let deletedBlockKey: string | null = null;

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/platform/onboarding/blocks");

      await expect(page.getByRole("heading", { name: "Reusable Blocks" })).toBeVisible();
      await expect(page.getByText(/requires canonical studio-blocks/i)).toHaveCount(0);

      const searchResponsePromise = page.waitForResponse((response) => {
        return response.request().method() === "GET" && response.url().includes("/api/platform/studio/blocks?search=import-source");
      });
      await page.getByTestId("blocks-search-input").fill("import-source");
      await page.getByTestId("blocks-search-input").press("Enter");
      await searchResponsePromise;

      const firstItem = page.locator("[data-testid^='blocks-item-']").first();
      await expect(firstItem).toBeVisible();

      const firstItemTestId = await firstItem.getAttribute("data-testid");
      const blockId = resolveBlockIdFromTestId(firstItemTestId);

      const thumb = page.getByTestId(`blocks-item-preview-${blockId}`);
      await expect(thumb).toBeVisible();
      await expect(thumb.locator("iframe").first()).toBeVisible();

      await page.getByTestId(`blocks-item-menu-${blockId}`).click();
      await expect(page.getByTestId(`blocks-menu-action-toggle-status-${blockId}`)).toBeVisible();
      await expect(page.getByTestId(`blocks-menu-action-duplicate-${blockId}`)).toBeVisible();
      await expect(page.getByTestId(`blocks-menu-action-delete-${blockId}`)).toBeVisible();

      if (viewport.label === "desktop") {
        const toggleResponsePromise = page.waitForResponse((response) => {
          return response.request().method() === "POST" && response.url().includes("/api/platform/studio/blocks");
        });
        await page.getByTestId(`blocks-menu-action-toggle-status-${blockId}`).click();
        const toggleResponse = await toggleResponsePromise;
        expect(toggleResponse.ok()).toBe(true);
        const togglePayload = (await toggleResponse.json()) as BlocksPayload;
        expect(togglePayload.ok).toBe(true);
        expect(togglePayload.source).toBe("strapi");
        expect(togglePayload.schemaSource).toBe("canonical");

        const toggledBlock = (togglePayload.data ?? []).find((entry) => entry.id === blockId || entry.key === blockId);
        toggledActionResult = {
          status: toggledBlock?.status,
          source: togglePayload.source,
          schemaSource: togglePayload.schemaSource
        };

        await expect(page.getByText(/is now active\.|is now inactive\./)).toBeVisible();

        const postToggleItem = page.locator("[data-testid^='blocks-item-']").first();
        await expect(postToggleItem).toBeVisible();
        const duplicateResponsePromise = page.waitForResponse((response) => {
          return response.request().method() === "POST" && response.url().includes("/api/platform/studio/blocks");
        });
        await page.getByRole("button", { name: /New Block/i }).click();
        const duplicateResponse = await duplicateResponsePromise;
        expect(duplicateResponse.ok()).toBe(true);
        const duplicatePayload = (await duplicateResponse.json()) as BlocksPayload;
        expect(duplicatePayload.ok).toBe(true);
        expect(duplicatePayload.source).toBe("strapi");
        expect(duplicatePayload.schemaSource).toBe("canonical");
        const duplicatedBlock = (duplicatePayload.data ?? []).find((entry) => entry.key.includes("-copy-"));
        expect(duplicatedBlock?.key).toBeTruthy();
        deletedBlockKey = duplicatedBlock?.key ?? null;

        if (deletedBlockKey) {
          const deleteKey = deletedBlockKey;
          const duplicateSearchResponsePromise = page.waitForResponse((response) => {
            return response.request().method() === "GET" && response.url().includes(`/api/platform/studio/blocks?search=${encodeURIComponent(deleteKey)}`);
          });
          await page.getByTestId("blocks-search-input").fill(deleteKey);
          await page.getByTestId("blocks-search-input").press("Enter");
          await duplicateSearchResponsePromise;

          const duplicateRow = page.locator("[data-testid^='blocks-item-']").first();
          await expect(duplicateRow).toBeVisible();
          const duplicateRowTestId = await duplicateRow.getAttribute("data-testid");
          const duplicateRowId = resolveBlockIdFromTestId(duplicateRowTestId);
          await page.getByTestId(`blocks-item-menu-${duplicateRowId}`).click();
          const deleteResponsePromise = page.waitForResponse((response) => {
            return response.request().method() === "DELETE" && response.url().includes(`/api/platform/studio/blocks?key=${encodeURIComponent(deleteKey)}`);
          });
          await page.getByTestId(`blocks-menu-action-delete-${duplicateRowId}`).click();
          const deleteResponse = await deleteResponsePromise;
          expect(deleteResponse.ok()).toBe(true);
          const deletePayload = (await deleteResponse.json()) as BlocksPayload;
          expect(deletePayload.ok).toBe(true);
          expect(deletePayload.source).toBe("strapi");
          expect(deletePayload.schemaSource).toBe("canonical");
          expect((deletePayload.data ?? []).some((entry) => entry.key === deleteKey)).toBe(false);
          await expect(page.getByText(/Deleted .*?\./)).toBeVisible();

          await page.screenshot({
            path: path.join(EVIDENCE_DIR, "tv-e2e-09-blocks-after-delete.png"),
            fullPage: true
          });
        }
      }

      await page.screenshot({
        path: path.join(EVIDENCE_DIR, `tv-e2e-09-blocks-${viewport.label}.png`),
        fullPage: true
      });
    }

    if (deletedBlockKey) {
      await page.reload();
      await expect(page.getByRole("heading", { name: "Reusable Blocks" })).toBeVisible();
      const postReloadResponse = await page.request.get(`/api/platform/studio/blocks?search=${encodeURIComponent(deletedBlockKey)}`);
      expect(postReloadResponse.ok()).toBe(true);
      const postReloadPayload = (await postReloadResponse.json()) as BlocksPayload;
      expect(postReloadPayload.ok).toBe(true);
      expect((postReloadPayload.data ?? []).some((entry) => entry.key === deletedBlockKey)).toBe(false);
    }

    await writeFile(
      path.join(EVIDENCE_DIR, "tv-e2e-09-blocks-log.json"),
      JSON.stringify(
        {
          resetPayload,
          processPayload,
          importArtifacts,
          importMasterKey,
          canonicalBlocksCount: canonicalBlocks.data?.length ?? 0,
          canonicalBlockKeys: (canonicalBlocks.data ?? []).map((entry) => entry.key),
          toggleActionResult: toggledActionResult,
          deletedBlockKey,
          viewportCoverage: VIEWPORTS
        },
        null,
        2
      ),
      "utf8"
    );

    assertNoRuntimeErrors();
  });

  test("Pages standard/focus/full-screen remain wired with selected-page context across desktop/tablet/mobile", async ({ page }) => {
    await ensureEvidenceDir();
    const assertNoRuntimeErrors = createRuntimeErrorGate(page);
    const resetPayload = await resetStudioState(page);

    const pagesApiResponse = await page.request.get("/api/platform/studio/pages");
    expect(pagesApiResponse.ok()).toBe(true);
    const pagesPayload = (await pagesApiResponse.json()) as PagesPayload;
    expect(pagesPayload.ok).toBe(true);
    expect(pagesPayload.source).toBe("strapi");
    expect((pagesPayload.data ?? []).length).toBeGreaterThan(0);

    const perViewportChecks: Array<{ viewport: string; selectedPageId: string }> = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/platform/onboarding/pages");

      await expect(page.getByTestId("pages-standard-root")).toBeVisible();
      await expect(page.getByTestId("pages-standard-left-panel")).toBeVisible();
      await expect(page.getByTestId("pages-standard-canvas")).toBeVisible();
      await expect(page.getByTestId("pages-standard-inspector")).toBeVisible();

      const firstPageItem = page.locator("[data-testid^='pages-item-']").first();
      await expect(firstPageItem).toBeVisible();
      const firstPageItemTestId = await firstPageItem.getAttribute("data-testid");
      const selectedPageId = firstPageItemTestId?.slice("pages-item-".length) ?? "";
      expect(selectedPageId.length).toBeGreaterThan(0);

      await firstPageItem.click();
      await expect(page.getByTestId("pages-preview-frame")).toBeVisible();

      const draftSrcDoc = await page.getByTestId("pages-preview-frame").getAttribute("srcdoc");
      if (viewport.label === "desktop") {
        const applyResponsePromise = page.waitForResponse((response) => {
          return response.request().method() === "POST" && response.url().includes("/api/platform/studio/pages");
        });
        await page.getByTestId("pages-preview-page-button").click();
        const applyResponse = await applyResponsePromise;
        expect(applyResponse.ok()).toBe(true);
      }
      await page.getByRole("button", { name: "Production" }).click();
      const productionSrcDoc = await page.getByTestId("pages-preview-frame").getAttribute("srcdoc");
      expect(draftSrcDoc).toBeTruthy();
      expect(productionSrcDoc).toBeTruthy();
      expect(productionSrcDoc).toContain("body");

      await page.screenshot({
        path: path.join(EVIDENCE_DIR, `tv-e2e-09-pages-${viewport.label}-standard.png`),
        fullPage: true
      });

      await page.getByTestId("pages-enter-focus-mode").click();
      const focusRoot = page.getByTestId("pages-focus-mode-root");
      if (!(await focusRoot.isVisible().catch(() => false))) {
        await page.getByTestId("pages-enter-focus-mode").click({ force: true });
      }
      await expect(focusRoot).toBeVisible();
      await expect(page.getByTestId("pages-focus-canvas")).toBeVisible();
      await expect(page.getByTestId("pages-focus-left-panel")).toBeVisible();

      await expect(
        page
          .getByTestId("pages-focus-left-panel")
          .locator(`[data-testid='pages-item-${selectedPageId}'][data-active='true']`)
      ).toBeVisible();

      if (viewport.label === "desktop") {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, "tv-e2e-09-pages-focus.png"),
          fullPage: true
        });
      }

      await page.getByTestId("pages-focus-toggle-panels").click();
      await expect(page.getByTestId("pages-focus-left-panel")).toHaveCount(0);
      await page.getByTestId("pages-focus-toggle-panels").click();
      await expect(page.getByTestId("pages-focus-left-panel")).toBeVisible();

      await page.getByTestId("pages-exit-focus-mode").click();
      await expect(page.getByTestId("pages-standard-root")).toBeVisible();

      await page.getByTestId("pages-enter-fullscreen-mode").click();
      await expect(page.getByTestId("pages-fullscreen-mode-root")).toBeVisible();
      await expect(page.getByTestId("pages-fullscreen-preview")).toBeVisible();

      if (viewport.label === "desktop") {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, "tv-e2e-09-pages-fullscreen.png"),
          fullPage: true
        });
      }

      await page.getByTestId("pages-exit-fullscreen-mode").click();
      await expect(page.getByTestId("pages-standard-root")).toBeVisible();
      await expect(
        page
          .getByTestId("pages-standard-left-panel")
          .locator(`[data-testid='pages-item-${selectedPageId}'][data-active='true']`)
      ).toBeVisible();

      perViewportChecks.push({ viewport: viewport.label, selectedPageId });
    }

    await writeFile(
      path.join(EVIDENCE_DIR, "tv-e2e-09-pages-log.json"),
      JSON.stringify(
        {
          resetPayload,
          source: pagesPayload.source,
          pagesCount: pagesPayload.data?.length ?? 0,
          perViewportChecks,
          viewportCoverage: VIEWPORTS
        },
        null,
        2
      ),
      "utf8"
    );

    assertNoRuntimeErrors();
  });

  test("Import as page creates canonical studio-page and updates import master status", async ({ page }) => {
    await ensureEvidenceDir();
    const assertNoRuntimeErrors = createRuntimeErrorGate(page);
    await resetStudioState(page);
    const html = await readFile(HTML_FIXTURE_PATH, "utf8");

    await page.goto("/platform/onboarding/import");
    await expect(page.getByRole("heading", { name: "Import Content" })).toBeVisible();
    await page.getByTestId("import-source-tab-html").click();
    await page.getByTestId("import-source-input").fill(html);

    const processResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === "POST" && response.url().includes("/api/platform/studio/import/process");
    });
    await page.getByTestId("import-process-source").click();
    const processResponse = await processResponsePromise;
    const processPayload = (await processResponse.json()) as ProcessPayload;
    expect(processPayload.ok).toBe(true);
    expect(processPayload.persistence?.source).toBe("strapi");
    expect(processPayload.persistence?.importMaster?.id).toBeTruthy();
    const importMasterKey = processPayload.persistence?.importMaster?.importKey;

    await page.getByTestId("import-mode-page").click();

    const publishResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === "POST" && response.url().includes("/api/platform/studio/blocks/publish");
    });
    const pageSaveResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === "POST" && response.url().includes("/api/platform/studio/pages");
    });
    await page.getByTestId("import-publish-selected").click();
    const publishResponse = await publishResponsePromise;
    const pageSaveResponse = await pageSaveResponsePromise;
    expect(publishResponse.ok()).toBe(true);
    expect(pageSaveResponse.ok()).toBe(true);
    const pageSavePayload = (await pageSaveResponse.json()) as {
      ok: boolean;
      source?: "strapi" | "fallback";
      data?: {
        page?: { slug?: string; blockOrder?: string[]; importMasterId?: string };
      };
    };
    expect(pageSavePayload.ok).toBe(true);
    expect(pageSavePayload.source).toBe("strapi");
    expect(pageSavePayload.data?.page?.slug?.startsWith("import-")).toBe(true);
    expect((pageSavePayload.data?.page?.blockOrder ?? []).length).toBeGreaterThan(0);
    await expect(page.getByText(/Draft page created:/)).toBeVisible();

    const pagesResponse = await page.request.get("/api/platform/studio/pages");
    expect(pagesResponse.ok()).toBe(true);
    const pagesPayload = (await pagesResponse.json()) as {
      ok: boolean;
      source?: "strapi" | "fallback";
      data?: Array<{ id: string; slug: string; blockOrder: string[]; themeKey?: string }>;
    };
    expect(pagesPayload.ok).toBe(true);
    expect(pagesPayload.source).toBe("strapi");
    expect((pagesPayload.data ?? []).some((entry) => entry.slug.startsWith("import-") && entry.blockOrder.length > 0)).toBe(true);

    if (importMasterKey) {
      const importMasterResponse = await page.request.get(`/api/platform/studio/import/masters?importKey=${encodeURIComponent(importMasterKey)}`);
      expect(importMasterResponse.ok()).toBe(true);
      const importMasterPayload = (await importMasterResponse.json()) as {
        ok: boolean;
        data?: Array<{ status: string; importKey: string }>;
      };
      expect(importMasterPayload.ok).toBe(true);
      expect((importMasterPayload.data ?? []).some((entry) => entry.importKey === importMasterKey && entry.status === "imported_page")).toBe(true);

      await writeFile(
        path.join(EVIDENCE_DIR, "tv-e2e-09-import-page-log.json"),
        JSON.stringify(
          {
            processPayload,
            pageSavePayload,
            importMasterPayload,
            pagesCount: pagesPayload.data?.length ?? 0,
            importedPageSlugs: (pagesPayload.data ?? []).map((entry) => entry.slug)
          },
          null,
          2
        ),
        "utf8"
      );
    }

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "tv-e2e-09-import-as-page.png"),
      fullPage: true
    });

    assertNoRuntimeErrors();
  });
});
