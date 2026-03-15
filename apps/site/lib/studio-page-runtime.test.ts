import { importedDomSnapshotBlockSchema } from "../../../packages/blocks/ImportedDomSnapshot/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/env", () => ({
  loadProjectEnv: () => undefined
}));

import { loadStudioPageForRoute } from "./studio-page-runtime";

function jsonResponse(data: Array<Record<string, unknown>>) {
  return {
    ok: true,
    json: async () => ({
      data
    })
  };
}

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

  it("builds a governed imported-dom render model from canonical Strapi data", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/studio-pages?")) {
        return jsonResponse([
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
            blockOrder: ["block-hero"],
            shellKey: "shell-main",
            themeKey: "sunrise"
          }
        ]);
      }

      if (url.includes("/api/studio-blocks?")) {
        return jsonResponse([
          {
            documentId: "block-hero",
            blockKey: "block-hero",
            name: "Hero",
            family: "hero",
            status: "active",
            sourceType: "import",
            sourceRef: "https://source.example/landing",
            domJson: {
              kind: "root",
              children: [
                {
                  kind: "element",
                  tag: "section",
                  attributes: {
                    class: "bg-background-light text-primary"
                  },
                  children: [
                    {
                      kind: "text",
                      text: "Canonical Runtime Hero"
                    }
                  ]
                }
              ]
            },
            classMap: {
              "0": "theme-sunrise"
            },
            stylesheetRef: "/studio-runtime.css"
          }
        ]);
      }

      if (url.includes("/api/studio-themes?")) {
        return jsonResponse([
          {
            documentId: "theme-1",
            themeKey: "sunrise",
            name: "Sunrise",
            status: "active",
            sourceRef: "figma://sunrise",
            themeScopeClass: "theme-sunrise",
            themeMode: "light",
            tokenCoverage: 0.95,
            themeDebt: "1 alias pending",
            darkMode: false,
            tokens: [
              {
                key: "primary",
                value: "#ff4f00",
                label: "Primary",
                category: "color",
                cssVariable: "--color-primary",
                mapped: true
              }
            ]
          }
        ]);
      }

      if (url.includes("/api/studio-shells?")) {
        return jsonResponse([
          {
            documentId: "shell-main",
            shellKey: "shell-main",
            name: "Main Shell",
            role: "full",
            status: "active"
          }
        ]);
      }

      return {
        ok: false,
        json: async () => ({ data: [] })
      };
    });

    const result = await loadStudioPageForRoute({
      slug: "home",
      locale: "en",
      preview: false
    });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("status=published");
    expect(result.state).toBe("ready");
    if (result.state !== "ready") {
      throw new Error("Expected governed runtime page");
    }

    expect(result.page.canonicalPath).toBe("/en");
    expect(result.page.canonicalUrl).toBe("https://lmnas.com/en");
    expect(result.page.theme.themeScopeClass).toBe("theme-sunrise");
    expect(result.page.theme.cssVars).toMatchObject({
      "--theme-primary": "#ff4f00"
    });
    expect(result.page.renderBlocks).toHaveLength(2);
    result.page.renderBlocks.forEach((block) => {
      expect(() => importedDomSnapshotBlockSchema.parse(block)).not.toThrow();
    });
    expect(JSON.stringify(result.page.renderBlocks)).toContain("Canonical Runtime Hero");
    expect(JSON.stringify(result.page.renderBlocks)).not.toContain("localhost");
    expect(result.page.jsonLd).toHaveLength(1);
  });

  it("regenerates runtime render blocks from canonical snapshots after preview cache deletion", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/studio-pages?")) {
        return jsonResponse([
          {
            documentId: "page-2",
            name: "Preview Cache Deleted",
            slug: "preview-cache-deleted",
            locale: "en",
            status: "draft",
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
              metaTitle: "Preview Cache Deleted",
              metaDescription: "Preview Cache Deleted"
            },
            blockOrder: ["block-hero"],
            themeKey: "sunrise"
          }
        ]);
      }

      if (url.includes("/api/studio-blocks?")) {
        return jsonResponse([
          {
            documentId: "block-hero",
            blockKey: "block-hero",
            name: "Hero",
            family: "hero",
            status: "active",
            sourceType: "import",
            sourceRef: "https://source.example/landing",
            domJson: {
              kind: "root",
              children: [
                {
                  kind: "element",
                  tag: "section",
                  attributes: {},
                  children: [
                    {
                      kind: "text",
                      text: "Recovered from canonical data"
                    }
                  ]
                }
              ]
            },
            classMap: {},
            stylesheetRef: "/studio-runtime.css"
          }
        ]);
      }

      if (url.includes("/api/studio-themes?")) {
        return jsonResponse([
          {
            documentId: "theme-1",
            themeKey: "sunrise",
            name: "Sunrise",
            status: "active",
            sourceRef: "figma://sunrise",
            themeScopeClass: "theme-sunrise",
            themeMode: "dark",
            tokenCoverage: 0.95,
            themeDebt: "",
            darkMode: true,
            tokens: []
          }
        ]);
      }

      if (url.includes("/api/studio-shells?")) {
        return jsonResponse([]);
      }

      return {
        ok: false,
        json: async () => ({ data: [] })
      };
    });

    const result = await loadStudioPageForRoute({
      slug: "preview-cache-deleted",
      locale: "en",
      preview: true
    });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("status=draft");
    expect(result.state).toBe("ready");
    if (result.state !== "ready") {
      throw new Error("Expected preview runtime page");
    }

    expect(result.page.renderBlocks).toHaveLength(1);
    expect(JSON.stringify(result.page.renderBlocks[0]?.domJson)).toContain("Recovered from canonical data");
  });

  it("blocks published runtime records that fail governance even when legacy preview cache is present", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/studio-pages?")) {
        return jsonResponse([
          {
            documentId: "page-3",
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
            blockOrder: ["block-hero"]
          }
        ]);
      }

      if (url.includes("/api/studio-blocks?")) {
        return jsonResponse([
          {
            documentId: "block-hero",
            blockKey: "block-hero",
            name: "Hero",
            family: "hero",
            status: "active",
            sourceType: "import",
            sourceRef: "https://source.example/landing",
            domJson: {
              kind: "root",
              children: [
                {
                  kind: "element",
                  tag: "section",
                  attributes: {},
                  children: [
                    {
                      kind: "text",
                      text: "Still blocked"
                    }
                  ]
                }
              ]
            },
            classMap: {},
            stylesheetRef: "/studio-runtime.css"
          }
        ]);
      }

      if (url.includes("/api/studio-themes?") || url.includes("/api/studio-shells?")) {
        return jsonResponse([]);
      }

      return {
        ok: false,
        json: async () => ({ data: [] })
      };
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
});
