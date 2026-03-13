import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioStore, replaceStore, resetStore } from "../_lib/store";

vi.mock("../_lib/strapi", () => ({
  isStrapiConfigured: () => false,
  requestStrapi: vi.fn(),
  StudioApiError: class StudioApiError extends Error {
    status = 500;
    operatorMessage = "error";
    developerMessage = "error";
  },
  unwrapStrapiEntity: (value: unknown) => value
}));

import { DELETE } from "./route";

function buildDeleteRequest(query: string): Request {
  return new Request(`http://localhost/api/platform/studio/blocks?${query}`, {
    method: "DELETE",
    headers: {
      "content-type": "application/json"
    }
  });
}

describe("studio blocks route delete guard", () => {
  beforeEach(() => {
    resetStore();
  });

  it("rejects deletion when where-used pages exist", async () => {
    const store = getStudioStore();
    replaceStore({
      ...store,
      pages: [
        {
          id: "pg-1",
          name: "Page One",
          slug: "page-one",
          locale: "en",
          blockOrder: ["blk-hero-1"],
          fieldValues: {},
          actionOverrides: {},
          previewHtml: "<main>page</main>",
          updatedAt: "2026-03-10"
        }
      ]
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

  it("deletes blocks that are not referenced", async () => {
    const store = getStudioStore();
    replaceStore({
      ...store,
      blocks: store.blocks.map((block) =>
        block.id === "blk-cta-1"
          ? {
              ...block,
              inUseCount: 0
            }
          : block
      ),
      pages: []
    });

    const response = await DELETE(buildDeleteRequest("id=blk-cta-1"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: Array<{ id: string }>;
      source: string;
    };
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("fallback");
    expect(payload.data.some((block) => block.id === "blk-cta-1")).toBe(false);
  });
});
