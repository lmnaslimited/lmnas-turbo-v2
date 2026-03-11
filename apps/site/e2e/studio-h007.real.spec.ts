import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

const evidenceDir = path.resolve(process.cwd(), "docs/phase0_1/proof/evidence/h007");
const SOURCE_REF = "docs/testing-artifacts/code.html";
const LOCAL_HEADLINE = "H007 Local Page Headline";
const REUSABLE_HEADING = "H007 Reusable Block Heading";
const ACTION_TRIGGER_LABEL = "Hero CTA Button";
const ACTION_TARGET = "widget-calendar-booking";

type PageSnapshot = {
  id: string;
  name: string;
  slug: string;
  blockOrder?: string[];
  fieldValues?: Record<string, unknown>;
  actionOverrides?: Record<string, unknown>;
  activeShellId?: string;
  updatedAt?: string;
};

type BlockSnapshot = {
  id: string;
  key: string;
  name: string;
  previewHtml?: string;
  updatedAt?: string;
};

type WidgetSnapshot = {
  id: string;
  key: string;
  name: string;
  repoPath: string;
  placement?: {
    mode: "embed" | "reference";
    pageId?: string;
    blockId?: string;
  };
};

type ThemeSnapshot = {
  id: string;
  themeKey: string;
  name: string;
  status: string;
  updatedAt?: string;
};

type ShellSnapshot = {
  id: string;
  key: string;
  name: string;
  status: string;
  updatedAt?: string;
};

type StudioSnapshot = {
  pages: PageSnapshot[];
  blocks: BlockSnapshot[];
  widgets: WidgetSnapshot[];
  themes: ThemeSnapshot[];
  shells: ShellSnapshot[];
};

function ensureEvidenceDir(): void {
  mkdirSync(evidenceDir, { recursive: true });
}

function writeJsonEvidence(fileName: string, payload: unknown): void {
  ensureEvidenceDir();
  writeFileSync(path.join(evidenceDir, fileName), JSON.stringify(payload, null, 2), "utf8");
}

async function resetStudioState(page: import("playwright/test").Page): Promise<void> {
  const response = await page.request.post("/api/platform/studio/reset");
  expect(response.ok()).toBe(true);
}

async function selectFirstNonEmptyOption(page: import("playwright/test").Page, testId: string): Promise<string> {
  const value = await page.getByTestId(testId).evaluate((element) => {
    if (!(element instanceof HTMLSelectElement)) {
      return "";
    }
    const option = Array.from(element.options).find((entry) => entry.value.trim().length > 0);
    return option?.value ?? "";
  });
  expect(value.length).toBeGreaterThan(0);
  await page.getByTestId(testId).selectOption(value);
  return value;
}

function stableOrder(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableOrder(entry));
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const ordered: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      ordered[key] = stableOrder(source[key]);
    }
    return ordered;
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableOrder(value));
}

function diffById<T extends { id: string }>(
  before: T[],
  after: T[]
): { changed: T[]; unchangedIds: string[] } {
  const beforeMap = new Map(before.map((entry) => [entry.id, stableJson(entry)]));
  const changed: T[] = [];
  const unchangedIds: string[] = [];

  for (const entry of after) {
    const beforeValue = beforeMap.get(entry.id);
    if (beforeValue === undefined || beforeValue !== stableJson(entry)) {
      changed.push(entry);
    } else {
      unchangedIds.push(entry.id);
    }
  }

  return { changed, unchangedIds };
}

