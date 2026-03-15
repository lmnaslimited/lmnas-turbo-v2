import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestStrapiMock } = vi.hoisted(() => ({
  requestStrapiMock: vi.fn()
}));

vi.mock("../_lib/strapi", () => ({
  isStrapiConfigured: () => true,
  requestStrapi: requestStrapiMock,
  StudioApiError: class StudioApiError extends Error {
    status = 500;
    operatorMessage = "error";
    developerMessage = "error";
  },
  unwrapStrapiEntity: (value: unknown) => value
}));

import { POST } from "./route";

function buildRequest(payload: Record<string, unknown>): Request {
  return new Request("http://localhost/api/platform/studio/pages", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

describe("studio pages route canonical persistence", () => {
  beforeEach(() => {
    let pageCreated = false;

    requestStrapiMock.mockReset();
    requestStrapiMock.mockImplementation((path: string, init?: { method?: string; body?: Record<string, unknown> }) => {
      if (path === "/api/studio-blocks?pagination[pageSize]=200&sort=updatedAt:desc") {
        return Promise.resolve({
          data: [
            {
              documentId: "doc-block-1",
              id: "block-row-1",
              blockKey: "block-hero",
              name: "Hero",
              family: "hero",
              status: "active",
              lifecycle: "draft",
              scope: "global",
              schemaStatus: "valid",
              themeKey: "sunrise",
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
                        text: "Canonical Hero"
                      }
                    ]
                  }
                ]
              },
              classMap: {
                "0": "theme-sunrise"
              },
              stylesheetRef: "/studio-runtime.css",
              createdAt: "2026-03-14",
              updatedAt: "2026-03-14"
            }
          ]
        });
      }

      if (path === "/api/studio-themes?filters[themeKey][$eq]=sunrise&pagination[pageSize]=1") {
        return Promise.resolve({ data: [{ documentId: "theme-1" }] });
      }

      if (path === "/api/studio-shells?filters[shellKey][$eq]=shell-main&pagination[pageSize]=1") {
        return Promise.resolve({ data: [{ documentId: "shell-1" }] });
      }

      if (path.startsWith("/api/studio-pages/page-1?status=draft")) {
        return Promise.resolve({ data: null });
      }

      if (path.startsWith("/api/studio-pages?filters[pageKey][$eq]=page-1")) {
        return Promise.resolve({ data: [] });
      }

      if (path.startsWith("/api/studio-pages?filters[slug][$eq]=landing-page")) {
        if (!pageCreated) {
          return Promise.resolve({ data: [] });
        }

        return Promise.resolve({
          data: [
            {
              documentId: "page-1",
              pageKey: "page-1",
              name: "Landing Page",
              slug: "landing-page",
              locale: "en",
              status: "draft",
              lifecycle: "draft",
              shellKey: "shell-main",
              activeShellId: "shell-main",
              themeKey: "sunrise",
              blockOrder: ["block-hero"],
              fieldValues: {},
              actionOverrides: {},
              productMapping: "lens-ai",
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
                campaign: "landing"
              },
              taxonomyState: {
                valid: true,
                tags: ["enterprise"]
              },
              seoMetadata: {
                metaTitle: "Landing Page",
                metaDescription: "Landing Page"
              },
              seoJsonLdValid: true,
              blockSchemaValid: true,
              previewValid: true
            }
          ]
        });
      }

      if (path === "/api/studio-pages?status=draft" && init?.method === "POST") {
        pageCreated = true;
        return Promise.resolve({ data: { documentId: "page-1" } });
      }

      if (path === "/api/studio-themes?pagination[pageSize]=200&sort=updatedAt:desc") {
        return Promise.resolve({
          data: [
            {
              documentId: "theme-1",
              themeKey: "sunrise",
              name: "Sunrise",
              status: "active",
              sourceRef: "figma://sunrise",
              themeScopeClass: "theme-sunrise",
              themeMode: "light",
              tokenCoverage: 0.95,
              themeDebt: "1 unmapped token",
              darkMode: false,
              tokens: [
                {
                  key: "primary",
                  label: "Primary",
                  category: "color",
                  value: "#ff4f00",
                  cssVariable: "--color-primary",
                  mapped: true
                }
              ]
            }
          ]
        });
      }

      if (path === "/api/studio-shells?pagination[pageSize]=200&sort=updatedAt:desc") {
        return Promise.resolve({
          data: [
            {
              documentId: "shell-1",
              shellKey: "shell-main",
              name: "Main Shell",
              role: "full",
              status: "active",
              updatedAt: "2026-03-14"
            }
          ]
        });
      }

      return Promise.resolve({ data: [] });
    });
  });

  it("persists pages as canonical state and regenerates preview from canonical blocks", async () => {
    const response = await POST(
      buildRequest({
        page: {
          id: "page-1",
          name: "Landing Page",
          slug: "landing-page",
          locale: "en",
          shellKey: "shell-main",
          themeKey: "sunrise",
          blockOrder: ["block-row-1"],
          fieldValues: {},
          actionOverrides: {},
          productMapping: "lens-ai",
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
            campaign: "landing"
          },
          taxonomyState: {
            valid: true,
            tags: ["enterprise"]
          },
          seoMetadata: {
            metaTitle: "Landing Page",
            metaDescription: "Landing Page"
          },
          seoJsonLdValid: true,
          blockSchemaValid: true,
          previewValid: true
        }
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
    };

    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");

    const createCall = requestStrapiMock.mock.calls.find((entry) => entry[0] === "/api/studio-pages?status=draft" && entry[1]?.method === "POST");
    expect(createCall?.[1]?.body).toEqual(
      expect.objectContaining({
        pageKey: "page-1",
        blockOrder: ["block-hero"]
      })
    );

    const serializedPayload = JSON.stringify(createCall?.[1]?.body ?? {});
    expect(serializedPayload).not.toContain("localhost");
    expect(serializedPayload).not.toContain("_next/static");
    expect(serializedPayload).not.toContain("<script");
  });
});
