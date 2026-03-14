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

  it("persists tokenized canonical theme data without preview artifacts", async () => {
    requestStrapiMock.mockImplementation((path: string, init?: { method?: string; body?: Record<string, unknown> }) => {
      if (path.startsWith("/api/studio-themes?")) {
        return Promise.resolve({ data: [] });
      }
      if (path === "/api/studio-themes" && init?.method === "POST") {
        return Promise.resolve({ data: { documentId: "theme-canonical-1" } });
      }
      return Promise.resolve({
        data: [
          {
            documentId: "theme-canonical-1",
            themeKey: "aurora",
            name: "Aurora",
            status: "active",
            sourceRef: "figma://aurora",
            themeScopeClass: "theme-aurora",
            themeMode: "dark",
            tokenCoverage: 0.94,
            themeDebt: "2 unmapped semantic aliases",
            darkMode: true,
            tokens: [
              {
                key: "primary",
                value: "#1a73e8",
                label: "Primary",
                category: "color",
                cssVariable: "--color-primary",
                mapped: true
              }
            ]
          }
        ]
      });
    });

    const response = await POST(
      buildRequest({
        mode: "create",
        sourceType: "html_upload",
        theme: {
          id: "theme-canonical-1",
          themeKey: "aurora",
          name: "Aurora",
          status: "active",
          sourceRef: "figma://aurora",
          themeScopeClass: "theme-aurora",
          themeMode: "dark",
          tokenCoverage: 0.94,
          themeDebt: "2 unmapped semantic aliases",
          darkMode: true,
          tokens: [
            {
              key: "primary",
              value: "#1a73e8",
              label: "Primary",
              category: "color",
              cssVariable: "--color-primary",
              mapped: true
            }
          ]
        }
      })
    );

    expect(response.status).toBe(200);
    const createCall = requestStrapiMock.mock.calls.find((call) => call[0] === "/api/studio-themes" && call[1]?.method === "POST");
    expect(createCall?.[1]?.body).toEqual({
      themeKey: "aurora",
      name: "Aurora",
      status: "active",
      sourceRef: "figma://aurora",
      themeScopeClass: "theme-aurora",
      themeMode: "dark",
      tokenCoverage: 0.94,
      themeDebt: "2 unmapped semantic aliases",
      darkMode: true,
      tokens: [
        {
          key: "primary",
          value: "#1a73e8",
          label: "Primary",
          category: "color",
          cssVariable: "--color-primary",
          mapped: true
        }
      ]
    });

    const serialized = JSON.stringify(createCall?.[1]?.body ?? {});
    expect(serialized).not.toContain("localhost");
    expect(serialized).not.toContain("_next/static");
    expect(serialized).not.toContain("<script");
  });
});
