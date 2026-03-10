import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

const evidenceDir = path.resolve(process.cwd(), "docs/phase0_1/proof/evidence/h003");

function ensureEvidenceDir(): void {
  mkdirSync(evidenceDir, { recursive: true });
}

function writeJsonEvidence(fileName: string, payload: unknown): void {
  ensureEvidenceDir();
  writeFileSync(path.join(evidenceDir, fileName), JSON.stringify(payload, null, 2), "utf8");
}

async function resetStudioState(page: import("playwright/test").Page): Promise<void> {
  await page.request.post("/api/platform/studio/reset");
}

async function seedLightThemeAsActive(page: import("playwright/test").Page): Promise<void> {
  const response = await page.request.post("/api/platform/studio/themes", {
    data: {
      mode: "upsert",
      sourceType: "html_upload",
      theme: {
        id: "theme-h003-light-active",
        themeKey: "h003-light-active",
        name: "H003 Light Active",
        status: "active",
        sourceRef: "tv-mtr-h003",
        createdAt: "2026-03-10",
        updatedAt: "2026-03-10",
        tokenCoverage: 0.81,
        themeDebt: "none",
        darkMode: false,
        tokens: [
          {
            key: "surface-bg",
            label: "Surface Background",
            category: "color",
            value: "#ffffff",
            cssVariable: "--theme-surface-bg",
            mapped: true
          },
          {
            key: "surface-text",
            label: "Surface Text",
            category: "color",
            value: "#111827",
            cssVariable: "--theme-surface-text",
            mapped: true
          },
          {
            key: "font-display",
            label: "Display Font",
            category: "typography",
            value: "Manrope, sans-serif",
            cssVariable: "--font-display",
            mapped: true
          }
        ]
      }
    }
  });
  expect(response.ok()).toBe(true);
}

