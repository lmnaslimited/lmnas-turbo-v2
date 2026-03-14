import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/env", () => ({
  loadProjectEnv: () => undefined
}));

import { loadStudioPageForRoute } from "./studio-page-runtime";

describe("loadStudioPageForRoute", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("STRAPI_URL", "https://cms.example.com");
    vi.stubEnv("STRAPI_API_TOKEN", "token");
    vi.stubEnv("SITE_CANONICAL_BASE", "https://lmnas.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds a governed imported-dom render model for published studio pages", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            documentId: "page-1",
            name: "Governed Home",
            slug: "home",
            locale: "en",
            status: "published",
            previewValid: true,
            blockSchemaValid: true,
            seoJsonLdValid: true,
            productMapping: "lmnas-platform",
            industryMapping: ["enterprise"],
            primaryCta: {
              text: "Book Demo",
              url: "/contact"
            },
            conversionConfig: {
              strategy: "Track Conversions"
            },
            seoMetadata: {
              metaTitle: "Governed Home",
              metaDescription: "Governed Home Description"
            },
            previewHtml: "<main><section>Draft</section></main>",
            publishedPreviewHtml:
              "<main><section onclick=\"alert(1)\"><a href=\"javascript:alert(1)\">Unsafe</a><iframe src=\"https://evil.example\"></iframe><img src=\"/hero.png#fragment\"/></section><script>alert(1)</script></main>"
          }
        ]
      })
    });

    const result = await loadStudioPageForRoute({
      slug: "home",
      locale: "en",
      preview: false
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/studio-pages?filters[slug][$eq]=home"),
      expect.objectContaining({
        method: "GET"
      })
    );
    expect(fetchMock.mock.calls[0]?.[0]).toContain("status=published");
    expect(result.state).toBe("ready");

    if (result.state !== "ready") {
      throw new Error("Expected governed runtime page");
    }

    expect(result.page.canonicalPath).toBe("/en");
    expect(result.page.canonicalUrl).toBe("https://lmnas.com/en");
    expect(result.page.renderBlocks).toHaveLength(1);
    expect(result.page.renderBlocks[0]?.type).toBe("imported_dom_snapshot");

    const serialized = JSON.stringify(result.page.renderBlocks[0]?.domJson);
    expect(serialized).not.toContain("onclick");
    expect(serialized).not.toContain("javascript:");
    expect(serialized).not.toContain("script");
    expect(serialized).not.toContain("iframe");
    expect(serialized).toContain("https://lmnas.com/hero.png");
    expect(result.page.jsonLd).toHaveLength(1);
  });

  it("uses draft status for preview loads", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: []
      })
    });

    const result = await loadStudioPageForRoute({
      slug: "preview-page",
      locale: "en",
      preview: true
    });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("status=draft");
    expect(result.state).toBe("missing");
  });

  it("blocks published runtime records that fail governance checks", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            documentId: "page-2",
            name: "Broken Page",
            slug: "broken-page",
            locale: "en",
            status: "published",
            previewValid: false,
            blockSchemaValid: true,
            seoJsonLdValid: false,
            productMapping: "",
            industryMapping: [],
            primaryCta: {
              text: "",
              url: ""
            },
            conversionConfig: {
              strategy: ""
            },
            seoMetadata: {
              metaTitle: "",
              metaDescription: ""
            },
            previewHtml: "<main><section>Draft</section></main>",
            publishedPreviewHtml: "<main><section>Broken</section></main>"
          }
        ]
      })
    });

    const result = await loadStudioPageForRoute({
      slug: "broken-page",
      locale: "en",
      preview: false
    });

    expect(result.state).toBe("blocked");
    if (result.state !== "blocked") {
      throw new Error("Expected blocked studio runtime page");
    }

    expect(result.issues).toContain("Preview acceptance is incomplete.");
    expect(result.issues).toContain("Product mapping is required.");
    expect(result.issues).toContain("Primary CTA is required.");
    expect(result.issues).toContain("SEO JSON-LD validation is incomplete.");
  });

  it("prefers the published record when Strapi returns a newer draft version in the same collection response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            documentId: "page-3",
            name: "Mixed Version Page",
            slug: "mixed-version-page",
            locale: "en",
            status: "draft",
            previewValid: false,
            blockSchemaValid: true,
            seoJsonLdValid: false,
            productMapping: "lmnas-platform",
            industryMapping: ["enterprise"],
            primaryCta: {
              text: "Book Demo",
              url: "/contact"
            },
            conversionConfig: {
              strategy: "Track Conversions"
            },
            seoMetadata: {
              metaTitle: "Mixed Version Page",
              metaDescription: "Draft edit should not leak onto the live route."
            },
            previewHtml: "<main><section>Draft Edit After Publish</section></main>",
            publishedPreviewHtml: "<main><section>Draft Edit After Publish</section></main>"
          },
          {
            documentId: "page-3",
            name: "Mixed Version Page",
            slug: "mixed-version-page",
            locale: "en",
            status: "published",
            previewValid: true,
            blockSchemaValid: true,
            seoJsonLdValid: true,
            productMapping: "lmnas-platform",
            industryMapping: ["enterprise"],
            primaryCta: {
              text: "Book Demo",
              url: "/contact"
            },
            conversionConfig: {
              strategy: "Track Conversions"
            },
            seoMetadata: {
              metaTitle: "Mixed Version Page",
              metaDescription: "Published content should remain live."
            },
            previewHtml: "<main><section>Draft Edit After Publish</section></main>",
            publishedPreviewHtml: "<main><section>Published Studio Snapshot</section></main>"
          }
        ]
      })
    });

    const result = await loadStudioPageForRoute({
      slug: "mixed-version-page",
      locale: "en",
      preview: false
    });

    expect(result.state).toBe("ready");
    if (result.state !== "ready") {
      throw new Error("Expected live runtime to resolve the published version");
    }

    const serialized = JSON.stringify(result.page.renderBlocks[0]?.domJson);
    expect(serialized).toContain("Published Studio Snapshot");
    expect(serialized).not.toContain("Draft Edit After Publish");
    expect(result.page.jsonLd).toHaveLength(1);
  });
});
