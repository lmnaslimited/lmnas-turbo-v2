import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioStore, resetStore } from "../_lib/store";

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

import { GET, POST } from "./route";

function buildRequest(payload: Record<string, unknown>): Request {
  return new Request("http://localhost/api/platform/studio/themes", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

describe("studio themes route canonical mode", () => {
  beforeEach(() => {
    resetStore();
    requestStrapiMock.mockReset();
  });

  it("returns canonical empty themes without degrading to fallback", async () => {
    requestStrapiMock.mockResolvedValue({ data: [] });

    const response = await GET();
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      data: unknown[];
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.data).toEqual([]);
  });

  it("hard fails instead of writing fallback themes when canonical persistence fails", async () => {
    const initialThemeIds = getStudioStore().themes.map((theme) => theme.id);
    requestStrapiMock.mockRejectedValueOnce(new Error("strapi_503: unavailable"));

    const response = await POST(
      buildRequest({
        mode: "create",
        sourceType: "html_upload",
        theme: {
          id: "theme-new",
          themeKey: "theme-new",
          name: "Theme New",
          status: "draft",
          sourceRef: "theme-import",
          tokenCoverage: 0.8,
          darkMode: true,
          tokens: []
        }
      })
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: string;
    };

    expect(response.status).toBe(502);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Canonical studio-theme persistence failed");
    expect(getStudioStore().themes.map((theme) => theme.id)).toEqual(initialThemeIds);
  });
});