test.describe("H-003 matrix tests (TV-MTR)", () => {
  test.beforeEach(async ({ page }) => {
    await resetStudioState(page);
    ensureEvidenceDir();
  });

  test("TV-MTR-06 publish review ignores swatch and serializes active theme payload", async ({ page }) => {
    const seedSwatch = await page.request.post("/api/platform/studio/themes", {
      data: {
        mode: "create",
        sourceType: "html_upload",
        theme: {
          id: "theme-h003-swatch",
          themeKey: "h003-swatch",
          name: "H003 Preview Swatch",
          status: "draft",
          sourceRef: "tv-mtr-06",
          createdAt: "2026-03-10",
          updatedAt: "2026-03-10",
          tokenCoverage: 0.89,
          themeDebt: "none",
          darkMode: true,
          tokens: [
            {
              key: "surface-bg",
              label: "Surface Background",
              category: "color",
              value: "#0f172a",
              cssVariable: "--theme-surface-bg",
              mapped: true
            },
            {
              key: "surface-text",
              label: "Surface Text",
              category: "color",
              value: "#f8fafc",
              cssVariable: "--theme-surface-text",
              mapped: true
            }
          ]
        }
      }
    });
    expect(seedSwatch.ok()).toBe(true);

    await page.goto("/platform/onboarding/theme");
    await page.getByRole("button", { name: /H003 Preview Swatch/ }).first().click();
    await page.getByTestId("studio-action-apply-swatch").click();
    await expect(page.getByTestId("theme-swatch-banner")).toBeVisible();

    await page.locator("a[href='/platform/onboarding/publish']").first().click();
    await expect(page).toHaveURL(/\/platform\/onboarding\/publish$/);
    await expect(page.getByTestId("publish-active-theme")).toContainText("LMNAs Default");
    await expect(page.getByTestId("publish-ignored-swatch")).toContainText("H003 Preview Swatch");
    await page.getByTestId("publish-open-overlay").click();
    await page.getByTestId("publish-commit-button").click();
    await expect(page.getByTestId("publish-payload-json")).toBeVisible();

    const payload = JSON.parse((await page.getByTestId("publish-payload-json").innerText()) || "{}") as {
      activeTheme?: { themeKey?: string };
      ignoredPreviewSwatchThemeId?: string | null;
      payload?: Record<string, unknown>;
      blocked?: boolean;
      applied?: boolean;
    };

    expect(payload.activeTheme?.themeKey).toBe("default");
    expect(payload.ignoredPreviewSwatchThemeId).toBe("theme-h003-swatch");
    expect((payload.payload ?? {})).not.toHaveProperty("previewSwatchThemeId");
    expect(payload.blocked).toBe(false);
    expect(payload.applied).toBe(true);

    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-06-active-theme-ignores-swatch.png"),
      fullPage: true
    });
    writeJsonEvidence("tv-mtr-06-active-theme-payload.json", payload);
  });

  test("TV-MTR-07 allow mode warns but permits publish when fidelity mismatches", async ({ page }) => {
    await seedLightThemeAsActive(page);
    await page.goto("/platform/onboarding/publish");

    await page.getByTestId("publish-mode-allow").click();
    await page.getByTestId("publish-source-html").fill(
      [
        "<style>",
        "@media(dark){ body { background:#000; color:#fff; } }",
        "body { font-family: 'Comic Sans MS', cursive; }",
        "</style>",
        "<section>Allow mode fidelity probe</section>"
      ].join("\n")
    );

    await page.getByTestId("publish-open-overlay").click();
    await page.getByTestId("publish-commit-button").click();
    await expect(page.getByTestId("publish-warning-overlay")).toBeVisible();
    await expect(page.getByTestId("publish-rejection-overlay")).toHaveCount(0);

    const payload = JSON.parse((await page.getByTestId("publish-payload-json").innerText()) || "{}") as {
      applied?: boolean;
      blocked?: boolean;
      warnings?: Array<{ code: string }>;
      fidelity?: { hasDarkMediaQuery?: boolean };
    };
    expect(payload.applied).toBe(true);
    expect(payload.blocked).toBe(false);
    expect(payload.fidelity?.hasDarkMediaQuery).toBe(true);
    expect(payload.warnings?.some((warning) => warning.code === "publish.fidelity_dark_mode_mismatch")).toBe(true);

    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-07-allow-warning-overlay.png"),
      fullPage: true
    });
    writeJsonEvidence("tv-mtr-07-fidelity-allow-warning.json", payload);
  });

  test("TV-MTR-11 disallow mode hard-blocks publish", async ({ page }) => {
    await seedLightThemeAsActive(page);
    await page.goto("/platform/onboarding/publish");

    await page.getByTestId("publish-mode-disallow").click();
    await page.getByTestId("publish-source-html").fill(
      [
        "<style>",
        "@media(dark){ body { background:#000; color:#fff; } }",
        "body { font-family: 'Comic Sans MS', cursive; }",
        "</style>",
        "<section>Disallow mode fidelity probe</section>"
      ].join("\n")
    );

    await page.getByTestId("publish-open-overlay").click();
    await page.getByTestId("publish-commit-button").click();
    await expect(page.getByTestId("publish-rejection-overlay")).toBeVisible();

    const payload = JSON.parse((await page.getByTestId("publish-payload-json").innerText()) || "{}") as {
      applied?: boolean;
      blocked?: boolean;
      rejectionReason?: string | null;
      warnings?: Array<{ code: string }>;
    };
    expect(payload.applied).toBe(false);
    expect(payload.blocked).toBe(true);
    expect(payload.rejectionReason).toContain("Fidelity threshold rejection");
    expect(payload.warnings?.some((warning) => warning.code === "publish.fidelity_hard_block")).toBe(true);

    await page.screenshot({
      path: path.join(evidenceDir, "tv-mtr-11-disallow-hard-block.png"),
      fullPage: true
    });
    writeJsonEvidence("tv-mtr-11-fidelity-disallow-block.json", payload);
  });
});
