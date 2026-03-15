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

test.describe("@real pages draft listing", () => {
  test.skip(
    process.env.LMNAS_E2E_REAL_STACK !== "1",
    "Run with LMNAS_E2E_REAL_STACK=1 and reachable canonical Strapi stack."
  );

  test("pages composer lists canonical draft pages even when published pages are empty", async ({ page }) => {
    const assertNoRuntimeErrors = createRuntimeErrorGate(page);
    await resetStudioState(page);

    const slug = `draft-only-page-${Date.now()}`;
    const pageKey = `draft-only-page-key-${Date.now()}`;

    const themesResponse = await page.request.get("/api/platform/studio/themes");
    expect(themesResponse.ok()).toBe(true);
    const themesPayload = (await themesResponse.json()) as {
      ok: boolean;
      data?: Array<{ themeKey: string; status: string }>;
    };
    const activeTheme = (themesPayload.data ?? []).find((theme) => theme.status === "active") ?? themesPayload.data?.[0];
    expect(activeTheme?.themeKey).toBeTruthy();

    const shellsResponse = await page.request.get("/api/platform/studio/shells");
    expect(shellsResponse.ok()).toBe(true);
    const shellsPayload = (await shellsResponse.json()) as {
      ok: boolean;
      data?: Array<{ key: string; status: string }>;
    };
    const activeShell = (shellsPayload.data ?? []).find((shell) => shell.status === "active") ?? shellsPayload.data?.[0];
    expect(activeShell?.key).toBeTruthy();

    const createResponse = await page.request.post("/api/platform/studio/pages", {
      data: {
        mode: "save",
        page: {
          id: pageKey,
          name: "Draft Only Composer Page",
          slug,
          locale: "en",
          themeKey: activeTheme?.themeKey,
          shellKey: activeShell?.key,
          blockOrder: [],
          fieldValues: {},
          actionOverrides: {},
          productMapping: "lmnas-platform",
          industryMapping: ["enterprise"],
          primaryCta: { text: "Book Demo", url: "/contact" },
          conversionConfig: { trackConversions: true, strategy: "Track Conversions", valuePoints: 1 },
          campaignUtmStrategy: { source: "lmnas", medium: "studio", campaign: "draft-only-page" },
          taxonomyState: { valid: true, tags: ["draft"] },
          seoMetadata: { metaTitle: "Draft only page", metaDescription: "Draft only page" },
          seoJsonLdValid: true,
          blockSchemaValid: true,
          previewValid: true
        }
      }
    });
    const createText = await createResponse.text();
    expect(createResponse.ok(), createText).toBe(true);

    const publishedResponse = await page.request.get("/api/platform/studio/pages?status=published");
    expect(publishedResponse.ok()).toBe(true);
    const publishedPayload = (await publishedResponse.json()) as {
      ok: boolean;
      source?: string;
      data?: Array<{ slug: string }>;
    };
    expect(publishedPayload.ok).toBe(true);
    expect(publishedPayload.source).toBe("strapi");
    expect(Array.isArray(publishedPayload.data)).toBe(true);
    expect((publishedPayload.data ?? []).find((entry) => entry.slug === slug)).toBeUndefined();

    const draftResponse = await page.request.get("/api/platform/studio/pages?status=draft");
    expect(draftResponse.ok()).toBe(true);
    const draftPayload = (await draftResponse.json()) as {
      ok: boolean;
      source?: string;
      data?: Array<{ id: string; slug: string; name: string }>;
    };
    expect(draftPayload.ok).toBe(true);
    expect(draftPayload.source).toBe("strapi");
    const persistedDraft = (draftPayload.data ?? []).find((entry) => entry.slug === slug);
    expect(persistedDraft?.id).toBeTruthy();

    await page.goto("/platform/onboarding/pages", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Page Composer" })).toBeVisible();
    await expect(page.getByText("Pages composer requires canonical published studio-pages from Strapi.")).toHaveCount(0);
    await expect(page.getByTestId(`pages-item-${persistedDraft?.id}`)).toBeVisible();
    await expect(page.getByTestId(`pages-item-${persistedDraft?.id}`)).toContainText("Draft Only Composer Page");

    assertNoRuntimeErrors();
  });
});
