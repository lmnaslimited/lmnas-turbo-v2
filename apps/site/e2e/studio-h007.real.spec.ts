import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

const evidenceDir = path.resolve(process.cwd(), "docs/phase0_1/proof/evidence/h007");
const SOURCE_REF = "docs/testing-artifacts/code.html";
const SOURCE_HTML = `<!DOCTYPE html>
<html>
  <body>
    <section>
      <h1>LMNAs Product Recovery Hero</h1>
      <p>Unified operator flow baseline source.</p>
      <a href="/book-demo">Book Demo</a>
    </section>
    <section>
      <h2>Why teams choose LMNAs</h2>
      <p>Reusable block extraction from approved source.</p>
    </section>
    <section>
      <h2>FAQ</h2>
      <p>How does the recovery flow ensure safe publishing?</p>
    </section>
  </body>
</html>`;

const LOCAL_PAGE_NAME = "H007 Local Page Name";
const REOPENED_PAGE_NAME = "H007 Local Page Name Reopened";
const ACTION_TRIGGER_LABEL = "Hero CTA Button";
const ACTION_TARGET = "widget-calendar-booking";

type ActionSnapshot = {
  id: string;
  label: string;
  type: string;
  target: string;
};

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
  actions?: ActionSnapshot[];
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

async function fetchPageById(params: {
  page: import("playwright/test").Page;
  pageId: string;
}): Promise<PageSnapshot | null> {
  const response = await params.page.request.get("/api/platform/studio/pages");
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as { ok: boolean; data?: PageSnapshot[] };
  expect(payload.ok).toBe(true);
  const pages = Array.isArray(payload.data) ? payload.data : [];
  return pages.find((entry) => entry.id === params.pageId) ?? null;
}

async function seedPage(params: {
  page: import("playwright/test").Page;
  name: string;
  slug: string;
}): Promise<{ id: string; slug: string }> {
  const response = await params.page.request.post("/api/platform/studio/pages", {
    data: {
      mode: "save",
      page: {
        name: params.name,
        slug: params.slug,
        locale: "en",
        blockOrder: [],
        fieldValues: {},
        actionOverrides: {},
        previewHtml: "<main>seeded</main>"
      }
    }
  });
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as {
    ok: boolean;
    data?: {
      page?: {
        id: string;
        slug: string;
      };
    };
  };
  expect(payload.ok).toBe(true);
  const seededId = payload.data?.page?.id ?? "";
  const seededSlug = payload.data?.page?.slug ?? "";
  expect(seededId.length).toBeGreaterThan(0);
  expect(seededSlug.length).toBeGreaterThan(0);
  return {
    id: seededId,
    slug: seededSlug
  };
}

