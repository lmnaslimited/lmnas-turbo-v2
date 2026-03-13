import { expect, test } from "playwright/test";

type PagesPostResponse = {
  ok: boolean;
  data?: {
    page?: {
      id: string;
      slug: string;
      previewHtml?: string;
    };
    applied?: boolean;
  };
  source?: "strapi" | "fallback";
  error?: string;
};

function createRuntimeErrorGate(page: import("playwright/test").Page): () => void {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const ignorePatterns = [/favicon\.ico/i, /chrome-extension:\/\//i, /ERR_NAME_NOT_RESOLVED/i, /^Event$/i];

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
  const payload = (await response.json()) as { ok?: boolean; source?: string };
  expect(payload.ok).toBe(true);
  expect(payload.source).toBe("strapi");
}

test.describe("@real studio public route", () => {
  test.skip(
    process.env.LMNAS_E2E_REAL_STACK !== "1",
    "Run with LMNAS_E2E_REAL_STACK=1 and reachable canonical Strapi stack."
  );

  test("live route stays on published snapshot until republish", async ({ page }) => {
    const assertNoRuntimeErrors = createRuntimeErrorGate(page);
    await resetStudioState(page);

    const liveHtml = [
      "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body>",
      "<section class=\"px-8 py-16\">",
      "<h1>Published Studio Snapshot</h1>",
      "<p>This is the live version.</p>",
      "</section>",
      "</body></html>"
    ].join("");

    const draftHtml = [
      "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body>",
      "<section class=\"px-8 py-16\">",
      "<h1>Draft Edit After Publish</h1>",
      "<p>This should not leak to the public route.</p>",
      "</section>",
      "</body></html>"
    ].join("");

    const initialApplyResponse = await page.request.post("/api/platform/studio/pages", {
      data: {
        mode: "apply",
        page: {
          id: `studio-public-home-${Date.now()}`,
          name: "Home",
          slug: "home",
          locale: "en",
          lifecycle: "draft",
          status: "draft",
          blockOrder: [],
          fieldValues: {},
          actionOverrides: {},
          productMapping: "lmnas-platform",
          industryMapping: ["enterprise"],
          primaryCta: {
            text: "Book Demo",
            url: "/contact"
          },
          conversionConfig: {
            trackConversions: true,
            strategy: "Track Conversions",
            valuePoints: 10
          },
          campaignUtmStrategy: {
            source: "lmnas",
            medium: "studio",
            campaign: "public-route-smoke"
          },
          taxonomyState: {
            valid: true,
            tags: ["public-route"]
          },
          seoMetadata: {
            metaTitle: "Home",
            metaDescription: "Public route smoke test"
          },
          seoJsonLdValid: true,
          blockSchemaValid: true,
          previewValid: true,
          previewHtml: liveHtml,
          publishedPreviewHtml: liveHtml
        }
      }
    });
    const initialApplyPayload = (await initialApplyResponse.json()) as PagesPostResponse;
    expect(initialApplyResponse.ok(), JSON.stringify(initialApplyPayload)).toBe(true);
    expect(initialApplyPayload.ok).toBe(true);
    expect(initialApplyPayload.source).toBe("strapi");
    expect(initialApplyPayload.data?.page?.id).toBeTruthy();
    expect(initialApplyPayload.data?.applied).toBe(true);

    const canonicalPageId = initialApplyPayload.data?.page?.id as string;

    const response = await page.goto("/en/home", { waitUntil: "domcontentloaded" });
    expect(response?.status(), "Expected public route to resolve without 404").toBe(200);
    await expect(page.getByTestId("studio-runtime-page")).toContainText("Published Studio Snapshot");
    await expect(page.getByTestId("studio-runtime-page")).toContainText("This is the live version.");

    const draftSaveResponse = await page.request.post("/api/platform/studio/pages", {
      data: {
        mode: "save",
        page: {
          id: canonicalPageId,
          name: "Home",
          slug: "home",
          locale: "en",
          lifecycle: "draft",
          status: "draft",
          blockOrder: [],
          fieldValues: {},
          actionOverrides: {},
          productMapping: "lmnas-platform",
          industryMapping: ["enterprise"],
          primaryCta: {
            text: "Book Demo",
            url: "/contact"
          },
          conversionConfig: {
            trackConversions: true,
            strategy: "Track Conversions",
            valuePoints: 10
          },
          campaignUtmStrategy: {
            source: "lmnas",
            medium: "studio",
            campaign: "public-route-draft-edit"
          },
          taxonomyState: {
            valid: true,
            tags: ["public-route"]
          },
          seoMetadata: {
            metaTitle: "Home",
            metaDescription: "Public route smoke test"
          },
          seoJsonLdValid: true,
          blockSchemaValid: true,
          previewValid: true,
          previewHtml: draftHtml
        }
      }
    });
    const draftSavePayload = (await draftSaveResponse.json()) as PagesPostResponse;
    expect(draftSaveResponse.ok(), JSON.stringify(draftSavePayload)).toBe(true);
    expect(draftSavePayload.ok).toBe(true);
    expect(draftSavePayload.source).toBe("strapi");

    await page.goto("/en/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("studio-runtime-page")).toContainText("Published Studio Snapshot");
    await expect(page.getByTestId("studio-runtime-page")).toContainText("This is the live version.");
    await expect(page.getByTestId("studio-runtime-page")).not.toContainText("Draft Edit After Publish");
    await expect(page.getByTestId("studio-runtime-page")).not.toContainText("This should not leak to the public route.");

    assertNoRuntimeErrors();
  });
});
