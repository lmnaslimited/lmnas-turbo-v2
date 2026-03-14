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

import { DELETE, POST } from "./route";

function buildDeleteRequest(query: string): Request {
  return new Request(`http://localhost/api/platform/studio/blocks?${query}`, {
    method: "DELETE",
    headers: {
      "content-type": "application/json"
    }
  });
}

function buildPostRequest(body: unknown): Request {
  return new Request("http://localhost/api/platform/studio/blocks", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("studio blocks route delete guard", () => {
  beforeEach(() => {
    requestStrapiMock.mockReset();
  });

  it("rejects deletion when where-used pages exist", async () => {
    requestStrapiMock.mockImplementation((path: string, init?: { method?: string }) => {
      if (typeof path === "string" && path.startsWith("/api/studio-blocks?pagination")) {
        return Promise.resolve({
          data: [
            {
              id: "blk-hero-1",
              blockKey: "blk-hero-1",
              name: "Hero",
              family: "hero",
              status: "active",
              lifecycle: "draft",
              scope: "global",
              schemaStatus: "valid",
              themeKey: "default",
              sourceType: "seed",
              sourceRef: "seed",
              confidence: 1,
              editableFields: [],
              actions: [],
              previewHtml: "<section />",
              usageCount: 0
            }
          ]
        });
      }
      if (typeof path === "string" && path.startsWith("/api/studio-pages?")) {
        return Promise.resolve({
          data: [
            {
              id: "page-1",
              slug: "page-one",
              locale: "en",
              blockOrder: ["blk-hero-1"]
            }
          ]
        });
      }
      if (typeof path === "string" && init?.method === "DELETE") {
        return Promise.resolve({ data: {} });
      }
      return Promise.resolve({ data: [] });
    });

    const response = await DELETE(buildDeleteRequest("id=blk-hero-1"));
    expect(response.status).toBe(409);
    const payload = (await response.json()) as {
      ok: boolean;
      code: string;
      whereUsed: Array<{ slug: string }>;
    };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("blocks.where_used");
    expect(payload.whereUsed[0]?.slug).toBe("page-one");
  });

  it("deletes canonical blocks that are not referenced", async () => {
    let listCalls = 0;
    requestStrapiMock.mockImplementation((path: string, init?: { method?: string }) => {
      if (typeof path === "string" && path.startsWith("/api/studio-blocks?pagination")) {
        listCalls += 1;
        if (listCalls === 1) {
          return Promise.resolve({
            data: [
              {
                id: "blk-cta-1",
                blockKey: "blk-cta-1",
                name: "CTA",
                family: "cta_banner",
                status: "active",
                lifecycle: "draft",
                scope: "global",
                schemaStatus: "valid",
                themeKey: "default",
                sourceType: "seed",
                sourceRef: "seed",
                confidence: 1,
                editableFields: [],
                actions: [],
                previewHtml: "<section />",
                usageCount: 0
              }
            ]
          });
        }
        return Promise.resolve({ data: [] });
      }
      if (typeof path === "string" && path.startsWith("/api/studio-pages?")) {
        return Promise.resolve({ data: [] });
      }
      if (typeof path === "string" && path.startsWith("/api/studio-blocks?filters")) {
        return Promise.resolve({ data: [{ id: "blk-cta-1", blockKey: "blk-cta-1" }] });
      }
      if (typeof path === "string" && init?.method === "DELETE") {
        return Promise.resolve({ data: {} });
      }
      return Promise.resolve({ data: [] });
    });

    const response = await DELETE(buildDeleteRequest("id=blk-cta-1"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: Array<{ id: string }>;
      source: string;
      schemaSource: string;
    };
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.schemaSource).toBe("canonical");
    expect(payload.data.some((block) => block.id === "blk-cta-1")).toBe(false);
  });

  it("updates canonical block names through POST upsert", async () => {
    let listCalls = 0;
    requestStrapiMock.mockImplementation((path: string, init?: { method?: string; body?: Record<string, unknown> }) => {
      if (typeof path === "string" && path.startsWith("/api/studio-blocks?filters")) {
        return Promise.resolve({ data: [{ documentId: "blk-hero-1", blockKey: "blk-hero-1" }] });
      }
      if (typeof path === "string" && path.startsWith("/api/studio-blocks?pagination")) {
        listCalls += 1;
        if (listCalls === 1) {
          return Promise.resolve({
            data: [
              {
                id: "blk-hero-1",
                blockKey: "blk-hero-1",
                name: "Renamed Hero",
                family: "hero",
                status: "active",
                lifecycle: "draft",
                scope: "global",
                schemaStatus: "valid",
                themeKey: "default",
                sourceType: "seed",
                sourceRef: "seed",
                confidence: 1,
                editableFields: ["name"],
                actions: [],
                previewHtml: "<section />",
                usageCount: 0
              }
            ]
          });
        }
        return Promise.resolve({ data: [] });
      }
      if (typeof path === "string" && path === "/api/studio-blocks/blk-hero-1" && init?.method === "PUT") {
        expect(init.body?.name).toBe("Renamed Hero");
        return Promise.resolve({ data: { documentId: "blk-hero-1" } });
      }
      return Promise.resolve({ data: [] });
    });

    const response = await POST(
      buildPostRequest({
        block: {
          id: "blk-hero-1",
          key: "blk-hero-1",
          name: "Renamed Hero",
          family: "hero",
          status: "active",
          lifecycle: "draft",
          scope: "global",
          schemaStatus: "valid",
          themeKey: "default",
          sourceType: "seed",
          sourceRef: "seed",
          confidence: 1,
          editableFields: ["name"],
          actions: [],
          previewHtml: "<section />",
          inUseCount: 0,
          usageCount: 0,
          createdAt: "2026-03-13",
          updatedAt: "2026-03-13"
        }
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      schemaSource: string;
      data: Array<{ name: string }>;
    };
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.schemaSource).toBe("canonical");
    expect(payload.data[0]?.name).toBe("Renamed Hero");
  });
});
