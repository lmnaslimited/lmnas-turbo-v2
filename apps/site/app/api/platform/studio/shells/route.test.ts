import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioStore, resetStore } from "../_lib/store";

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

import { GET, POST } from "./route";

function buildPostRequest(payload: Record<string, unknown>): Request {
  return new Request("http://localhost/api/platform/studio/shells", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

describe("studio shells route", () => {
  beforeEach(() => {
    resetStore();
  });

  it("persists navbar/footer block arrays in fallback shell mapping", async () => {
    const response = await POST(
      buildPostRequest({
        shell: {
          id: "shell-mapping-test",
          key: "shell-mapping-test",
          name: "Shell Mapping Test",
          role: "full",
          status: "inactive",
          updatedAt: "2026-03-10",
          menuItems: [],
          actions: [],
          navbarBlocks: ["blk-hero-1", "blk-cta-1"],
          footerBlocks: ["blk-cta-1"],
          previewHtml: "<nav>Shell Mapping Test</nav>"
        }
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      data: Array<{ id: string; navbarBlocks: string[]; footerBlocks: string[] }>;
    };
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("fallback");
    const shell = payload.data.find((entry) => entry.id === "shell-mapping-test");
    expect(shell?.navbarBlocks).toEqual(["blk-hero-1", "blk-cta-1"]);
    expect(shell?.footerBlocks).toEqual(["blk-cta-1"]);
  });

  it("normalizes missing block arrays to empty lists", async () => {
    await POST(
      buildPostRequest({
        shell: {
          id: "shell-no-array",
          key: "shell-no-array",
          name: "Shell No Array",
          role: "footer",
          status: "inactive",
          updatedAt: "2026-03-10",
          menuItems: [],
          actions: [],
          previewHtml: "<footer>Shell</footer>"
        }
      })
    );

    const response = await GET();
    const payload = (await response.json()) as {
      ok: boolean;
      data: Array<{ id: string; navbarBlocks: string[]; footerBlocks: string[] }>;
    };
    expect(payload.ok).toBe(true);
    const shell = payload.data.find((entry) => entry.id === "shell-no-array");
    expect(shell?.navbarBlocks).toEqual([]);
    expect(shell?.footerBlocks).toEqual([]);
  });

  it("keeps existing shells with array mapping in seed store", () => {
    const store = getStudioStore();
    expect(store.shells.every((shell) => Array.isArray(shell.navbarBlocks))).toBe(true);
    expect(store.shells.every((shell) => Array.isArray(shell.footerBlocks))).toBe(true);
  });
});
