import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

test("workflow foundation mock route renders empty-state containers", async ({ page }) => {
  await page.goto("/platform/onboarding/workflow-foundation-mock");

  await expect(page.getByTestId("workflow-foundation-heading")).toBeVisible();
  await expect(page.getByTestId("studio-list-empty")).toBeVisible();
  await expect(page.getByTestId("studio-detail-empty")).toBeVisible();
  await expect(page.getByTestId("studio-action-menu-empty")).toBeVisible();

  const evidenceDir = path.resolve(process.cwd(), "docs/phase0_1/proof/evidence/h001");
  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({
    path: path.join(evidenceDir, "workflow-foundation-empty-state.png"),
    fullPage: true
  });
});
