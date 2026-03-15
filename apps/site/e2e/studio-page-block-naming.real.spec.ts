import { expect, test } from "playwright/test";

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

async function seedCanonicalBlock(page: import("playwright/test").Page): Promise<{ id: string; key: string; name: string }> {
  const timestamp = Date.now();
  const blockKey = `naming-block-${timestamp}`;
  const blockName = `Naming Block ${timestamp}`;

  const response = await page.request.post("/api/platform/studio/blocks", {
    data: {
      block: {
        id: blockKey,
        key: blockKey,
        name: blockName,
        family: "hero",
        status: "active",
        lifecycle: "draft",
        scope: "global",
        schemaStatus: "valid",
        themeKey: "default",
        sourceType: "seed",
        sourceRef: "seed",
        confidence: 1,
        editableFields: ["name"],
        actions: [],
        inUseCount: 0,
        usageCount: 0,
        createdAt: "2026-03-13",
        updatedAt: "2026-03-13"
      }
    }
  });

  const text = await response.text();
  expect(response.ok(), text).toBe(true);
  const payload = JSON.parse(text) as {
    ok: boolean;
    source?: string;
    schemaSource?: string;
    data?: Array<{ id: string; key: string; name: string }>;
  };
  expect(payload.ok).toBe(true);
  expect(payload.source).toBe("strapi");
  expect(payload.schemaSource).toBe("canonical");
  const created = (payload.data ?? []).find((entry) => entry.key === blockKey);
  expect(created?.id).toBeTruthy();
  return {
    id: created!.id,
    key: blockKey,
    name: blockName
  };
}

test.describe("@real page and block naming", () => {
  test.skip(
    process.env.LMNAS_E2E_REAL_STACK !== "1",
    "Run with LMNAS_E2E_REAL_STACK=1 and reachable canonical Strapi stack."
  );

  test("page names and block names are editable and persist canonically", async ({ page }) => {
    const assertNoRuntimeErrors = createRuntimeErrorGate(page);
    await resetStudioState(page);
    const seededBlock = await seedCanonicalBlock(page);

    await page.goto("/platform/onboarding/pages", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Page Composer" })).toBeVisible();

    await expect(page.getByTestId("pages-new-name-input")).toBeEnabled();
    await page.getByTestId("pages-new-name-input").fill("Landing Page Alpha");
    await expect(page.getByTestId("pages-add-new")).toBeEnabled();
    await page.getByTestId("pages-add-new").click();

    await expect(page.locator("[data-active='true']")).toContainText("Landing Page Alpha");
    await expect(page.getByTestId("pages-name-input")).toHaveValue("Landing Page Alpha");

    const [createResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/pages")),
      page.getByRole("button", { name: "Save Draft" }).click()
    ]);
    expect(createResponse.ok()).toBe(true);
    const createPayload = (await createResponse.json()) as {
      ok: boolean;
      source?: string;
      data?: { page?: { id: string } };
    };
    expect(createPayload.ok).toBe(true);
    expect(createPayload.source).toBe("strapi");
    const persistedPageId = createPayload.data?.page?.id;
    expect(persistedPageId).toBeTruthy();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Page Composer" })).toBeVisible();
    await expect(page.getByTestId(`pages-item-${persistedPageId}`)).toBeVisible();

    await page.getByTestId(`pages-item-${persistedPageId}`).click();
    await page.getByTestId("pages-name-input").fill("Landing Page Beta");

    const [renameResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/pages")),
      page.getByRole("button", { name: "Save Draft" }).click()
    ]);
    expect(renameResponse.ok()).toBe(true);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(`pages-item-${persistedPageId}`)).toContainText("Landing Page Beta");
    await expect(page.getByTestId(`pages-item-${persistedPageId}`)).not.toContainText("Landing Page Alpha");

    await page.goto("/platform/onboarding/blocks", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Reusable Blocks" })).toBeVisible();

    await page.getByTestId("blocks-search-input").fill(seededBlock.name);
    await expect(page.getByTestId(`blocks-item-${seededBlock.id}`)).toBeVisible();

    await page.getByTestId(`blocks-item-rename-${seededBlock.id}`).click();
    const renameInput = page.getByTestId(`blocks-item-rename-input-${seededBlock.id}`);
    await expect(renameInput).toBeVisible();
    await renameInput.fill("Canonical Renamed Block");

    const [blockRenameResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/blocks")),
      renameInput.press("Enter")
    ]);
    expect(blockRenameResponse.ok()).toBe(true);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("blocks-search-input").fill("Canonical Renamed Block");
    await expect(page.locator("[data-testid^='blocks-item-']").filter({ hasText: "Canonical Renamed Block" }).first()).toBeVisible();

    const renamedBlocksResponse = await page.request.get("/api/platform/studio/blocks?search=Canonical%20Renamed%20Block");
    expect(renamedBlocksResponse.ok()).toBe(true);
    const renamedBlocksPayload = (await renamedBlocksResponse.json()) as {
      ok: boolean;
      source?: string;
      schemaSource?: string;
      data?: Array<{ name: string }>;
    };
    expect(renamedBlocksPayload.ok).toBe(true);
    expect(renamedBlocksPayload.source).toBe("strapi");
    expect(renamedBlocksPayload.schemaSource).toBe("canonical");
    expect((renamedBlocksPayload.data ?? []).some((block) => block.name === "Canonical Renamed Block")).toBe(true);

    assertNoRuntimeErrors();
  });
});
