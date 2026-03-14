import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestStrapiMock } = vi.hoisted(() => ({
  requestStrapiMock: vi.fn()
}));

vi.mock("../_lib/strapi", () => ({
  isStrapiConfigured: () => true,
  requestStrapi: requestStrapiMock,
  unwrapStrapiEntity: (value: unknown) => value
}));

import { GET, POST } from "./route";

function buildRequest(payload: Record<string, unknown>): Request {
  return new Request("http://localhost/api/platform/studio/settings", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

function mockThemeResponse(themeDebt: string) {
  return {
    data: [
      {
        id: "theme-1",
        themeKey: "default",
        name: "Default",
        status: "active",
        sourceRef: "seed",
        tokenCoverage: 0.9,
        themeDebt,
        darkMode: true,
        tokens: []
      }
    ]
  };
}

describe("studio settings route canonical schema", () => {
  beforeEach(() => {
    requestStrapiMock.mockReset();
    requestStrapiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path.includes("?filters[themeKey][$eq]=")) {
        return Promise.resolve(mockThemeResponse(""));
      }
      if (options?.method === "PUT") {
        return Promise.resolve({ data: { id: "theme-1" } });
      }
      return Promise.resolve(mockThemeResponse("[studio:fidelity-settings] {\"mode\":\"allow-below-threshold\",\"threshold\":0.25}"));
    });
  });

  it("reads settings from canonical studio-themes collection", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const firstCall = requestStrapiMock.mock.calls[0]?.[0] as string;
    expect(firstCall.startsWith("/api/studio-themes")).toBe(true);

    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      data: { fidelity: { mode: string; threshold: number } };
    };
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.data.fidelity.mode).toBe("allow-below-threshold");
  });

  it("persists settings through canonical studio-themes mutation", async () => {
    const response = await POST(
      buildRequest({
        fidelity: {
          mode: "disallow-below-threshold",
          threshold: 0.33
        }
      })
    );
    expect(response.status).toBe(200);

    const lookupCall = requestStrapiMock.mock.calls.find((call) => typeof call[0] === "string" && String(call[0]).includes("?filters[themeKey]"));
    const putCall = requestStrapiMock.mock.calls.find((call) => call[1]?.method === "PUT");

    expect(String(lookupCall?.[0]).startsWith("/api/studio-themes")).toBe(true);
    expect(String(putCall?.[0]).startsWith("/api/studio-themes/")).toBe(true);
  });

  it("hard fails when canonical settings cannot be read", async () => {
    requestStrapiMock.mockRejectedValueOnce(new Error("strapi_503: unavailable"));

    const response = await GET();
    const payload = (await response.json()) as {
      ok: boolean;
      error: string;
      developerError: string;
    };

    expect(response.status).toBe(502);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Canonical studio settings could not be read");
    expect(payload.developerError).toContain("unavailable");
  });

  it("hard fails when canonical settings cannot be persisted", async () => {
    requestStrapiMock.mockImplementationOnce(() => Promise.resolve(mockThemeResponse("")));
    requestStrapiMock.mockImplementationOnce(() => Promise.resolve(mockThemeResponse("")));
    requestStrapiMock.mockImplementationOnce(() => Promise.reject(new Error("strapi_503: write failed")));

    const response = await POST(
      buildRequest({
        fidelity: {
          mode: "disallow-below-threshold",
          threshold: 0.33
        }
      })
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: string;
      developerError: string;
    };

    expect(response.status).toBe(502);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Canonical studio settings could not be persisted");
    expect(payload.developerError).toContain("write failed");
  });
});
