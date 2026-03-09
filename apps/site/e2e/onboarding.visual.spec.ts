import { expect, test } from "playwright/test";

const styledHtmlFixture = `
<!doctype html>
<html>
  <head>
    <style>
      body { margin: 0; font-family: Manrope, sans-serif; background: #f7f9ff; color: #0f172a; }
      .utility { background: #0b66ff; color: #fff; padding: 8px 18px; font-size: 14px; }
      nav { display: flex; gap: 18px; align-items: center; padding: 14px 20px; background: #fff; border-bottom: 1px solid #d1dbe8; }
      nav a { color: #0f172a; text-decoration: none; font-weight: 600; }
      .hero { margin: 20px; padding: 42px 28px; border-radius: 16px; background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; }
      .hero .cta { display: inline-block; margin-top: 12px; background: #0b66ff; color: #fff; padding: 10px 14px; border-radius: 8px; text-decoration: none; }
      .faq { margin: 20px; padding: 18px; border: 1px solid #d1dbe8; border-radius: 14px; background: #fff; }
      .faq button { margin-top: 12px; border: 0; border-radius: 8px; background: #0f172a; color: #fff; padding: 10px 12px; }
      footer { margin: 20px; padding: 16px; border-radius: 12px; background: #fff; border: 1px solid #d1dbe8; }
    </style>
  </head>
  <body>
    <div class="utility">Limited-time offer for Q2 pilots</div>
    <nav>
      <a href="/products">Products</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </nav>
    <section class="hero">
      <h1>Build faster with LMNAs</h1>
      <p>Launch governed pages in minutes.</p>
      <a class="cta" href="/book">Book Appointment</a>
    </section>
    <section class="faq">
      <h2>FAQ</h2>
      <button type="button">Send me the full report</button>
    </section>
    <footer>
      <a href="/privacy">Privacy</a>
    </footer>
  </body>
</html>
`;

async function runAnalysisFromFixture(page: import("playwright/test").Page) {
  await page.goto("/platform/onboarding");
  await page.locator("[data-testid='source-content-input']").fill(styledHtmlFixture);
  await page.locator("[data-testid='analyze-source-button']").click();
  await expect(page.getByRole("heading", { name: "2. Source Preview" })).toBeVisible();
}

test("visual onboarding flow renders styled preview, traceability, and final assembly", async ({ page }) => {
  await runAnalysisFromFixture(page);

  const sourceFrame = page.frameLocator("[data-testid='source-preview-frame']");
  await expect(sourceFrame.locator("text=Build faster with LMNAs")).toBeVisible();

  const sourcePane = page.locator(".lmnas-source-pane").first();
  await expect(sourcePane).toHaveScreenshot("source-preview-pane.png");

  await page.getByRole("button", { name: /Detection Review/i }).click();
  await expect(page.getByRole("heading", { name: "3. Detection Review" })).toBeVisible();
  const detectedCardCount = await page.locator("[data-testid^='detection-card-']").count();
  expect(detectedCardCount).toBeGreaterThan(3);
  await expect(page.getByText("Action Traceability")).toBeVisible();
  await expect(page.getByText("Parent:", { exact: false }).first()).toBeVisible();

  const actionCard = page.locator("[data-testid^='detection-card-action_']").first();
  await actionCard.click();
  await expect(page.locator(".lmnas-detect-card-focused")).toBeVisible();
  await expect(page.locator(".lmnas-side-pane")).toHaveScreenshot("detection-review-pane.png");

  await page.getByRole("button", { name: /Publish Summary/i }).click();
  await expect(page.getByRole("heading", { name: "6. Publish Summary" })).toBeVisible();
  await page.locator("[data-testid='preview-create-button']").click();

  const assemblyFrame = page.frameLocator("[data-testid='assembly-preview-frame']");
  await expect(assemblyFrame.locator("text=Build faster with LMNAs")).toBeVisible();
  await expect(page.locator(".lmnas-final-preview-panel")).toHaveScreenshot("final-assembly-preview.png");
});

test("@real apply mode succeeds when local Strapi stack is reachable", async ({ page }) => {
  test.skip(process.env.LMNAS_E2E_REAL_STACK !== "1", "Run with LMNAS_E2E_REAL_STACK=1 and local docker stack.");

  await runAnalysisFromFixture(page);
  await page.getByRole("button", { name: /Publish Summary/i }).click();
  await page.locator("[data-testid='publish-apply-button']").click();
  await expect(page.getByText("Publish apply succeeded against Strapi.")).toBeVisible({ timeout: 60_000 });
});
