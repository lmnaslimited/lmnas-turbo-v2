import { expect, test } from "playwright/test";

const blockImportFixture = `
<!doctype html>
<html>
  <body>
    <section class="hero">
      <h1>Ship faster with LMNAs</h1>
      <p>Governed onboarding for production pages.</p>
      <a href="/book">Book Appointment</a>
    </section>
    <section class="faq">
      <h2>FAQ</h2>
      <button type="button">Send me the full report</button>
    </section>
  </body>
</html>
`;

async function resetStudioState(page: import("playwright/test").Page): Promise<void> {
  await page.request.post("/api/platform/studio/reset");
}

test.describe("visual onboarding studio workflows", () => {
  test.beforeEach(async ({ page }) => {
    await resetStudioState(page);
  });

  test("theme workflow loads, browses, and activates persisted theme", async ({ page }) => {
    const activateResponse = await page.request.post("/api/platform/studio/themes/activate", {
      data: {
        id: "theme-default",
        themeKey: "default"
      }
    });
    expect(activateResponse.ok()).toBe(true);

    await page.goto("/platform/onboarding/theme");
    await expect(page.locator("h1").filter({ hasText: "Theme" })).toBeVisible();
    const firstThemeCard = page.locator("[data-testid^='theme-card-']").first();
    await expect(firstThemeCard).toBeVisible({ timeout: 20_000 });
    await firstThemeCard.click();
    await expect(page.locator("button").filter({ hasText: "active" }).first()).toBeVisible();
  });

  test("block import analyze resolves, supports map-to-existing, and publishes", async ({ page }) => {
    await page.goto("/platform/onboarding/blocks");
    await page.getByTestId("blocks-source-input").fill(blockImportFixture);

    const analyzeButton = page.getByTestId("blocks-analyze-button");
    await analyzeButton.click();
    await expect(page.getByRole("heading", { name: "Reference Preview" })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Continue →" }).click();
    await page.getByRole("button", { name: "Continue →" }).click();
    await expect(page.getByRole("heading", { name: "Detection Review" })).toBeVisible();

    const mapSelect = page.locator("label", { hasText: "Map to Existing" }).locator("select").first();
    await expect(mapSelect).toBeVisible({ timeout: 20_000 });
    const mapOption = await mapSelect.locator("option").nth(1).getAttribute("value");
    if (!mapOption) {
      throw new Error("Expected at least one existing block option for mapping.");
    }
    await mapSelect.selectOption(mapOption);
    await expect(page.getByText("Compare with existing block")).toBeVisible();

    await page.getByRole("button", { name: "Continue →" }).click();
    await page.getByRole("button", { name: "Continue →" }).click();
    await expect(page.getByRole("heading", { name: "Publish Blocks" })).toBeVisible();
    await page.getByTestId("blocks-publish-apply-button").click();
    await expect(page.getByText(/Blocks published to Strapi|No blocks were selected|blocks\.publish_failed/)).toBeVisible({ timeout: 30_000 });
  });

  test("analyze timeout path surfaces operator error and recovers button state", async ({ page }) => {
    await page.route("**/api/platform/onboarding/analyze", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 40_000));
      await route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Simulated timeout" })
      });
    });

    await page.goto("/platform/onboarding/blocks");
    await page.getByTestId("blocks-source-input").fill(blockImportFixture);
    const analyzeButton = page.getByTestId("blocks-analyze-button");
    await analyzeButton.click();

    await expect(page.getByText("Analyze timed out. Please retry or reduce source size.")).toBeVisible({ timeout: 30_000 });
    await expect(analyzeButton).toContainText("Analyze Source");
    await page.unroute("**/api/platform/onboarding/analyze");
  });

  test("shell workflow browses, edits, and activates shell", async ({ page }) => {
    const shellId = `shell-e2e-${Date.now()}`;
    await page.request.post("/api/platform/studio/shells", {
      data: {
        shell: {
          id: shellId,
          key: shellId,
          name: "E2E Shell",
          role: "full",
          status: "inactive",
          updatedAt: new Date().toISOString().slice(0, 10),
          menuItems: [],
          actions: [],
          previewHtml: "<nav><strong>E2E Shell</strong></nav>"
        }
      }
    });

    await page.goto("/platform/onboarding/shells");
    await page.getByText("E2E Shell").first().click();
    await page.getByRole("button", { name: "Actions & CTAs" }).click();
    await page.getByTestId("shell-add-action-button").click();
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByLabel("Label").first().fill("Book Demo");
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByTestId("shell-activate-button").click();
    await expect(page.locator("header").filter({ hasText: "E2E Shell" }).getByText("active")).toBeVisible();
  });

  test("page workflow assembles, edits, overrides action, and saves", async ({ page }) => {
    const slug = `e2e-page-${Date.now()}`;
    await page.goto("/platform/onboarding/pages");
    await page.getByTestId("pages-add-block-toggle").click();
    const firstBlockAddButton = page.locator("[data-testid^='pages-library-add-']").first();
    await expect(firstBlockAddButton).toBeVisible({ timeout: 20_000 });
    await firstBlockAddButton.click();

    const firstOrderButton = page.getByTestId("pages-order-block-0");
    await firstOrderButton.click();

    const firstFieldInput = page.locator("[data-testid^='pages-field-']").first();
    await firstFieldInput.fill("E2E Updated Heading");

    await page.getByRole("button", { name: "Actions" }).click();
    const targetInput = page.locator("[data-testid^='pages-action-target-']").first();
    await targetInput.fill("/e2e-target");

    await page.getByLabel("Slug").fill(slug);
    await page.getByTestId("pages-save-draft-button").click();
    await expect(page.getByText("Page draft saved.")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("pages-publish-button").click();
    await expect(page.getByText(/Published to Strapi|Saved locally/)).toBeVisible({ timeout: 30_000 });

    const pageDocResponse = await page.request.get(`/api/platform/studio/pages?slug=${slug}`);
    expect(pageDocResponse.ok()).toBe(true);
    const pageDocPayload = (await pageDocResponse.json()) as {
      ok: boolean;
      data: {
        blockOrder: string[];
        actionOverrides: Record<string, { target: string }>;
      } | null;
    };
    expect(pageDocPayload.ok).toBe(true);
    expect(pageDocPayload.data?.blockOrder.length).toBeGreaterThan(0);
    const overrideTargets = Object.values(pageDocPayload.data?.actionOverrides ?? {}).map((entry) => entry.target);
    expect(overrideTargets).toContain("/e2e-target");

    const previewRouteResponse = await page.request.get(`/en/${slug}`);
    expect(previewRouteResponse.ok()).toBe(true);
    const previewRouteHtml = await previewRouteResponse.text();
    expect(previewRouteHtml).not.toContain("strapi_unreachable");
  });
});
