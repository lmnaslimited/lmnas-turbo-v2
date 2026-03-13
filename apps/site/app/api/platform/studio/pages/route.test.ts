import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioStore, resetStore } from "../_lib/store";

const strapiMockState = vi.hoisted(() => ({
  configured: false,
  requestStrapi: vi.fn()
}));

vi.mock("../_lib/strapi", () => ({
  isStrapiConfigured: () => strapiMockState.configured,
  requestStrapi: strapiMockState.requestStrapi,
  unwrapStrapiEntity: (value: unknown) => value
}));

import { GET, POST } from "./route";

function buildPostRequest(body: unknown): Request {
  return new Request("http://localhost/api/platform/studio/pages", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("studio pages route import guards", () => {
  beforeEach(() => {
    resetStore();
    strapiMockState.configured = false;
    strapiMockState.requestStrapi.mockReset();
  });

  it("returns canonical empty published pages from Strapi without degrading to fallback", async () => {
    strapiMockState.configured = true;
    strapiMockState.requestStrapi.mockResolvedValueOnce({
      data: []
    });

    const response = await GET(new Request("http://localhost/api/platform/studio/pages?status=published"));

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      data: unknown[];
    };
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.data).toEqual([]);
  });

  it("rejects import requests that attempt route slug generation", async () => {
    const response = await POST(
      buildPostRequest({
        mode: "import-blocks",
        html: "<section><h1>Test</h1></section>",
        createRouteSlug: true
      })
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      ok: boolean;
      code: string;
    };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("pages.import_slug_generation_forbidden");
  });

  it("rejects import requests that include page slug payload", async () => {
    const response = await POST(
      buildPostRequest({
        mode: "import-blocks",
        html: "<section><h1>Test</h1></section>",
        page: {
          slug: "should-not-exist"
        }
      })
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      ok: boolean;
      code: string;
    };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("pages.import_slug_generation_forbidden");
  });

  it("imports full-page HTML into blocks only and reports zero route-slug entities", async () => {
    const before = getStudioStore();
    const beforeBlockCount = before.blocks.length;
    const beforePageCount = before.pages.length;

    const response = await POST(
      buildPostRequest({
        mode: "import-blocks",
        sourceRef: "docs/testing-artifacts/code.html",
        html: "<html><body><section><h1>Hero</h1></section><section><h2>FAQ</h2></section></body></html>"
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      data: {
        blockCount: number;
        routeSlugEntitiesCreated: number;
        importedBlocks: Array<{ key: string; sourceRef: string }>;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("fallback");
    expect(payload.data.blockCount).toBe(2);
    expect(payload.data.routeSlugEntitiesCreated).toBe(0);
    expect(payload.data.importedBlocks.every((entry) => entry.sourceRef === "docs/testing-artifacts/code.html")).toBe(true);

    const after = getStudioStore();
    expect(after.blocks.length).toBe(beforeBlockCount + 2);
    expect(after.pages.length).toBe(beforePageCount);
  });

  it("imports full-page HTML into canonical studio-blocks when Strapi is configured", async () => {
    strapiMockState.configured = true;
    strapiMockState.requestStrapi
      .mockResolvedValueOnce({ data: [], meta: { pagination: { total: 0 } } })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: { documentId: "block-hero-1" } })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: { documentId: "block-faq-2" } })
      .mockResolvedValueOnce({ data: [], meta: { pagination: { total: 0 } } });

    const response = await POST(
      buildPostRequest({
        mode: "import-blocks",
        sourceRef: "docs/testing-artifacts/code.html",
        html: "<html><body><section><h1>Hero</h1></section><section><h2>FAQ</h2></section></body></html>"
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      data: {
        blockCount: number;
        routeSlugEntitiesCreated: number;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.data.blockCount).toBe(2);
    expect(payload.data.routeSlugEntitiesCreated).toBe(0);
  });

  it("accepts preview canonically and marks preview and seo validity", async () => {
    strapiMockState.configured = true;
    strapiMockState.requestStrapi
      .mockResolvedValueOnce({
        data: {
          documentId: "page-doc-1",
          pageKey: "page-doc-1",
          name: "Draft Page 1",
          slug: "draft-page-1",
          locale: "en",
          blockOrder: ["block-1"],
          fieldValues: {},
          actionOverrides: {},
          productMapping: "lens-ai-revenue-platform",
          industryMapping: ["enterprise"],
          primaryCta: { text: "Read Customer Stories", url: "/contact" },
          conversionConfig: { trackConversions: true, strategy: "Track Conversions", valuePoints: 0 },
          campaignUtmStrategy: { source: "lmnas", medium: "studio", campaign: "transformercorp-testimonials" },
          taxonomyState: { valid: true, tags: [] },
          seoMetadata: {
            metaTitle: "Transformer Testimonials | LENS AI Revenue Platform",
            metaDescription:
              "Trusted by European transformer manufacturers. Explore customer stories and proof points from complex manufacturing environments."
          },
          seoJsonLdValid: false,
          blockSchemaValid: true,
          previewValid: false,
          previewHtml: "<main><section>Preview</section></main>",
          status: "draft",
          lifecycle: "draft",
          updatedAt: "2026-03-13"
        }
      })
      .mockResolvedValueOnce({ data: { documentId: "page-doc-1" } })
      .mockResolvedValueOnce({
        data: {
          documentId: "page-doc-1",
          pageKey: "page-doc-1",
          name: "Draft Page 1",
          slug: "draft-page-1",
          locale: "en",
          blockOrder: ["block-1"],
          fieldValues: {},
          actionOverrides: {},
          productMapping: "lens-ai-revenue-platform",
          industryMapping: ["enterprise"],
          primaryCta: { text: "Read Customer Stories", url: "/contact" },
          conversionConfig: { trackConversions: true, strategy: "Track Conversions", valuePoints: 0 },
          campaignUtmStrategy: { source: "lmnas", medium: "studio", campaign: "transformercorp-testimonials" },
          taxonomyState: { valid: true, tags: [] },
          seoMetadata: {
            metaTitle: "Transformer Testimonials | LENS AI Revenue Platform",
            metaDescription:
              "Trusted by European transformer manufacturers. Explore customer stories and proof points from complex manufacturing environments."
          },
          seoJsonLdValid: true,
          blockSchemaValid: true,
          previewValid: true,
          previewHtml: "<main><section>Preview</section></main>",
          status: "draft",
          lifecycle: "draft",
          updatedAt: "2026-03-13"
        }
      });

    const response = await POST(
      buildPostRequest({
        mode: "preview-accept",
        pageId: "page-doc-1"
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      data: {
        page: {
          id: string;
          previewValid: boolean;
          seoJsonLdValid: boolean;
        };
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.data.page.id).toBe("page-doc-1");
    expect(payload.data.page.previewValid).toBe(true);
    expect(payload.data.page.seoJsonLdValid).toBe(true);
  });

  it("saves import-as-page payload with canonical block keys and governance refs", async () => {
    strapiMockState.configured = true;
    strapiMockState.requestStrapi
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        data: [
          {
            documentId: "studio-page-1",
            pageKey: "page-import-1",
            name: "Imported Page",
            slug: "imported-page",
            locale: "en",
            shellKey: "shell-main",
            themeKey: "default",
            blockOrder: ["import-source-hero-1-01", "import-source-faq-2-02"],
            status: "draft",
            lifecycle: "draft",
            fieldValues: {},
            actionOverrides: {},
            productMapping: "",
            industryMapping: [],
            primaryCta: { text: "", url: "" },
            conversionConfig: { trackConversions: true, strategy: "Track Conversions", valuePoints: 0 },
            campaignUtmStrategy: { source: "", medium: "", campaign: "" },
            taxonomyState: { valid: false, tags: [] },
            seoMetadata: { metaTitle: "", metaDescription: "" },
            seoJsonLdValid: false,
            blockSchemaValid: true,
            previewValid: true,
            previewHtml: "<main><section>Imported</section></main>",
            updatedAt: "2026-03-12"
          }
        ]
      });

    const saveResponse = await POST(
      buildPostRequest({
        mode: "save",
        page: {
          id: "page-import-1",
          name: "Imported Page",
          slug: "imported-page",
          locale: "en",
          shellKey: "shell-main",
          themeKey: "default",
          blockOrder: ["import-source-hero-1-01", "import-source-faq-2-02"],
          fieldValues: {},
          actionOverrides: {},
          productMapping: "",
          industryMapping: [],
          primaryCta: {
            text: "",
            url: ""
          },
          conversionConfig: {
            trackConversions: true,
            strategy: "Track Conversions",
            valuePoints: 0
          },
          campaignUtmStrategy: {
            source: "",
            medium: "",
            campaign: ""
          },
          taxonomyState: {
            valid: false,
            tags: []
          },
          seoMetadata: {
            metaTitle: "",
            metaDescription: ""
          },
          seoJsonLdValid: false,
          blockSchemaValid: true,
          previewValid: true,
          previewHtml: "<main><section>Imported</section></main>",
          updatedAt: "2026-03-12"
        }
      })
    );

    expect(saveResponse.status).toBe(200);
    const savePayload = (await saveResponse.json()) as {
      ok: boolean;
      data: {
        page: {
          shellKey?: string;
          themeKey?: string;
          blockOrder: string[];
        };
      };
    };
    expect(savePayload.ok).toBe(true);
    expect(savePayload.data.page.shellKey).toBe("shell-main");
    expect(savePayload.data.page.themeKey).toBe("default");
    expect(savePayload.data.page.blockOrder).toEqual(["import-source-hero-1-01", "import-source-faq-2-02"]);
  });
});
