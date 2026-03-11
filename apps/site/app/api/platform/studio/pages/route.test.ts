import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioStore, resetStore } from "../_lib/store";

vi.mock("../_lib/strapi", () => ({
  isStrapiConfigured: () => false,
  requestStrapi: vi.fn()
}));

import { POST } from "./route";

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
});
