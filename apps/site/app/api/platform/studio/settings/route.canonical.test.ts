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

describe("studio settings route canonical schema", () => {
  beforeEach(() => {
    requestStrapiMock.mockReset();
    requestStrapiMock.mockImplementation((path: string, options?: { method?: string; body?: Record<string, unknown> }) => {
      if (path === "/api/studio-setting" && !options?.method) {
        return Promise.resolve({
          data: {
            fidelityMode: "allow-below-threshold",
            fidelityThreshold: 0.25
          }
        });
      }

      if (path === "/api/studio-setting" && options?.method === "PUT") {
        return Promise.resolve({
          data: {
            id: "studio-setting",
            ...options.body
          }
        });
      }

      return Promise.resolve({ data: null });
    });
  });

  it("reads settings from canonical studio-setting single type", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(requestStrapiMock).toHaveBeenCalledWith("/api/studio-setting");

    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      data: { fidelity: { mode: string; threshold: number } };
    };
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.data.fidelity.mode).toBe("allow-below-threshold");
    expect(payload.data.fidelity.threshold).toBe(0.25);
  });

  it("persists settings through canonical studio-setting mutation only", async () => {
    const response = await POST(
      buildRequest({
        fidelity: {
          mode: "disallow-below-threshold",
          threshold: 0.33
        }
      })
    );
    expect(response.status).toBe(200);

    const putCall = requestStrapiMock.mock.calls.find((call) => call[0] === "/api/studio-setting" && call[1]?.method === "PUT");
    expect(putCall).toBeTruthy();
    expect(putCall?.[1]?.body).toEqual({
      fidelityMode: "disallow-below-threshold",
      fidelityThreshold: 0.33
    });
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
    requestStrapiMock.mockRejectedValueOnce(new Error("strapi_503: write failed"));

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
