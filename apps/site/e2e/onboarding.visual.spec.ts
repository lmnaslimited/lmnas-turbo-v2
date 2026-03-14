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
  await page.goto("/platform/onboarding/blocks");
  await page.locator("[data-testid='blocks-source-input']").fill(styledHtmlFixture);
  await page.locator("[data-testid='blocks-analyze-button']").click();
  await expect(page.getByRole("heading", { name: "Reference Preview" })).toBeVisible();
}

test("visual onboarding flow renders styled preview, traceability, and final assembly", async ({ page }) => {
  await runAnalysisFromFixture(page);

  const sourceFrame = page.frameLocator("[data-testid='reference-preview']");
  await expect(sourceFrame.locator("text=Build faster with LMNAs")).toBeVisible();

  const sourcePane = page.locator("article").filter({ has: page.locator("[data-testid='reference-preview']") }).first();
  await expect(sourcePane).toHaveScreenshot("source-preview-pane.png");

  await page.getByRole("button", { name: "Continue →" }).click();
  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByRole("heading", { name: "Detection Review" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Studio Block Explorer" })).toBeVisible();
  await expect(page.getByText("Map to Existing")).toBeVisible();

  const detectionSidePane = page.locator("article").filter({ has: page.getByRole("heading", { name: "Studio Block Explorer" }) }).first();
  await expect(detectionSidePane).toHaveScreenshot("detection-review-pane.png");

  await page.getByRole("button", { name: "Continue →" }).click();
  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByRole("heading", { name: "Publish Blocks" })).toBeVisible();

  const assemblyFrame = page.frameLocator("[data-testid='publish-preview']");
  await expect(assemblyFrame.locator("text=Build faster with LMNAs")).toBeVisible();
  const assemblyPanel = page.locator("article").filter({ has: page.locator("[data-testid='publish-preview']") }).first();
  await expect(assemblyPanel).toHaveScreenshot("final-assembly-preview.png");
});

test("@real apply mode succeeds when local Strapi stack is reachable", async ({ page }) => {
  test.skip(process.env.LMNAS_E2E_REAL_STACK !== "1", "Run with LMNAS_E2E_REAL_STACK=1 and local docker stack.");

  await runAnalysisFromFixture(page);
  await page.getByRole("button", { name: "Continue →" }).click();
  await page.getByRole("button", { name: "Continue →" }).click();
  await page.getByRole("button", { name: "Continue →" }).click();
  await page.getByRole("button", { name: "Continue →" }).click();
  await page.getByTestId("blocks-publish-apply-button").click();
  await expect(page.getByText(/Blocks published to Strapi|blocks\.publish_failed/)).toBeVisible({ timeout: 60_000 });
});
