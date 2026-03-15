import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestStrapiMock } = vi.hoisted(() => ({
  requestStrapiMock: vi.fn()
}));

vi.mock("../_lib/strapi", () => ({
  isStrapiConfigured: () => true,
  requestStrapi: requestStrapiMock,
  unwrapStrapiEntity: (value: unknown) => value
}));

import { POST } from "./route";

function buildRequest(payload: Record<string, unknown>): Request {
  return new Request("http://localhost/api/platform/studio/publish", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

describe("studio publish route canonical mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores a canonical draft version when live publish succeeds", async () => {
    requestStrapiMock
      .mockResolvedValueOnce({
        data: [
          {
            documentId: "page-1",
            name: "Publish Page",
            slug: "publish-page",
            previewValid: true,
            blockSchemaValid: true,
            productMapping: "lmnas-platform",
            industryMapping: ["enterprise"],
            primaryCta: { text: "Book Demo", url: "/contact" },
            conversionConfig: { strategy: "Track Conversions" },
            campaignUtmStrategy: { source: "lmnas", medium: "studio", campaign: "publish" },
            taxonomyState: { valid: true },
            seoMetadata: { metaTitle: "Publish Page", metaDescription: "Publish Page" },
            seoJsonLdValid: true
          }
        ]
      })
      .mockResolvedValueOnce({
        data: [
          {
            documentId: "theme-1",
            themeKey: "default",
            name: "Default Theme",
            status: "active",
            darkMode: true,
            themeDebt: "",
            tokens: []
          }
        ]
      })
      .mockResolvedValueOnce({
        data: {
          documentId: "page-1",
          pageKey: "page-1",
          name: "Publish Page",
          slug: "publish-page",
          locale: "en",
          activeShellId: "shell-main",
          shellKey: "shell-main",
          themeKey: "default",
          blockOrder: ["block-1"],
          fieldValues: {},
          actionOverrides: {},
          productMapping: "lmnas-platform",
          industryMapping: ["enterprise"],
          primaryCta: { text: "Book Demo", url: "/contact" },
          conversionConfig: { trackConversions: true, strategy: "Track Conversions", valuePoints: 10 },
          campaignUtmStrategy: { source: "lmnas", medium: "studio", campaign: "publish" },
          taxonomyState: { valid: true, tags: ["publish"] },
          seoMetadata: { metaTitle: "Publish Page", metaDescription: "Publish Page" },
          seoJsonLdValid: true,
          blockSchemaValid: true,
          previewValid: true
        }
      })
      .mockResolvedValueOnce({ data: { documentId: "page-1" } })
      .mockResolvedValueOnce({ data: { documentId: "page-1" } })
      .mockResolvedValueOnce({ data: { documentId: "page-1" } });

    const response = await POST(
      buildRequest({
        mode: "apply",
        pageId: "page-1",
        pageSlug: "publish-page",
        sourceHtml: "<main><section>Publish</section></main>"
      })
    );
    const payload = (await response.json()) as {
      ok: boolean;
      data: {
        applied: boolean;
        persistence: {
          mutated: boolean;
          pageId: string | null;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.applied).toBe(true);
    expect(payload.data.persistence.mutated).toBe(true);
    expect(payload.data.persistence.pageId).toBe("page-1");

    expect(requestStrapiMock).toHaveBeenCalledWith(
      "/api/studio-pages/page-1?status=draft",
      expect.objectContaining({
        method: "PUT",
        body: expect.objectContaining({
          status: "draft",
          lifecycle: "draft"
        })
      })
    );
    expect(requestStrapiMock).toHaveBeenCalledWith(
      "/api/studio-pages/page-1?status=published",
      expect.objectContaining({
        method: "PUT",
        body: expect.objectContaining({
          status: "published",
          lifecycle: "published"
        })
      })
    );

    const draftPayload = requestStrapiMock.mock.calls.find((call) => call[0] === "/api/studio-pages/page-1?status=draft" && call[1]?.method === "PUT")?.[1]
      ?.body;
    const publishedPayload = requestStrapiMock.mock.calls.find((call) => call[0] === "/api/studio-pages/page-1?status=published" && call[1]?.method === "PUT")
      ?.[1]?.body;
    expect(JSON.stringify(draftPayload ?? {})).not.toContain("localhost");
    expect(JSON.stringify(draftPayload ?? {})).not.toContain("_next/static");
    expect(JSON.stringify(draftPayload ?? {})).not.toContain("<script");
    expect(JSON.stringify(publishedPayload ?? {})).not.toContain("localhost");
    expect(JSON.stringify(publishedPayload ?? {})).not.toContain("_next/static");
    expect(JSON.stringify(publishedPayload ?? {})).not.toContain("<script");
  });

  it("hard fails when canonical governance pages cannot be read", async () => {
    requestStrapiMock.mockRejectedValueOnce(new Error("strapi_503: governance unavailable"));

    const response = await POST(
      buildRequest({
        mode: "apply",
        sourceHtml: "<main><section>Publish</section></main>"
      })
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: string;
      developerError: string;
    };

    expect(response.status).toBe(502);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("canonical studio-page governance");
    expect(payload.developerError).toContain("governance unavailable");
  });

  it("hard fails when canonical themes cannot be resolved", async () => {
    requestStrapiMock
      .mockResolvedValueOnce({
        data: [
          {
            documentId: "page-1",
            name: "Publish Page",
            slug: "publish-page",
            previewValid: true,
            blockSchemaValid: true,
            productMapping: "lmnas-platform",
            industryMapping: ["enterprise"],
            primaryCta: { text: "Book Demo", url: "/contact" },
            conversionConfig: { strategy: "Track Conversions" },
            campaignUtmStrategy: { source: "lmnas", medium: "studio", campaign: "publish" },
            taxonomyState: { valid: true },
            seoMetadata: { metaTitle: "Publish Page", metaDescription: "Publish Page" },
            seoJsonLdValid: true
          }
        ]
      })
      .mockRejectedValueOnce(new Error("strapi_503: themes unavailable"));

    const response = await POST(
      buildRequest({
        mode: "apply",
        pageId: "page-1",
        sourceHtml: "<main><section>Publish</section></main>"
      })
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: string;
      developerError: string;
    };

    expect(response.status).toBe(502);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("canonical studio-theme resolution");
    expect(payload.developerError).toContain("themes unavailable");
  });
});
