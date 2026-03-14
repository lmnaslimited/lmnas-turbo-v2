import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestStrapiMock } = vi.hoisted(() => ({
  requestStrapiMock: vi.fn()
}));

vi.mock("../../_lib/strapi", () => ({
  isStrapiConfigured: () => true,
  requestStrapi: requestStrapiMock,
  StudioApiError: class StudioApiError extends Error {
    status = 500;
    operatorMessage = "error";
    developerMessage = "error";
  },
  unwrapStrapiEntity: (value: unknown) => value
}));

import { POST } from "./route";

describe("studio shell activation canonical mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hard fails instead of activating fallback shells when Strapi fails", async () => {
    requestStrapiMock.mockRejectedValueOnce(new Error("strapi_503: unavailable"));

    const response = await POST(
      new Request("http://localhost/api/platform/studio/shells/activate", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          id: "shell-main",
          key: "shell-main"
        })
      })
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: string;
      developerError: string;
    };

    expect(response.status).toBe(502);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Canonical studio shell activation failed");
    expect(payload.developerError).toContain("unavailable");
  });
});
