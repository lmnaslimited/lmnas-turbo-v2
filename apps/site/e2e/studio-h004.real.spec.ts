import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

const evidenceDir = path.resolve(process.cwd(), "docs/phase0_1/proof/evidence/h004");

function ensureEvidenceDir(): void {
  mkdirSync(evidenceDir, { recursive: true });
}

function writeJsonEvidence(fileName: string, payload: unknown): void {
  ensureEvidenceDir();
  writeFileSync(path.join(evidenceDir, fileName), JSON.stringify(payload, null, 2), "utf8");
}

test("@real TV-E2E-02 hardening smoke validates live Strapi settings + publish persistence", async ({ page }) => {
  test.skip(
    process.env.LMNAS_E2E_REAL_STACK !== "1",
    "Run with LMNAS_E2E_REAL_STACK=1 and a reachable local Strapi stack."
  );

  ensureEvidenceDir();

  const seedThemeResponse = await page.request.post("/api/platform/studio/themes", {
    data: {
      mode: "upsert",
      sourceType: "html_upload",
      theme: {
        id: "theme-h004-live-active",
        themeKey: "h004-live-active",
        name: "H004 Live Active",
        status: "active",
        sourceRef: "h004-live-smoke",
        createdAt: "2026-03-11",
        updatedAt: "2026-03-11",
        tokenCoverage: 0.9,
        themeDebt: "H004 live persistence baseline",
        darkMode: true,
        tokens: [
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
  expect(seedThemeResponse.ok()).toBe(true);

  const settingsResponse = await page.request.post("/api/platform/studio/settings", {
    data: {
      fidelity: {
        mode: "allow-below-threshold",
        threshold: 0.27
      }
    }
  });
  expect(settingsResponse.ok()).toBe(true);
  const settingsPayload = (await settingsResponse.json()) as {
    ok: boolean;
    source: string;
    data: { fidelity: { mode: string; threshold: number } };
    persistence?: { themeId?: string };
  };
  expect(settingsPayload.ok).toBe(true);
  expect(settingsPayload.source).toBe("strapi");

  const publishResponse = await page.request.post("/api/platform/studio/publish", {
    data: {
      mode: "apply",
      sourceHtml: "<style>body{font-family:Manrope,sans-serif;}</style><main>H004 live publish</main>",
      previewSwatchThemeId: "theme-preview-nonpersisting"
    }
  });
  expect(publishResponse.ok()).toBe(true);
  const publishPayload = (await publishResponse.json()) as {
    ok: boolean;
    data: {
      source: string;
      applied: boolean;
      blocked: boolean;
      ignoredPreviewSwatchThemeId: string | null;
      persistence?: {
        source: string;
        mutated: boolean;
        themeId: string | null;
      };
      payload: {
        activeTheme: {
          themeKey: string;
        };
      };
    };
  };
  expect(publishPayload.ok).toBe(true);
  expect(publishPayload.data.source).toBe("strapi");
  expect(publishPayload.data.applied).toBe(true);
  expect(publishPayload.data.blocked).toBe(false);
  expect(publishPayload.data.ignoredPreviewSwatchThemeId).toBe("theme-preview-nonpersisting");
  expect(publishPayload.data.payload.activeTheme.themeKey).toBe("h004-live-active");
  expect(publishPayload.data.persistence?.mutated).toBe(true);

  const themesResponse = await page.request.get("/api/platform/studio/themes");
  expect(themesResponse.ok()).toBe(true);
  const themesPayload = (await themesResponse.json()) as {
    ok: boolean;
    source: string;
    data: Array<{
      themeKey: string;
      status: string;
      themeDebt: string;
    }>;
  };
  expect(themesPayload.ok).toBe(true);
  expect(themesPayload.source).toBe("strapi");
  const activeTheme = themesPayload.data.find((theme) => theme.themeKey === "h004-live-active");
  expect(activeTheme?.status).toBe("active");
  expect(activeTheme?.themeDebt).toContain("[studio:fidelity-settings]");

  await page.goto("/platform/onboarding/publish");
  await page.getByTestId("publish-open-overlay").click();
  await expect(page.getByTestId("publish-overlay-list-container")).toBeVisible();
  await expect(page.getByTestId("publish-overlay-detail-container")).toBeVisible();
  await expect(page.getByTestId("publish-overlay-action-container")).toBeVisible();
  await page.screenshot({
    path: path.join(evidenceDir, "tv-e2e-02-settings-publish-container-layout.png"),
    fullPage: true
  });

  writeJsonEvidence("tv-e2e-02-settings-publish-network-log.json", {
    settings: {
      status: settingsResponse.status(),
      payload: settingsPayload
    },
    publish: {
      status: publishResponse.status(),
      payload: publishPayload
    }
  });
  writeJsonEvidence("tv-e2e-02-strapi-theme-confirmation.json", themesPayload);
});
