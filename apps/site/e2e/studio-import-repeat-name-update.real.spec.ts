import { expect, test } from "playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const HTML_FIXTURE_PATH = path.resolve(process.cwd(), "docs/testing-artifacts/code.html");

type BlocksPayload = {
  ok: boolean;
  data?: Array<{
    id: string;
    key: string;
    name: string;
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
  await expect(page.locator("[data-testid^='import-proposal-name-']").first()).toBeVisible();
}

async function renameFirstProposal(page: import("playwright/test").Page, nextName: string): Promise<void> {
  const renameInput = page.locator("[data-testid^='import-proposal-name-']").first();
  await renameInput.fill(nextName);
  const [renameResponse] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/blocks")),
    renameInput.press("Tab")
  ]);
  expect(renameResponse.ok()).toBe(true);
  await expect(page.getByText(`Renamed proposal to ${nextName}.`)).toBeVisible();
}

async function importSelectedBlocks(page: import("playwright/test").Page): Promise<void> {
  const [publishResponse] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/platform/studio/blocks/publish")),
    page.getByTestId("import-publish-selected").click()
  ]);
  expect(publishResponse.ok()).toBe(true);
}

async function fetchImportedBlocks(page: import("playwright/test").Page): Promise<NonNullable<BlocksPayload["data"]>> {
  const response = await page.request.get("/api/platform/studio/blocks?search=import-source");
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as BlocksPayload;
  expect(payload.ok).toBe(true);
  return payload.data ?? [];
}

test.describe("@real repeat import name update", () => {
  test.skip(
    process.env.LMNAS_E2E_REAL_STACK !== "1",
    "Run with LMNAS_E2E_REAL_STACK=1 and reachable canonical Strapi stack."
  );

  test("re-importing identical html updates the existing canonical block and applies the edited name", async ({ page }) => {
    const assertNoRuntimeErrors = createRuntimeErrorGate(page);
    const html = await readFile(HTML_FIXTURE_PATH, "utf8");
    const firstName = `Repeat Import ${Date.now()} A`;
    const secondName = `Repeat Import ${Date.now()} B`;

    await resetStudioState(page);
    await processHtmlImport(page, html);
    await renameFirstProposal(page, firstName);
    await importSelectedBlocks(page);

    const firstImportedBlocks = await fetchImportedBlocks(page);
    const renamedBlock = firstImportedBlocks.find((block) => block.name === firstName);
    expect(renamedBlock?.key).toBeTruthy();
    const importedCount = firstImportedBlocks.length;

    await processHtmlImport(page, html);
    await renameFirstProposal(page, secondName);
    await importSelectedBlocks(page);
    await expect(page.getByText(/Updated \d+ existing governed block\(s\)\./)).toBeVisible();

    const secondImportedBlocks = await fetchImportedBlocks(page);
    expect(secondImportedBlocks).toHaveLength(importedCount);
    const updatedBlock = secondImportedBlocks.find((block) => block.key === renamedBlock?.key);
    expect(updatedBlock?.name).toBe(secondName);

    await gotoStable(page, "/platform/onboarding/blocks");
    await expect(page.getByRole("heading", { name: "Reusable Blocks" })).toBeVisible();
    await page.getByTestId("blocks-search-input").fill("import-source");
    await page.getByTestId("blocks-search-input").press("Enter");
    await expect(page.getByText(secondName)).toBeVisible();
    await expect(page.getByText(firstName)).toHaveCount(0);

    assertNoRuntimeErrors();
  });
});