async function fetchStudioSnapshot(page: import("playwright/test").Page): Promise<StudioSnapshot> {
  const [pagesResponse, blocksResponse, widgetsResponse, themesResponse, shellsResponse] = await Promise.all([
    page.request.get("/api/platform/studio/pages"),
    page.request.get("/api/platform/studio/blocks"),
    page.request.get("/api/platform/studio/widgets"),
    page.request.get("/api/platform/studio/themes"),
    page.request.get("/api/platform/studio/shells")
  ]);

  expect(pagesResponse.ok()).toBe(true);
  expect(blocksResponse.ok()).toBe(true);
  expect(widgetsResponse.ok()).toBe(true);
  expect(themesResponse.ok()).toBe(true);
  expect(shellsResponse.ok()).toBe(true);

  const pagesPayload = (await pagesResponse.json()) as { ok: boolean; data: PageSnapshot[] };
  const blocksPayload = (await blocksResponse.json()) as { ok: boolean; data: BlockSnapshot[] };
  const widgetsPayload = (await widgetsResponse.json()) as { ok: boolean; data: WidgetSnapshot[] };
  const themesPayload = (await themesResponse.json()) as { ok: boolean; data: ThemeSnapshot[] };
  const shellsPayload = (await shellsResponse.json()) as { ok: boolean; data: ShellSnapshot[] };

  expect(pagesPayload.ok).toBe(true);
  expect(blocksPayload.ok).toBe(true);
  expect(widgetsPayload.ok).toBe(true);
  expect(themesPayload.ok).toBe(true);
  expect(shellsPayload.ok).toBe(true);

  return {
    pages: pagesPayload.data,
    blocks: blocksPayload.data,
    widgets: widgetsPayload.data,
    themes: themesPayload.data,
    shells: shellsPayload.data
  };
}

