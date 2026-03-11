import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioStore, replaceStore, resetStore } from "../_lib/store";

const { isStrapiConfiguredMock, isLegacyWipeEnabledMock, wipeLegacyStudioEntriesMock } = vi.hoisted(() => ({
  isStrapiConfiguredMock: vi.fn(() => false),
  isLegacyWipeEnabledMock: vi.fn(() => false),
  wipeLegacyStudioEntriesMock: vi.fn()
}));

vi.mock("../_lib/strapi", () => ({
  isStrapiConfigured: isStrapiConfiguredMock
}));

vi.mock("../_lib/legacy-cleanup", () => ({
  isLegacyWipeEnabled: isLegacyWipeEnabledMock,
  wipeLegacyStudioEntries: wipeLegacyStudioEntriesMock
}));

import { POST } from "./route";

describe("studio reset route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    isStrapiConfiguredMock.mockReturnValue(false);
    isLegacyWipeEnabledMock.mockReturnValue(false);
  });

  it("resets fallback store when Strapi cleanup is not enabled", async () => {
    const store = getStudioStore();
    replaceStore({
      ...store,
      themes: [],
      shells: [],
      blocks: [],
      pages: []
    });

    const response = await POST();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      data: { themes: number; shells: number; blocks: number; pages: number; widgets: number };
    };

    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("fallback");
    expect(payload.data.themes).toBeGreaterThan(0);
    expect(payload.data.shells).toBeGreaterThan(0);
    expect(payload.data.blocks).toBeGreaterThan(0);
    expect(payload.data.pages).toBe(0);
    expect(payload.data.widgets).toBeGreaterThan(0);
    expect(wipeLegacyStudioEntriesMock).not.toHaveBeenCalled();
  });

  it("runs Strapi cleanup when configured and enabled", async () => {
    isStrapiConfiguredMock.mockReturnValue(true);
    isLegacyWipeEnabledMock.mockReturnValue(true);
    wipeLegacyStudioEntriesMock.mockResolvedValue({
      executedAt: "2026-03-10T00:00:00.000Z",
      blockTemplates: {
        before: [{ id: "1", templateKey: "legacy-hero", family: "hero" }],
        deletedIds: ["1"],
        after: []
      },
      pages: {
        before: [{ id: "pg-1", slug: "home", locale: "en", totalBlocks: 2, legacyBlockCount: 1 }],
        updated: [{ id: "pg-1", slug: "home", locale: "en", removedLegacyBlocks: 1, totalBlocksAfter: 1 }],
        after: [{ id: "pg-1", slug: "home", locale: "en", totalBlocks: 1, legacyBlockCount: 0 }]
      },
      sterile: true
    });

    const response = await POST();
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      data: {
        legacyBlockTemplatesBefore: number;
        legacyBlockTemplatesAfter: number;
        pagesWithLegacyBlocksBefore: number;
        pagesWithLegacyBlocksAfter: number;
        sterile: boolean;
      };
      cleanup: { sterile: boolean };
    };

    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.data.legacyBlockTemplatesBefore).toBe(1);
    expect(payload.data.legacyBlockTemplatesAfter).toBe(0);
    expect(payload.data.pagesWithLegacyBlocksBefore).toBe(1);
    expect(payload.data.pagesWithLegacyBlocksAfter).toBe(0);
    expect(payload.data.sterile).toBe(true);
    expect(payload.cleanup.sterile).toBe(true);
    expect(wipeLegacyStudioEntriesMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to local reset when Strapi cleanup throws", async () => {
    isStrapiConfiguredMock.mockReturnValue(true);
    isLegacyWipeEnabledMock.mockReturnValue(true);
    wipeLegacyStudioEntriesMock.mockRejectedValue(new Error("strapi_503: connection refused"));

    const response = await POST();
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      warning?: string;
      developerError?: string;
      data: { themes: number };
    };

    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("fallback");
    expect(payload.warning).toContain("Strapi cleanup failed");
    expect(payload.developerError).toContain("connection refused");
    expect(payload.data.themes).toBeGreaterThan(0);
  });
});