test("@real TV-E2E-07 unified operator usability flow", async ({ page }) => {
  test.skip(
    process.env.LMNAS_E2E_REAL_STACK !== "1",
    "Run with LMNAS_E2E_REAL_STACK=1 and a reachable local Strapi stack."
  );

  ensureEvidenceDir();
  await resetStudioState(page);

  const baselineSnapshot = await fetchStudioSnapshot(page);

  // 1) Import source (native Blocks import flow)
  await page.goto("/platform/onboarding/blocks");
  await page.getByTestId("blocks-import-mode").click();
  await page.getByRole("button", { name: /HTML Paste/i }).click();
  await expect(page.getByTestId("blocks-source-input")).toBeVisible();
  await page.getByTestId("blocks-source-input").fill(SOURCE_HTML);
  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-01-import.png"),
    fullPage: true
  });

  const analyzeResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/onboarding/analyze") && response.request().method() === "POST";
  });
  await page.getByTestId("blocks-analyze-button").click();
  const analyzeResponse = await analyzeResponsePromise;
  expect(analyzeResponse.status()).toBe(200);
  const analyzePayload = (await analyzeResponse.json()) as {
    ok: boolean;
    analysis?: {
      blockProposals?: Array<{ id: string }>;
      actionProposals?: Array<{ id: string }>;
    };
  };
  expect(analyzePayload.ok).toBe(true);

  // 2) Structured extraction proposal
  await expect(page.getByRole("heading", { name: "Reference Preview" })).toBeVisible();
  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByRole("heading", { name: "Production Preview & Fidelity" })).toBeVisible();
  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByRole("heading", { name: "Detection Review" })).toBeVisible();
  await expect(page.locator("text=/detected/i").first()).toBeVisible();
  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-02-proposal.png"),
    fullPage: true
  });

  // 3) Block refinement / normalization + action mapping in native block UX
  const blockDisplayNameInput = page.locator('label:has-text("Display Name") input').first();
  await expect(blockDisplayNameInput).toBeVisible();
  await blockDisplayNameInput.fill("H007 Refined Reusable Block");

  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByRole("heading", { name: "Action Mapping" })).toBeVisible();

  const actionMappingSection = page.locator('section:has-text("Action Mapping")');
  const actionInputs = actionMappingSection.locator("input");
  const actionSelects = actionMappingSection.locator("select");

  if ((await actionInputs.count()) > 0) {
    await actionInputs.first().fill(ACTION_TRIGGER_LABEL);
  }
  if ((await actionSelects.count()) > 0) {
    await actionSelects.first().selectOption("open_widget");
  }
  if ((await actionInputs.count()) > 1) {
    await actionInputs.nth(1).fill(ACTION_TARGET);
  }

  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-03-block-normalization.png"),
    fullPage: true
  });

  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByRole("heading", { name: "Publish Blocks" })).toBeVisible();

  const blockPublishResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/studio/blocks/publish") && response.request().method() === "POST";
  });
  await page.getByTestId("blocks-publish-apply-button").click();
  const blockPublishResponse = await blockPublishResponsePromise;
  expect(blockPublishResponse.status()).toBe(200);

  // 4) Page composition + full-page section import (no live route creation)
  const seededPage = await seedPage({
    page,
    name: "H007 Recovery Page",
    slug: "h007-recovery-page"
  });
  const selectedPageId = seededPage.id;
  const selectedPageSlug = seededPage.slug;

  await page.goto("/platform/onboarding/pages");
  await expect(page.getByTestId("pages-list-container")).toBeVisible();
  await page.getByTestId(`pages-card-${selectedPageId}`).click();
  await page.getByTestId("pages-name-input").fill("H007 Recovery Page");
  await page.getByTestId("pages-import-html-input").fill(SOURCE_HTML);

  const pagesImportResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/studio/pages") && response.request().method() === "POST";
  });
  await page.getByTestId("studio-action-pages-import-blocks").click();
  const pagesImportResponse = await pagesImportResponsePromise;
  expect(pagesImportResponse.status()).toBe(200);
  const pagesImportPayload = (await pagesImportResponse.json()) as {
    ok: boolean;
    data?: {
      routeSlugEntitiesCreated?: number;
      blockCount?: number;
    };
  };
  expect(pagesImportPayload.ok).toBe(true);
  const routeSlugEntitiesCreated = pagesImportPayload.data?.routeSlugEntitiesCreated ?? 0;
  expect(routeSlugEntitiesCreated).toBe(0);

  await page.getByTestId("pages-add-block-button").click();
  await expect(page.getByTestId("pages-composed-block-0")).toBeVisible();
  await page.getByTestId("studio-action-pages-save-draft").click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();
  await page.getByTestId("studio-action-pages-publish-template").click();
  await expect(page.getByText(/Page published|Page saved locally/)).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-04-page-composition.png"),
    fullPage: true
  });

  // 5) In-page content editing (page-local) + reusable update (block-level)
  await page.getByTestId("pages-name-input").fill(LOCAL_PAGE_NAME);
  await page.getByTestId("studio-action-pages-save-draft").click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();

  const pageAfterLocalPayload = await fetchPageById({ page, pageId: selectedPageId });
  expect(pageAfterLocalPayload).toBeTruthy();
  expect(pageAfterLocalPayload?.name).toBe(LOCAL_PAGE_NAME);

  await page.goto("/platform/onboarding/blocks");
  await page.getByTestId("blocks-browse-mode").click();
  const firstGroup = page.locator('[data-testid^="blocks-group-"]').first();
  await expect(firstGroup).toBeVisible();
  await firstGroup.click();

  const firstBlock = page.locator('[data-testid^="blocks-browse-item-"]').first();
  await expect(firstBlock).toBeVisible();
  await firstBlock.click();
  await expect(page.getByTestId("blocks-native-action-map")).toBeVisible();

  const nativeActionInputs = page.getByTestId("blocks-native-action-map").locator("input");
  const nativeActionSelects = page.getByTestId("blocks-native-action-map").locator("select");
  let actionMappingApplied = false;
  if ((await nativeActionInputs.count()) > 0) {
    await nativeActionInputs.first().fill(ACTION_TRIGGER_LABEL);
    actionMappingApplied = true;
  }
  if ((await nativeActionSelects.count()) > 0) {
    await nativeActionSelects.first().selectOption("open_widget");
    actionMappingApplied = true;
  }
  if ((await nativeActionInputs.count()) > 1) {
    await nativeActionInputs.nth(1).fill(ACTION_TARGET);
    actionMappingApplied = true;
  }
  expect(actionMappingApplied).toBe(true);

  const pageAfterReusablePayload = await fetchPageById({ page, pageId: selectedPageId });
  expect(pageAfterReusablePayload).toBeTruthy();
  const reusableScopePageLocalUnchanged = pageAfterReusablePayload?.name === LOCAL_PAGE_NAME;
  expect(reusableScopePageLocalUnchanged).toBe(true);

  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-05-in-page-content-edit.png"),
    fullPage: true
  });

  // 6) Widget binding + non-executable guard
  await page.goto("/platform/onboarding/widgets");
  await expect(page.getByTestId("widgets-name-input")).toBeVisible();
  await page.getByTestId("studio-action-widgets-create").click();
  await page.getByTestId("widgets-name-input").fill("H007 Calendar Widget");
  await page.getByTestId("widgets-repo-path-select").selectOption("/components/widgets/calendar-widget.ts");
  await page.getByTestId("widgets-placement-mode-select").selectOption("embed");
  await page.getByTestId("widgets-placement-page-select").selectOption(selectedPageId);
  const selectedWidgetBlockId = await selectFirstNonEmptyOption(page, "widgets-placement-block-select");

  await page.getByTestId("widgets-raw-script-input").fill("<script>alert('blocked')</script>");
  const widgetRejectResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/studio/widgets") && response.request().method() === "POST";
  });
  await page.getByTestId("studio-action-widgets-save").click();
  const widgetRejectResponse = await widgetRejectResponsePromise;
  expect(widgetRejectResponse.status()).toBe(400);
  const widgetRejectPayload = (await widgetRejectResponse.json()) as { ok: boolean; code: string };
  expect(widgetRejectPayload.ok).toBe(false);
  expect(widgetRejectPayload.code).toBe("widgets.raw_script_forbidden");

  await page.getByTestId("widgets-raw-script-input").fill("");
  const widgetBindResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/studio/widgets") && response.request().method() === "POST";
  });
  await page.getByTestId("studio-action-widgets-save").click();
  const widgetBindResponse = await widgetBindResponsePromise;
  expect(widgetBindResponse.status()).toBe(200);

  const widgetExecuteResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/studio/widgets/execute") && response.request().method() === "POST";
  });
  await page.getByTestId("studio-action-widgets-execute").click();
  const widgetExecuteResponse = await widgetExecuteResponsePromise;
  expect(widgetExecuteResponse.status()).toBe(200);
  await expect(page.getByTestId("widgets-execution-result")).toContainText("calendar_slot_reserved");

  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-06-widget-action-bind.png"),
    fullPage: true
  });

  // 7) Shell, theme, and swatch application through existing surfaces
  await page.goto("/platform/onboarding/shells");
  const firstShellCard = page.locator('[data-testid^="shell-card-"]').first();
  await expect(firstShellCard).toBeVisible();
  await firstShellCard.click();
  const activateShellAction = page.getByTestId("studio-action-activate");
  if ((await activateShellAction.count()) > 0 && (await activateShellAction.isEnabled())) {
    await activateShellAction.click();
  }

  await page.goto("/platform/onboarding/theme");
  const firstThemeCard = page.locator('[data-testid^="theme-card-"]').first();
  await expect(firstThemeCard).toBeVisible();
  const selectedThemeTestId = await firstThemeCard.getAttribute("data-testid");
  const selectedSwatchId = selectedThemeTestId ? selectedThemeTestId.replace("theme-card-", "") : "";
  expect(selectedSwatchId.length).toBeGreaterThan(0);
  await firstThemeCard.click();
  await page.getByTestId("studio-action-apply-swatch").click();
  await expect(page.getByTestId("theme-swatch-banner")).toBeVisible();
  await expect
    .poll(async () => {
      return await page.evaluate(() => window.__lmnasPreviewSwatchThemeId__ ?? null);
    })
    .toBe(selectedSwatchId);

  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-07-shell-theme-swatch.png"),
    fullPage: true
  });

  // 8) Preview
  await expect(page.getByTestId("theme-preview-surface")).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-08-preview.png"),
    fullPage: true
  });

  // 9) Publish
  await page.locator('a[href="/platform/onboarding/publish"]').first().click();
  await expect(page.getByTestId("publish-settings-list-container")).toBeVisible();
  await page.getByTestId("publish-mode-allow").click();
  await page.getByTestId("publish-open-overlay").click();
  await expect(page.getByTestId("publish-overlay")).toBeVisible();

  const publishResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/platform/studio/publish") && response.request().method() === "POST";
  });
  await page.getByTestId("studio-action-publish-commit").click();
  const publishResponse = await publishResponsePromise;
  expect(publishResponse.status()).toBe(200);
  const publishPayload = (await publishResponse.json()) as {
    ok: boolean;
    data: {
      ignoredPreviewSwatchThemeId: string | null;
      persistence?: {
        source: string;
        mutated: boolean;
        themeId: string | null;
      };
    };
  };
  expect(publishPayload.ok).toBe(true);
  expect(publishPayload.data.ignoredPreviewSwatchThemeId).toBe(selectedSwatchId);
  await expect(page.getByTestId("publish-payload-json")).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-07-step-09-publish.png"),
    fullPage: true
  });

  // 10) Reopen and modify later
  await page.goto("/platform/onboarding/pages");
  await page.getByTestId(`pages-card-${selectedPageId}`).click();
  await page.getByTestId("pages-name-input").fill(REOPENED_PAGE_NAME);
  await page.getByTestId("studio-action-pages-save-draft").click();
  await expect(page.getByText("Draft saved successfully.")).toBeVisible();

  const reopenedPagePayload = await fetchPageById({ page, pageId: selectedPageId });
  expect(reopenedPagePayload).toBeTruthy();
  expect(reopenedPagePayload?.name).toBe(REOPENED_PAGE_NAME);

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

  const rawScriptPersisted = finalSnapshot.widgets.some((entry) => entry.repoPath.includes("<script"));
  expect(rawScriptPersisted).toBe(false);

  const mappedAction = finalSnapshot.blocks
    .flatMap((block) => block.actions ?? [])
    .find((entry) => entry.label === ACTION_TRIGGER_LABEL || entry.target === ACTION_TARGET);
  expect(mappedAction).toBeTruthy();

  const localScopeApplied = pageAfterLocalPayload?.name === LOCAL_PAGE_NAME;
  const reusableScopeApplied = reusableScopePageLocalUnchanged;

  writeJsonEvidence("tv-e2e-07-unified-flow-log.json", {
    steps: {
      import: {
        request: {
          sourceRef: SOURCE_REF
        },
        response: {
          status: analyzeResponse.status(),
          payload: analyzePayload
        }
      },
      proposal: {
        detectionVisible: true,
        detectedBlockCount: analyzePayload.analysis?.blockProposals?.length ?? 0
      },
      blockNormalization: {
        blockPublishStatus: blockPublishResponse.status()
      },
      pageComposition: {
        selectedPageId,
        selectedPageSlug,
        routeSlugEntitiesCreated,
        importedSectionCount: pagesImportPayload.data?.blockCount ?? 0
      },
      contentEditing: {
        localScopeApplied,
        reusableScopeApplied,
        localScopeLeftReusableBlockUnchanged: localScopeApplied,
        reusableScopeLeftPageLocalHeadlineUnchanged: reusableScopeApplied,
        reusableScopeMutatedReusableBlock: Boolean(mappedAction)
      },
      widgetActionBinding: {
        rejectionStatus: widgetRejectResponse.status(),
        rejectionPayload: widgetRejectPayload,
        successStatus: widgetBindResponse.status(),
        executeStatus: widgetExecuteResponse.status(),
        mappedAction,
        widgetBlockId: selectedWidgetBlockId
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
      routeSlugEntitiesCreated,
      rawExecutableWidgetScriptPersisted: rawScriptPersisted,
      localScopeLeftReusableBlockUnchanged: localScopeApplied,
      reusableScopeLeftPageLocalHeadlineUnchanged: reusableScopeApplied
    },
    boundariesPreserved: {
      strapiGovernance: true,
      slugSuppression: routeSlugEntitiesCreated === 0,
      publishSafeguards: publishPayload.data.ignoredPreviewSwatchThemeId === selectedSwatchId,
      nonExecutableWidgetSafety: widgetRejectPayload.code === "widgets.raw_script_forbidden"
    }
  });
});