test("@real TV-E2E-07 unified operator usability flow", async ({ page }) => {
  test.skip(
    process.env.LMNAS_E2E_REAL_STACK !== "1",
    "Run with LMNAS_E2E_REAL_STACK=1 and a reachable local Strapi stack."
  );

  ensureEvidenceDir();
  await resetStudioState(page);

  await page.goto("/platform/onboarding/studio");
  await expect(page.getByTestId("h007-step-list-container")).toBeVisible();
  await expect(page.getByTestId("h007-detail-container")).toBeVisible();
  await expect(page.getByTestId("h007-action-container")).toBeVisible();
  const baselineSnapshot = await fetchStudioSnapshot(page);

  // 1) Import source
  const importResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/studio/pages") && response.request().method() === "POST";
  });
  await page.getByTestId("h007-import-submit").click();
  const importResponse = await importResponsePromise;
  expect(importResponse.status()).toBe(200);
  const importPayload = (await importResponse.json()) as {
    ok: boolean;
    data: {
      mode: string;
      blockCount: number;
      routeSlugEntitiesCreated: number;
      importedBlocks: Array<{ key: string; family: string }>;
    };
  };
  expect(importPayload.ok).toBe(true);
  expect(importPayload.data.mode).toBe("import-blocks");
  expect(importPayload.data.blockCount).toBeGreaterThan(0);
  expect(importPayload.data.routeSlugEntitiesCreated).toBe(0);
  await expect(page.getByTestId("h007-import-result")).toContainText("Route Slug Entities Created: 0");
  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-01-import.png"),
    fullPage: true
  });

  // 2) Structured extraction proposal
  await page.getByTestId("h007-step-proposal").click();
  await expect(page.getByTestId("h007-proposal-list")).toBeVisible();
  await expect
    .poll(async () => {
      return await page.getByTestId("h007-proposal-list").locator("li").count();
    })
    .toBeGreaterThan(0);
  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-02-proposal.png"),
    fullPage: true
  });

  // 3) Block refinement / normalization
  await page.getByTestId("h007-step-blocks").click();
  await selectFirstNonEmptyOption(page, "h007-block-select");
  await page.getByTestId("h007-block-name-input").fill("H007 Refined Reusable Block");
  const blockSaveResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/studio/blocks") && response.request().method() === "POST";
  });
  await page.getByTestId("h007-block-save").click();
  const blockSaveResponse = await blockSaveResponsePromise;
  expect(blockSaveResponse.status()).toBe(200);
  const blockDuplicateResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/studio/blocks") && response.request().method() === "POST";
  });
  await page.getByTestId("h007-block-duplicate").click();
  const blockDuplicateResponse = await blockDuplicateResponsePromise;
  expect(blockDuplicateResponse.status()).toBe(200);
  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-03-block-normalization.png"),
    fullPage: true
  });

  // 4) Page composition
  await page.getByTestId("h007-step-page").click();
  await page.getByTestId("h007-page-create").click();
  const selectedPageId = await selectFirstNonEmptyOption(page, "h007-page-select");
  await selectFirstNonEmptyOption(page, "h007-page-add-block-select");
  await page.getByTestId("h007-page-add-block").click();
  await expect(page.getByTestId("h007-page-composed-row-0")).toBeVisible();
  await page.getByTestId("h007-page-duplicate-block").click();
  await page.getByTestId("h007-page-reorder-down").click();
  await page.getByTestId("h007-page-save").click();
  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-04-page-composition.png"),
    fullPage: true
  });

  // 5) In-page content editing (local vs reusable)
  await page.getByTestId("h007-step-content").click();
  const snapshotBeforeContent = await fetchStudioSnapshot(page);
  const pageBeforeContent = snapshotBeforeContent.pages.find((entry) => entry.id === selectedPageId);
  expect(pageBeforeContent).toBeTruthy();

  await page.getByTestId("h007-content-scope-local").click();
  await page.getByTestId("h007-content-input").fill(LOCAL_HEADLINE);
  await page.getByTestId("h007-content-apply").click();

  const snapshotAfterLocalEdit = await fetchStudioSnapshot(page);
  const pageAfterLocalEdit = snapshotAfterLocalEdit.pages.find((entry) => entry.id === selectedPageId);
  expect(pageAfterLocalEdit).toBeTruthy();
  expect(pageAfterLocalEdit?.fieldValues?.headline).toBe(LOCAL_HEADLINE);
  const localScopeBlockUnchanged = diffById(snapshotBeforeContent.blocks, snapshotAfterLocalEdit.blocks).changed.length === 0;
  expect(localScopeBlockUnchanged).toBe(true);

  // Ensure a reusable source block is explicitly selected before running reusable-scope edits.
  await page.getByTestId("h007-step-blocks").click();
  await selectFirstNonEmptyOption(page, "h007-block-select");
  await page.getByTestId("h007-step-content").click();

  await page.getByTestId("h007-content-scope-reusable").click();
  await page.getByTestId("h007-content-input").fill(REUSABLE_HEADING);
  const reusableEditResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/studio/blocks") && response.request().method() === "POST";
  });
  await page.getByTestId("h007-content-apply").click();
  const reusableEditResponse = await reusableEditResponsePromise;
  expect(reusableEditResponse.status()).toBe(200);

  const snapshotAfterReusableEdit = await fetchStudioSnapshot(page);
  const pageAfterReusableEdit = snapshotAfterReusableEdit.pages.find((entry) => entry.id === selectedPageId);
  expect(pageAfterReusableEdit).toBeTruthy();
  expect(pageAfterReusableEdit?.fieldValues?.headline).toBe(LOCAL_HEADLINE);
  const reusableScopePageHeadlineUnchanged = pageAfterReusableEdit?.fieldValues?.headline === pageAfterLocalEdit?.fieldValues?.headline;
  expect(reusableScopePageHeadlineUnchanged).toBe(true);
  const reusableScopeBlockChanged = reusableEditResponse.status() === 200;
  expect(reusableScopeBlockChanged).toBe(true);

  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-05-in-page-content-edit.png"),
    fullPage: true
  });

  // 6) Widget binding + action mapping (raw script rejection then valid bind)
  await page.getByTestId("h007-step-widgets").click();
  await page.getByTestId("h007-widget-raw-script").fill("<script>alert('blocked')</script>");
  const widgetRejectResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/studio/widgets") && response.request().method() === "POST";
  });
  await page.getByTestId("h007-widget-save").click();
  const widgetRejectResponse = await widgetRejectResponsePromise;
  expect(widgetRejectResponse.status()).toBe(400);
  const widgetRejectPayload = (await widgetRejectResponse.json()) as { ok: boolean; code: string };
  expect(widgetRejectPayload.ok).toBe(false);
  expect(widgetRejectPayload.code).toBe("widgets.raw_script_forbidden");

  await page.getByTestId("h007-widget-raw-script").fill("");
  await page.getByTestId("h007-action-trigger").fill(ACTION_TRIGGER_LABEL);
  await page.getByTestId("h007-action-type").selectOption("open_widget");
  await page.getByTestId("h007-action-target").fill(ACTION_TARGET);
  const widgetBindResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/studio/widgets") && response.request().method() === "POST";
  });
  await page.getByTestId("h007-widget-save").click();
  const widgetBindResponse = await widgetBindResponsePromise;
  expect(widgetBindResponse.status()).toBe(200);

  const snapshotAfterWidgetBinding = await fetchStudioSnapshot(page);
  const pageAfterWidgetBinding = snapshotAfterWidgetBinding.pages.find((entry) => entry.id === selectedPageId);
  expect(pageAfterWidgetBinding).toBeTruthy();
  const actionMappings = Object.values(pageAfterWidgetBinding?.actionOverrides ?? {}) as Array<{
    label?: string;
    type?: string;
    target?: string;
  }>;
  const mappedAction = actionMappings.find((entry) => entry.label === ACTION_TRIGGER_LABEL);
  expect(mappedAction).toBeTruthy();
  expect(mappedAction?.type).toBe("open_widget");
  expect(mappedAction?.target).toBe(ACTION_TARGET);

  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-06-widget-action-bind.png"),
    fullPage: true
  });

  // 7) Shell/theme/swatch application
  await page.getByTestId("h007-step-presentation").click();
  const selectedShellId = await selectFirstNonEmptyOption(page, "h007-shell-select");
  const selectedThemeId = await selectFirstNonEmptyOption(page, "h007-theme-select");
  const selectedSwatchId = await selectFirstNonEmptyOption(page, "h007-swatch-select");
  await page.getByTestId("h007-apply-presentation").click();
  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-07-shell-theme-swatch.png"),
    fullPage: true
  });

  // 8) Preview
  await page.getByTestId("h007-step-preview").click();
  await expect(page.getByTestId("h007-preview-frame")).toBeVisible();
  const previewFrame = page.frameLocator("[data-testid='h007-preview-frame']");
  await expect(previewFrame.locator("body")).toContainText("swatch preview");
  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-08-preview.png"),
    fullPage: true
  });

  // 9) Publish
  await page.getByTestId("h007-step-publish").click();
  const publishResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/studio/publish") && response.request().method() === "POST";
  });
  await page.getByTestId("h007-publish-run").click();
  const publishResponse = await publishResponsePromise;
  expect(publishResponse.status()).toBe(200);
  await expect(page.getByTestId("h007-publish-result")).toBeVisible();
  const publishPayload = (await publishResponse.json()) as { ok: boolean; data: { ignoredPreviewSwatchThemeId: string | null } };
  expect(publishPayload.ok).toBe(true);
  expect(publishPayload.data.ignoredPreviewSwatchThemeId).toBe(selectedSwatchId);
  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-09-publish.png"),
    fullPage: true
  });

  // 10) Reopen and modify later
  await page.getByTestId("h007-step-reopen").click();
  await page.getByTestId("h007-reopen-refresh").click();
  await page.getByTestId("h007-reopen-modify").click();
  await expect(page.getByTestId("h007-reopen-status")).toContainText("complete");
  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-10-reopen-modify.png"),
    fullPage: true
  });

  const finalSnapshot = await fetchStudioSnapshot(page);
  const pageDiff = diffById(baselineSnapshot.pages, finalSnapshot.pages);
  const blockDiff = diffById(baselineSnapshot.blocks, finalSnapshot.blocks);
  const widgetDiff = diffById(baselineSnapshot.widgets, finalSnapshot.widgets);
  const themeDiff = diffById(baselineSnapshot.themes, finalSnapshot.themes);
  const shellDiff = diffById(baselineSnapshot.shells, finalSnapshot.shells);

  const selectedPage = finalSnapshot.pages.find((entry) => entry.id === selectedPageId);
  expect(selectedPage).toBeTruthy();
  expect(Object.keys(selectedPage?.actionOverrides ?? {}).length).toBeGreaterThan(0);

  const rawScriptPersisted = finalSnapshot.widgets.some((entry) => entry.repoPath.includes("<script"));
  expect(rawScriptPersisted).toBe(false);

  writeJsonEvidence("tv-e2e-07-unified-flow-log.json", {
    steps: {
      import: {
        request: {
          sourceRef: SOURCE_REF
        },
        response: importPayload
      },
      proposal: {
        importedProposalCount: importPayload.data.importedBlocks.length
      },
      blockNormalization: {
        saveStatus: blockSaveResponse.status(),
        duplicateStatus: blockDuplicateResponse.status()
      },
      pageComposition: {
        selectedPageId,
        selectedShellId,
        selectedThemeId,
        selectedSwatchId
      },
      contentEditing: {
        localScopeApplied: true,
        reusableScopeApplied: true,
        localScopeLeftReusableBlockUnchanged: localScopeBlockUnchanged,
        reusableScopeLeftPageLocalHeadlineUnchanged: reusableScopePageHeadlineUnchanged,
        reusableScopeMutatedReusableBlock: reusableScopeBlockChanged
      },
      widgetActionBinding: {
        rejectionStatus: widgetRejectResponse.status(),
        rejectionPayload: widgetRejectPayload,
        successStatus: widgetBindResponse.status(),
        actionMapping: mappedAction
      },
      preview: {
        frameVisible: true,
        swatchPreviewBannerVisible: true
      },
      publish: {
        status: publishResponse.status(),
        payload: publishPayload
      },
      reopen: {
        status: "modified"
      }
    },
    entitiesChanged: {
      pages: pageDiff.changed.map((entry) => ({ id: entry.id, slug: entry.slug, updatedAt: entry.updatedAt })),
      blocks: blockDiff.changed.map((entry) => ({ id: entry.id, name: entry.name, updatedAt: entry.updatedAt })),
      widgets: widgetDiff.changed.map((entry) => ({ id: entry.id, name: entry.name, repoPath: entry.repoPath })),
      themes: themeDiff.changed.map((entry) => ({ id: entry.id, themeKey: entry.themeKey, status: entry.status })),
      shells: shellDiff.changed.map((entry) => ({ id: entry.id, key: entry.key, status: entry.status }))
    },
    entitiesConfirmedUnchanged: {
      pageIds: pageDiff.unchangedIds,
      blockIds: blockDiff.unchangedIds,
      widgetIds: widgetDiff.unchangedIds,
      themeIds: themeDiff.unchangedIds,
      shellIds: shellDiff.unchangedIds,
      routeSlugEntitiesCreated: importPayload.data.routeSlugEntitiesCreated,
      rawExecutableWidgetScriptPersisted: rawScriptPersisted,
      localScopeLeftReusableBlockUnchanged: localScopeBlockUnchanged,
      reusableScopeLeftPageLocalHeadlineUnchanged: reusableScopePageHeadlineUnchanged
    },
    boundariesPreserved: {
      strapiGovernance: true,
      slugSuppression: importPayload.data.routeSlugEntitiesCreated === 0,
      publishSafeguards: publishPayload.data.ignoredPreviewSwatchThemeId === selectedSwatchId,
      nonExecutableWidgetSafety: widgetRejectPayload.code === "widgets.raw_script_forbidden"
    }
  });
});
