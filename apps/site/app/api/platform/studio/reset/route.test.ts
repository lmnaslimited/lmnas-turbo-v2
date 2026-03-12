import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioStore, replaceStore, resetStore } from "../_lib/store";

const {
  isStrapiConfiguredMock,
  isLegacyWipeEnabledMock,
  wipeLegacyStudioEntriesMock,
  resetCanonicalStudioSchemaMock
} = vi.hoisted(() => ({
  isStrapiConfiguredMock: vi.fn(() => false),
  isLegacyWipeEnabledMock: vi.fn(() => false),
  wipeLegacyStudioEntriesMock: vi.fn(),
  resetCanonicalStudioSchemaMock: vi.fn()
}));

vi.mock("../_lib/strapi", () => ({
  isStrapiConfigured: isStrapiConfiguredMock
}));

vi.mock("../_lib/legacy-cleanup", () => ({
  isLegacyWipeEnabled: isLegacyWipeEnabledMock,
  wipeLegacyStudioEntries: wipeLegacyStudioEntriesMock
}));

vi.mock("../_lib/canonical-isolation", () => ({
  resetCanonicalStudioSchema: resetCanonicalStudioSchemaMock
}));

import { POST } from "./route";

describe("studio reset route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    isStrapiConfiguredMock.mockReturnValue(false);
    isLegacyWipeEnabledMock.mockReturnValue(false);
    resetCanonicalStudioSchemaMock.mockResolvedValue({
      executedAt: "2026-03-10T00:00:00.000Z",
      collections: [],
      sterile: true
    });
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
    expect(payload.data.pages).toBeGreaterThan(0);
    expect(payload.data.widgets).toBeGreaterThan(0);
    expect(wipeLegacyStudioEntriesMock).not.toHaveBeenCalled();
    expect(resetCanonicalStudioSchemaMock).not.toHaveBeenCalled();
  });

  it("runs canonical reset and optional legacy cleanup when configured", async () => {
    isStrapiConfiguredMock.mockReturnValue(true);
    isLegacyWipeEnabledMock.mockReturnValue(true);
    resetCanonicalStudioSchemaMock.mockResolvedValue({
      executedAt: "2026-03-10T00:00:00.000Z",
      collections: [
        { key: "themes", endpoint: "/api/studio-themes", before: 2, deleted: 2, seeded: 2, after: 2 },
        { key: "shells", endpoint: "/api/studio-shells", before: 2, deleted: 2, seeded: 2, after: 2 },
        { key: "blocks", endpoint: "/api/studio-blocks", before: 2, deleted: 2, seeded: 2, after: 2 },
        { key: "widgets", endpoint: "/api/studio-widgets", before: 1, deleted: 1, seeded: 1, after: 1 },
        { key: "pages", endpoint: "/api/studio-pages", before: 1, deleted: 1, seeded: 1, after: 1 }
      ],
      sterile: true
    });
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
        canonicalCollectionsReset: number;
        canonicalSterile: boolean;
        legacyBlockTemplatesBefore?: number;
        legacyBlockTemplatesAfter?: number;
        pagesWithLegacyBlocksBefore?: number;
        pagesWithLegacyBlocksAfter?: number;
        legacySterile?: boolean;
      };
      canonical: { sterile: boolean };
      cleanup: { sterile: boolean };
    };

    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.data.canonicalCollectionsReset).toBe(5);
    expect(payload.data.canonicalSterile).toBe(true);
    expect(payload.data.legacyBlockTemplatesBefore).toBe(1);
    expect(payload.data.legacyBlockTemplatesAfter).toBe(0);
    expect(payload.data.pagesWithLegacyBlocksBefore).toBe(1);
    expect(payload.data.pagesWithLegacyBlocksAfter).toBe(0);
    expect(payload.data.legacySterile).toBe(true);
    expect(payload.canonical.sterile).toBe(true);
    expect(payload.cleanup.sterile).toBe(true);
    expect(resetCanonicalStudioSchemaMock).toHaveBeenCalledTimes(1);
    expect(wipeLegacyStudioEntriesMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to local reset when Strapi canonical reset throws", async () => {
    isStrapiConfiguredMock.mockReturnValue(true);
    isLegacyWipeEnabledMock.mockReturnValue(true);
    resetCanonicalStudioSchemaMock.mockRejectedValue(new Error("strapi_503: connection refused"));

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
    expect(payload.warning).toContain("Strapi canonical isolation failed");
    expect(payload.developerError).toContain("connection refused");
    expect(payload.data.themes).toBeGreaterThan(0);
    expect(resetCanonicalStudioSchemaMock).toHaveBeenCalledTimes(1);
  });
});
