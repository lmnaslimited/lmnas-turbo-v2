import { expect, test } from "playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const HTML_FIXTURE_PATH = path.resolve(process.cwd(), "docs/testing-artifacts/code.html");

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

async function resetStudioState(page: import("playwright/test").Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await page.request.post("/api/platform/studio/reset");
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as { ok?: boolean; source?: string };
    expect(payload.ok).toBe(true);
    if (payload.source === "strapi") {
      return;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Studio reset did not return canonical Strapi source.");
}

type DraftPagesPayload = {
  ok: boolean;
  source?: "strapi" | "fallback";
  data?: Array<{
    id: string;
    name: string;
    slug: string;
    previewValid: boolean;
    seoJsonLdValid: boolean;
  }>;
};

async function fetchDraftPage(
  page: import("playwright/test").Page,
  pageId: string
): Promise<NonNullable<DraftPagesPayload["data"]>[number]> {
  const response = await page.request.get("/api/platform/studio/pages?status=draft");
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as DraftPagesPayload;
  expect(payload.ok).toBe(true);
  expect(payload.source).toBe("strapi");
  const match = (payload.data ?? []).find((entry) => entry.id === pageId);
  expect(match).toBeTruthy();
  return match!;
}

test.describe("@real page preview acceptance workflow", () => {
  test.skip(
    process.env.LMNAS_E2E_REAL_STACK !== "1",
    "Run with LMNAS_E2E_REAL_STACK=1 and reachable canonical Strapi stack."
  );

  test("preview acceptance validates draft preview and resets after edits", async ({ page }) => {
    const assertNoRuntimeErrors = createRuntimeErrorGate(page);
    await resetStudioState(page);
    const html = await readFile(HTML_FIXTURE_PATH, "utf8");

    await page.goto("/platform/onboarding/pages", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Page Composer" })).toBeVisible();
    await expect(page.getByTestId("pages-new-name-input")).toBeEnabled();
    await page.getByTestId("pages-new-name-input").fill("Draft Preview Acceptance");
    await expect(page.getByTestId("pages-add-new")).toBeEnabled();

    await page.getByTestId("pages-add-new").click();
    await expect(page.locator("[data-active='true']")).toContainText("Draft Preview Acceptance");

    await page.getByTestId("pages-import-html-input").fill(html);
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/pages")),
      page.getByTestId("pages-import-blocks-only").click()
    ]);
    await expect(page.getByText(/Imported \d+ reusable section\(s\)/)).toBeVisible();

    await page.getByTestId("pages-add-block-select").selectOption({ index: 0 });
    await page.getByTestId("pages-add-block-button").click();

    await page.getByPlaceholder("Select product...").fill("lens-ai-revenue-platform");
    await page.getByRole("button", { name: "enterprise" }).click();
    await page.getByPlaceholder("Button text").fill("Read Customer Stories");
    await page.getByPlaceholder("Link URL").fill("/contact");
    await page.getByPlaceholder("utm_source").fill("lmnas");
    await page.getByPlaceholder("utm_medium").fill("studio");
    await page.getByPlaceholder("utm_campaign").fill("transformercorp-testimonials");
    await page.getByPlaceholder("Meta title").fill("Transformer Testimonials | LENS AI Revenue Platform");
    await page.getByPlaceholder("Meta description").fill(
      "Trusted by European transformer manufacturers. Explore customer stories and proof points from complex manufacturing environments."
    );

    await page.locator("label:has-text('Taxonomy valid') input[type='checkbox']").check();

    const [saveDraftResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/pages")),
      page.getByRole("button", { name: "Save Draft" }).click()
    ]);
    expect(saveDraftResponse.ok()).toBe(true);
    const savePayload = (await saveDraftResponse.json()) as {
      ok: boolean;
      source?: "strapi" | "fallback";
      data?: { page?: { id: string } };
    };
    expect(savePayload.ok).toBe(true);
    expect(savePayload.source).toBe("strapi");
    const pageId = savePayload.data?.page?.id;
    expect(pageId).toBeTruthy();

    await expect(page.locator("text=Preview valid: no")).toBeVisible();
    await expect(page.locator("text=SEO / JSON-LD valid: no")).toBeVisible();
    await expect
      .poll(async () => normalizeHtml(await page.getByTestId("pages-preview-frame").getAttribute("srcdoc")), {
        timeout: 15_000
      })
      .toContain("lmnas-preview-tailwind-config");
    const composerPreviewBeforePopup = normalizeHtml(await page.getByTestId("pages-preview-frame").getAttribute("srcdoc"));
    expect(composerPreviewBeforePopup).toContain("/studio-runtime.css");
    expect(composerPreviewBeforePopup).toContain("EUROGRID");

    const [previewSaveResponse, previewPopup] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/pages")),
      page.waitForEvent("popup"),
      page.getByTestId("pages-preview-page-button").click()
    ]);
    expect(previewSaveResponse.ok()).toBe(true);
    await previewPopup.waitForLoadState("domcontentloaded");
    await expect(previewPopup.getByTestId("preview-accept-button")).toBeVisible();
    await expect(previewPopup.getByTestId("preview-accept-button")).toBeEnabled();
    const popupPreviewBeforeAccept = normalizeHtml(await previewPopup.locator("iframe[title='studio-page-preview']").getAttribute("srcdoc"));
    expect(popupPreviewBeforeAccept).toContain("lmnas-preview-tailwind-config");
    expect(popupPreviewBeforeAccept).toContain("/studio-runtime.css");
    expect(popupPreviewBeforeAccept).toContain("EUROGRID");

    await previewPopup.getByTestId("preview-accept-button").click();
    await expect(previewPopup.getByText(/Preview accepted\./)).toBeVisible();
    await page.bringToFront();

    await expect.poll(async () => (await fetchDraftPage(page, pageId!)).previewValid).toBe(true);
    await expect.poll(async () => (await fetchDraftPage(page, pageId!)).seoJsonLdValid).toBe(true);
    await expect(page.locator("text=Preview valid: yes")).toBeVisible();
    await expect(page.locator("text=SEO / JSON-LD valid: yes")).toBeVisible();

    await page.getByPlaceholder("Button text").fill("Read Verified Customer Stories");
    const [editSaveResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/pages")),
      page.getByRole("button", { name: "Save Draft" }).click()
    ]);
    expect(editSaveResponse.ok()).toBe(true);

    await expect.poll(async () => (await fetchDraftPage(page, pageId!)).previewValid).toBe(false);
    await expect.poll(async () => (await fetchDraftPage(page, pageId!)).seoJsonLdValid).toBe(false);
    await expect(page.locator("text=Preview valid: no")).toBeVisible();
    await expect(page.locator("text=SEO / JSON-LD valid: no")).toBeVisible();

    const [secondPreviewSave, secondPreviewPopup] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/pages")),
      page.waitForEvent("popup"),
      page.getByTestId("pages-preview-page-button").click()
    ]);
    expect(secondPreviewSave.ok()).toBe(true);
    await secondPreviewPopup.waitForLoadState("domcontentloaded");
    await expect(secondPreviewPopup.getByTestId("preview-accept-button")).toBeEnabled();
    await secondPreviewPopup.getByTestId("preview-accept-button").click();
    await expect(secondPreviewPopup.getByText(/Preview accepted\./)).toBeVisible();
    await page.bringToFront();
    await expect.poll(async () => (await fetchDraftPage(page, pageId!)).previewValid).toBe(true);
    await expect.poll(async () => (await fetchDraftPage(page, pageId!)).seoJsonLdValid).toBe(true);

    assertNoRuntimeErrors();
  });
});
