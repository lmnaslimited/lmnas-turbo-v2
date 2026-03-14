import { beforeEach, describe, expect, it, vi } from "vitest";

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
  return new Request("http://localhost/api/platform/studio/shells", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

describe("studio shells route canonical schema", () => {
  beforeEach(() => {
    requestStrapiMock.mockReset();
    requestStrapiMock.mockResolvedValue({
      data: [
        {
          id: "shell-1",
          shellKey: "shell-main",
          name: "Main Shell",
          role: "full",
          status: "active",
          menuItems: [],
          actions: [],
          navbarBlocks: [],
          footerBlocks: [],
          previewHtml: "<div />"
        }
      ]
    });
  });

  it("queries canonical studio-shells collection first", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(requestStrapiMock).toHaveBeenCalled();
    const firstCall = requestStrapiMock.mock.calls[0]?.[0] as string;
    expect(firstCall.startsWith("/api/studio-shells")).toBe(true);

    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      schemaSource: string;
      data: Array<{ key: string }>;
    };
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.schemaSource).toBe("canonical");
    expect(payload.data[0]?.key).toBe("shell-main");
  });

  it("hard fails instead of reading legacy or fallback shells when canonical read fails", async () => {
    requestStrapiMock.mockRejectedValueOnce(new Error("strapi_503: unavailable"));

    const response = await GET();
    const payload = (await response.json()) as {
      ok: boolean;
      error: string;
      developerError: string;
    };

    expect(response.status).toBe(502);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Canonical studio shells could not be read");
    expect(payload.developerError).toContain("unavailable");
  });

  it("hard fails instead of persisting shells through legacy or fallback paths", async () => {
    requestStrapiMock.mockResolvedValueOnce({
      data: []
    });
    requestStrapiMock.mockRejectedValueOnce(new Error("strapi_503: write failed"));

    const response = await POST(
      buildRequest({
        shell: {
          id: "shell-2",
          key: "shell-secondary",
          name: "Secondary Shell",
          role: "full",
          status: "inactive",
          menuItems: [],
          actions: [],
          navbarBlocks: [],
          footerBlocks: [],
          previewHtml: "<nav />"
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
    expect(payload.error).toContain("Canonical studio shells could not be persisted");
    expect(payload.developerError).toContain("write failed");
  });
});
