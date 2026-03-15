import { expect, test } from "playwright/test";

type PagesPostResponse = {
  ok: boolean;
  data?: {
    page?: {
      id: string;
      slug: string;
      previewValid?: boolean;
      seoJsonLdValid?: boolean;
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

    const draftHtml = "deleted";

    const initialSaveResponse = await page.request.post("/api/platform/studio/pages", {
      data: {
        mode: "save",
        page: {
          id: `studio-public-home-${Date.now()}`,
          name: "Home",
          slug: "home",
          locale: "en",
          lifecycle: "draft",
          status: "draft",
          blockOrder: ["blk-hero-1"],
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
          previewValid: true
        }
      }
    });
    const initialSavePayload = (await initialSaveResponse.json()) as PagesPostResponse;
    expect(initialSaveResponse.ok(), JSON.stringify(initialSavePayload)).toBe(true);
    expect(initialSavePayload.ok).toBe(true);
    expect(initialSavePayload.source).toBe("strapi");
    expect(initialSavePayload.data?.page?.id).toBeTruthy();

    const canonicalPageId = initialSavePayload.data?.page?.id as string;

    const acceptPreviewResponse = await page.request.post("/api/platform/studio/pages", {
      data: {
        mode: "preview-accept",
        pageId: canonicalPageId
      }
    });
    const acceptPreviewPayload = (await acceptPreviewResponse.json()) as PagesPostResponse;
    expect(acceptPreviewResponse.ok(), JSON.stringify(acceptPreviewPayload)).toBe(true);
    expect(acceptPreviewPayload.ok).toBe(true);
    expect(acceptPreviewPayload.source).toBe("strapi");
    expect(acceptPreviewPayload.data?.page?.previewValid).toBe(true);
    expect(acceptPreviewPayload.data?.page?.seoJsonLdValid).toBe(true);
    const acceptedPage = acceptPreviewPayload.data?.page;

    const initialApplyResponse = await page.request.post("/api/platform/studio/pages", {
      data: {
        mode: "apply",
        page: {
          ...(acceptedPage ?? { id: canonicalPageId })
        }
      }
    });
    const initialApplyPayload = (await initialApplyResponse.json()) as PagesPostResponse;
    expect(initialApplyResponse.ok(), JSON.stringify(initialApplyPayload)).toBe(true);
    expect(initialApplyPayload.ok).toBe(true);
    expect(initialApplyPayload.source).toBe("strapi");
    expect(initialApplyPayload.data?.applied).toBe(true);

    const response = await page.goto("/en/home", { waitUntil: "domcontentloaded" });
    expect(response?.status(), "Expected public route to resolve without 404").toBe(200);
    await expect(page).toHaveTitle(/Home/);
    await expect(page.locator("meta[name='description']")).toHaveAttribute("content", "Public route smoke test");
    await expect(page.locator("script[type='application/ld+json']")).toHaveCount(1);

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
          blockOrder: ["blk-hero-1"],
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
            metaTitle: "Draft Edit",
            metaDescription: "Draft version should not leak"
          },
          seoJsonLdValid: true,
          blockSchemaValid: true,
          previewValid: true
        }
      }
    });
    const draftSavePayload = (await draftSaveResponse.json()) as PagesPostResponse;
    expect(draftSaveResponse.ok(), JSON.stringify(draftSavePayload)).toBe(true);
    expect(draftSavePayload.ok).toBe(true);
    expect(draftSavePayload.source).toBe("strapi");

    await page.goto("/en/home", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Home/);
    await expect(page).not.toHaveTitle(/Draft Edit/);

    assertNoRuntimeErrors();
  });
});
