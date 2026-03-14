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

import { POST } from "./route";

function buildRequest(payload: Record<string, unknown>): Request {
  return new Request("http://localhost/api/platform/studio/themes", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

describe("studio themes route", () => {
  beforeEach(() => {
    resetStore();
  });

  it("rejects duplicate theme create requests with explicit warning contract", async () => {
    const store = getStudioStore();
    const seedTheme = store.themes[0];
    const response = await POST(
      buildRequest({
        mode: "create",
        sourceType: "html_upload",
        theme: {
          id: "theme-duplicate-attempt",
          themeKey: seedTheme.themeKey,
          name: seedTheme.name,
          status: "draft",
          sourceRef: "duplicate upload",
          tokenCoverage: 0.5,
          darkMode: false,
          tokens: []
        }
      })
    );

    expect(response.status).toBe(409);
    const payload = (await response.json()) as {
      ok: boolean;
      code: string;
      duplicateThemeId: string;
      error: string;
    };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("theme.duplicate");
    expect(payload.duplicateThemeId).toBe(seedTheme.id);
    expect(payload.error).toContain("already exists");
  });

  it("allows existing theme upsert without duplicate trap", async () => {
    const store = getStudioStore();
    const seedTheme = store.themes[0];
    const response = await POST(
      buildRequest({
        mode: "upsert",
        sourceType: "html_upload",
        theme: {
          ...seedTheme,
          tokenCoverage: 0.99
        }
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: Array<{ id: string; tokenCoverage: number }>;
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.find((theme) => theme.id === seedTheme.id)?.tokenCoverage).toBe(0.99);
  });

  it("rejects unsupported source types", async () => {
    const response = await POST(
      buildRequest({
        mode: "create",
        sourceType: "binary_blob",
        theme: {
          id: "theme-unsupported",
          themeKey: "unsupported",
          name: "Unsupported",
          status: "draft",
          sourceRef: "unsupported",
          tokenCoverage: 0,
          darkMode: false,
          tokens: []
        }
      })
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      ok: boolean;
      code: string;
      error: string;
    };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("theme.source_type_invalid");
    expect(payload.error).toContain("Allowed values");
  });
});
