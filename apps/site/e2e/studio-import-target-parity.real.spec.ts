import { expect, test } from "playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const HTML_FIXTURE_PATH = path.resolve(process.cwd(), "docs/testing-artifacts/code.html");

function normalizeHtml(input: string): string {
  return input.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

function extractBodyInnerHtml(srcDoc: string | null): string {
  if (!srcDoc) {
    return "";
  }
  const match = srcDoc.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return normalizeHtml(match?.[1] ?? "");
}

function createRuntimeErrorGate(page: import("playwright/test").Page): () => void {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const ignorePatterns = [
    /favicon\.ico/i,
    /chrome-extension:\/\//i,
    /ERR_NAME_NOT_RESOLVED/i,
    /^Event$/i,
    /Blocked script execution in 'about:srcdoc'/i
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
  const response = await page.request.post("/api/platform/studio/reset");
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as { ok: boolean; source?: string };
  expect(payload.ok).toBe(true);
  expect(payload.source).toBe("strapi");
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

test.describe("@real import target preview parity", () => {
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    process.env.LMNAS_E2E_REAL_STACK !== "1",
    "Run with LMNAS_E2E_REAL_STACK=1 and reachable canonical Strapi stack."
  );

  test("focused target comparison reuses the same render source as the proposal card", async ({ page }) => {
    const assertNoRuntimeErrors = createRuntimeErrorGate(page);
    const html = await readFile(HTML_FIXTURE_PATH, "utf8");

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
      page.waitForResponse((response) => {
        return response.request().method() === "POST" && response.url().includes("/api/platform/studio/import/process");
      }),
      page.getByTestId("import-process-source").click()
    ]);

    expect(processResponse.ok()).toBe(true);
    await expect(page.locator("[data-testid^='import-proposal-compare-']").first()).toBeVisible();

    await page.locator("[data-testid^='import-proposal-compare-']").first().click();

    const proposalCardPreviewSrcDoc = await page.locator("iframe[title$='-preview']").first().getAttribute("srcdoc");
    const targetPreviewSrcDoc = await page.getByTestId("import-target-preview").getAttribute("srcdoc");

    expect(proposalCardPreviewSrcDoc).toBeTruthy();
    expect(targetPreviewSrcDoc).toBeTruthy();
    expect(normalizeHtml(proposalCardPreviewSrcDoc ?? "")).toContain(extractBodyInnerHtml(targetPreviewSrcDoc));
    expect(normalizeHtml(targetPreviewSrcDoc ?? "")).toContain("lmnas-preview-tailwind-config");
    expect(normalizeHtml(targetPreviewSrcDoc ?? "")).toContain("/studio-runtime.css");
    expect(normalizeHtml(targetPreviewSrcDoc ?? "")).not.toContain("LMNAs");
    expect(normalizeHtml(targetPreviewSrcDoc ?? "")).not.toContain("Studio Footer");

    assertNoRuntimeErrors();
  });
});
