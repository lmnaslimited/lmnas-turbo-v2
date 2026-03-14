import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

const evidenceDir = path.resolve(process.cwd(), "docs/phase0_1/proof/evidence/h006");

type StrapiCollectionPayload = {
  data?: Array<{ id?: number | string; documentId?: string; slug?: string; key?: string; templateKey?: string }>;
  meta?: {
    pagination?: {
      total?: number;
    };
  };
};

type StrapiEntitySnapshot = {
  total: number;
  ids: string[];
};

type CoreStrapiSnapshot = {
  pages: StrapiEntitySnapshot;
  blocks: StrapiEntitySnapshot;
  shells: StrapiEntitySnapshot;
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

function getStrapiContext(): { url: string; token?: string } {
  const url = (process.env.STRAPI_URL ?? "http://127.0.0.1:1337").replace(/\/$/, "");
  const token = process.env.STRAPI_API_TOKEN;
  return {
    url,
    ...(typeof token === "string" && token.trim().length > 0 ? { token: token.trim() } : {})
  };
}

async function readStrapiEntitySnapshot(params: {
  page: import("playwright/test").Page;
  endpoint: string;
  token?: string;
}): Promise<StrapiEntitySnapshot> {
  const response = await params.page.request.get(params.endpoint, {
    headers: {
      "content-type": "application/json",
      ...(params.token ? { Authorization: `Bearer ${params.token}` } : {})
    }
  });
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as StrapiCollectionPayload;
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const totalFromMeta = payload.meta?.pagination?.total;
  return {
    total: typeof totalFromMeta === "number" ? totalFromMeta : rows.length,
    ids: rows
      .map((row) => {
        if (typeof row.documentId === "string") {
          return row.documentId;
        }
        if (typeof row.id === "number" || typeof row.id === "string") {
          return String(row.id);
        }
        if (typeof row.slug === "string") {
          return row.slug;
        }
        if (typeof row.templateKey === "string") {
          return row.templateKey;
        }
        if (typeof row.key === "string") {
          return row.key;
        }
        return "";
      })
      .filter((entry) => entry.length > 0)
      .sort()
  };
}

async function readCoreStrapiSnapshot(page: import("playwright/test").Page): Promise<CoreStrapiSnapshot> {
  const strapi = getStrapiContext();
  return {
    pages: await readStrapiEntitySnapshot({
      page,
      endpoint: `${strapi.url}/api/pages?pagination[pageSize]=200`,
      token: strapi.token
    }),
    blocks: await readStrapiEntitySnapshot({
      page,
      endpoint: `${strapi.url}/api/block-templates?pagination[pageSize]=200`,
      token: strapi.token
    }),
    shells: await readStrapiEntitySnapshot({
      page,
      endpoint: `${strapi.url}/api/shell-variants?pagination[pageSize]=200`,
      token: strapi.token
    })
  };
}

async function seedPage(params: {
  page: import("playwright/test").Page;
  name: string;
  slug: string;
}): Promise<{ id: string; slug: string; blockOrder: string[] }> {
  const response = await params.page.request.post("/api/platform/studio/pages", {
    data: {
      mode: "save",
      page: {
        name: params.name,
        slug: params.slug,
        locale: "en",
        blockOrder: ["blk-hero-1", "blk-cta-1"],
        previewHtml: `<main><section><h1>${params.name}</h1></section></main>`
      }
    }
  });
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as {
    ok: boolean;
    data: {
      page: {
        id: string;
        slug: string;
        blockOrder: string[];
      };
    };
  };
  expect(payload.ok).toBe(true);
  return payload.data.page;
}

async function selectFirstNonPlaceholderOption(params: {
  page: import("playwright/test").Page;
  testId: string;
}): Promise<string> {
  const value = await params.page.getByTestId(params.testId).evaluate((element) => {
    if (!(element instanceof HTMLSelectElement)) {
      return "";
    }
    const option = Array.from(element.options).find((entry) => entry.value.trim().length > 0);
    return option?.value ?? "";
  });
  expect(value.length).toBeGreaterThan(0);
  await params.page.getByTestId(params.testId).selectOption(value);
  return value;
}

test.describe("H-006 widget workflow real-stack tests", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      process.env.LMNAS_E2E_REAL_STACK !== "1",
      "Run with LMNAS_E2E_REAL_STACK=1 and a reachable local Strapi stack."
    );
    ensureEvidenceDir();
    await resetStudioState(page);
  });

  test("@real TV-E2E-05 inject repo-first widget into page and assemble second page with shared blocks", async ({ page }) => {
    const pageOne = await seedPage({
      page,
      name: "TV-E2E-05 Primary Page",
      slug: "tv-e2e-05-primary"
    });
    const pageTwo = await seedPage({
      page,
      name: "TV-E2E-05 Secondary Page",
      slug: "tv-e2e-05-secondary"
    });

    expect(pageOne.blockOrder).toEqual(pageTwo.blockOrder);

    const strapiBefore = await readCoreStrapiSnapshot(page);

    await page.goto("/platform/onboarding/widgets");
    await expect(page.getByTestId("widgets-list-container")).toBeVisible();
    await expect(page.getByTestId("widgets-detail-container")).toBeVisible();
    await expect(page.getByTestId("widgets-action-container")).toBeVisible();
    await expect(page.getByTestId("widgets-name-input")).toBeVisible();
    await expect
      .poll(async () => {
        return await page.getByTestId("widgets-placement-page-select").locator("option").count();
      })
      .toBeGreaterThan(1);

    await page.getByTestId("studio-action-widgets-create").click();
    await page.getByTestId("widgets-name-input").fill("TV-E2E-05 Calendar Widget");
    await page.getByTestId("widgets-repo-path-select").selectOption("/components/widgets/calendar-widget.ts");
    await page.getByTestId("widgets-placement-mode-select").selectOption("embed");
    await page.getByTestId("widgets-placement-page-select").selectOption(pageOne.id);
    const selectedBlockId = await selectFirstNonPlaceholderOption({
      page,
      testId: "widgets-placement-block-select"
    });

    const saveResponsePromise = page.waitForResponse((response) => {
      return response.url().includes("/api/platform/studio/widgets") && response.request().method() === "POST";
    });
    await page.getByTestId("studio-action-widgets-save").click();
    const saveResponse = await saveResponsePromise;
    const savePayload = (await saveResponse.json()) as {
      ok: boolean;
      code?: string;
      error?: string;
      strapiAudit: {
        unchangedCoreEntities: boolean;
      };
    };
    expect(saveResponse.status(), JSON.stringify(savePayload)).toBe(200);
    expect(savePayload.ok).toBe(true);
    expect(savePayload.strapiAudit.unchangedCoreEntities).toBe(true);

    const executeResponsePromise = page.waitForResponse((response) => {
      return response.url().includes("/api/platform/studio/widgets/execute") && response.request().method() === "POST";
    });
    await page.getByTestId("studio-action-widgets-execute").click();
    const executeResponse = await executeResponsePromise;
    expect(executeResponse.status()).toBe(200);
    const executePayload = (await executeResponse.json()) as {
      ok: boolean;
      data: {
        result: {
          event: string;
          trace: {
            pageId: string | null;
            blockId: string | null;
          };
        };
      };
      strapiAudit: {
        unchangedCoreEntities: boolean;
      };
    };
    expect(executePayload.ok).toBe(true);
    expect(executePayload.data.result.event).toBe("calendar_slot_reserved");
    expect(executePayload.data.result.trace.pageId).toBe(pageOne.id);
    expect(executePayload.data.result.trace.blockId).toBe(selectedBlockId);
    expect(executePayload.strapiAudit.unchangedCoreEntities).toBe(true);
    await expect(page.getByTestId("widgets-execution-result")).toContainText("calendar_slot_reserved");

    await page.screenshot({
      path: path.join(evidenceDir, "tv-e2e-05-widget-integration.png"),
      fullPage: true
    });

    await page.goto("/platform/onboarding/pages");
    await expect(page.getByTestId(`pages-card-${pageOne.id}`)).toBeVisible();
    await expect(page.getByTestId(`pages-card-${pageTwo.id}`)).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "tv-e2e-05-two-pages-shared-blocks.png"),
      fullPage: true
    });

    const pageListingResponse = await page.request.get("/api/platform/studio/pages");
    expect(pageListingResponse.ok()).toBe(true);
    const pageListingPayload = (await pageListingResponse.json()) as {
      ok: boolean;
      data: Array<{
        id: string;
        slug: string;
        blockOrder: string[];
      }>;
    };
    expect(pageListingPayload.ok).toBe(true);

    const strapiAfter = await readCoreStrapiSnapshot(page);
    expect(strapiAfter.pages.total).toBe(strapiBefore.pages.total);
    expect(strapiAfter.blocks.total).toBe(strapiBefore.blocks.total);
    expect(strapiAfter.shells.total).toBe(strapiBefore.shells.total);
    expect(strapiAfter.pages.ids).toEqual(strapiBefore.pages.ids);
    expect(strapiAfter.blocks.ids).toEqual(strapiBefore.blocks.ids);
    expect(strapiAfter.shells.ids).toEqual(strapiBefore.shells.ids);

    writeJsonEvidence("tv-e2e-05-widget-network-log.json", {
      saveWidgetResponse: savePayload,
      executeWidgetResponse: executePayload,
      pages: {
        seeded: [pageOne, pageTwo],
        listing: pageListingPayload
      },
      strapiBefore,
      strapiAfter
    });
  });

  test("@real TV-MTR-10 reject raw JS upload and execute validated repo-path widget mapping", async ({ page }) => {
    const placementPage = await seedPage({
      page,
      name: "TV-MTR-10 Placement Page",
      slug: "tv-mtr-10-placement"
    });

    const strapiBefore = await readCoreStrapiSnapshot(page);
    const widgetsBeforeResponse = await page.request.get("/api/platform/studio/widgets");
    expect(widgetsBeforeResponse.ok()).toBe(true);
    const widgetsBeforePayload = (await widgetsBeforeResponse.json()) as {
      ok: boolean;
      data: Array<{ id: string }>;
    };
    expect(widgetsBeforePayload.ok).toBe(true);

    await page.goto("/platform/onboarding/widgets");
    await expect(page.getByTestId("widgets-name-input")).toBeVisible();
    await page.getByTestId("studio-action-widgets-create").click();
    await expect
      .poll(async () => {
        return await page.getByTestId("widgets-placement-page-select").locator("option").count();
      })
      .toBeGreaterThan(1);
    await page.getByTestId("widgets-name-input").fill("TV-MTR-10 Widget");
    await page.getByTestId("widgets-placement-mode-select").selectOption("embed");
    await page.getByTestId("widgets-placement-page-select").selectOption(placementPage.id);
    await selectFirstNonPlaceholderOption({
      page,
      testId: "widgets-placement-block-select"
    });
    await page.getByTestId("widgets-raw-script-input").fill("<script>window.alert('blocked')</script>");

    const rawScriptSaveResponsePromise = page.waitForResponse((response) => {
      return response.url().includes("/api/platform/studio/widgets") && response.request().method() === "POST";
    });
    await page.getByTestId("studio-action-widgets-save").click();
    const rawScriptSaveResponse = await rawScriptSaveResponsePromise;
    expect(rawScriptSaveResponse.status()).toBe(400);
    const rawScriptSavePayload = (await rawScriptSaveResponse.json()) as {
      ok: boolean;
      code: string;
      error: string;
    };
    expect(rawScriptSavePayload.ok).toBe(false);
    expect(rawScriptSavePayload.code).toBe("widgets.raw_script_forbidden");
    await expect(page.getByTestId("widgets-error-banner")).toContainText("Raw executable script uploads are forbidden");

    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-10-raw-js-rejection.png"),
      fullPage: true
    });

    await page.getByTestId("widgets-raw-script-input").fill("");
    await page.getByTestId("widgets-repo-path-select").selectOption("/components/widgets/report-download-widget.ts");
    await page.getByTestId("widgets-placement-mode-select").selectOption("reference");
    await page.getByTestId("widgets-placement-page-select").selectOption(placementPage.id);
    await page.getByTestId("widgets-execution-payload-input").fill('{"assetId":"tv-mtr-10-report"}');

    const approvedSaveResponsePromise = page.waitForResponse((response) => {
      return response.url().includes("/api/platform/studio/widgets") && response.request().method() === "POST";
    });
    await page.getByTestId("studio-action-widgets-save").click();
    const approvedSaveResponse = await approvedSaveResponsePromise;
    expect(approvedSaveResponse.status()).toBe(200);
    const approvedSavePayload = (await approvedSaveResponse.json()) as {
      ok: boolean;
      strapiAudit: {
        unchangedCoreEntities: boolean;
      };
      data: Array<{
        id: string;
        repoPath: string;
      }>;
    };
    expect(approvedSavePayload.ok).toBe(true);
    expect(approvedSavePayload.strapiAudit.unchangedCoreEntities).toBe(true);
    const savedWidget = approvedSavePayload.data.find((widget) => widget.repoPath === "/components/widgets/report-download-widget.ts");
    expect(savedWidget?.id).toBeTruthy();

    const executeResponsePromise = page.waitForResponse((response) => {
      return response.url().includes("/api/platform/studio/widgets/execute") && response.request().method() === "POST";
    });
    await page.getByTestId("studio-action-widgets-execute").click();
    const executeResponse = await executeResponsePromise;
    expect(executeResponse.status()).toBe(200);
    const executePayload = (await executeResponse.json()) as {
      ok: boolean;
      data: {
        result: {
          event: string;
          assetId: string;
        };
      };
      strapiAudit: {
        unchangedCoreEntities: boolean;
      };
    };
    expect(executePayload.ok).toBe(true);
    expect(executePayload.data.result.event).toBe("report_download_requested");
    expect(executePayload.data.result.assetId).toBe("tv-mtr-10-report");
    expect(executePayload.strapiAudit.unchangedCoreEntities).toBe(true);
    await expect(page.getByTestId("widgets-execution-result")).toContainText("report_download_requested");

    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-10-repo-path-success.png"),
      fullPage: true
    });

    const widgetsAfterResponse = await page.request.get("/api/platform/studio/widgets");
    expect(widgetsAfterResponse.ok()).toBe(true);
    const widgetsAfterPayload = (await widgetsAfterResponse.json()) as {
      ok: boolean;
      data: Array<{
        id: string;
        repoPath: string;
        visualMockHtml?: string;
      }>;
    };
    expect(widgetsAfterPayload.ok).toBe(true);
    const widgetsAfterIds = widgetsAfterPayload.data.map((widget) => widget.id);
    const widgetsBeforeIds = widgetsBeforePayload.data.map((widget) => widget.id);
    const changedWidgets = widgetsAfterIds.filter((id) => !widgetsBeforeIds.includes(id));

    const strapiAfter = await readCoreStrapiSnapshot(page);
    expect(strapiAfter.pages.total).toBe(strapiBefore.pages.total);
    expect(strapiAfter.blocks.total).toBe(strapiBefore.blocks.total);
    expect(strapiAfter.shells.total).toBe(strapiBefore.shells.total);
    expect(strapiAfter.pages.ids).toEqual(strapiBefore.pages.ids);
    expect(strapiAfter.blocks.ids).toEqual(strapiBefore.blocks.ids);
    expect(strapiAfter.shells.ids).toEqual(strapiBefore.shells.ids);

    writeJsonEvidence("tv-mtr-10-widget-network-log.json", {
      rejection: {
        status: rawScriptSaveResponse.status(),
        payload: rawScriptSavePayload
      },
      repoPathSave: {
        status: approvedSaveResponse.status(),
        payload: approvedSavePayload
      },
      execute: {
        status: executeResponse.status(),
        payload: executePayload
      },
      widgetEntityDiff: {
        beforeIds: widgetsBeforeIds,
        afterIds: widgetsAfterIds,
        changedWidgets
      },
      strapiBefore,
      strapiAfter
    });
  });
});
