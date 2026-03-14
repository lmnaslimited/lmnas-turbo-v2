import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioStore, resetStore } from "../../_lib/store";

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

function buildRequest(payload: Record<string, unknown>): Request {
  return new Request("http://localhost/api/platform/studio/themes/activate", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

describe("studio themes activate route canonical mode", () => {
  beforeEach(() => {
    resetStore();
    requestStrapiMock.mockReset();
  });

  it("hard fails instead of activating fallback themes when canonical activation fails", async () => {
    const initialStatuses = getStudioStore().themes.map((theme) => ({ id: theme.id, status: theme.status }));
    requestStrapiMock.mockRejectedValueOnce(new Error("strapi_503: activation failed"));

    const response = await POST(buildRequest({ id: "theme-default", themeKey: "default" }));
    const payload = (await response.json()) as {
      ok: boolean;
      error: string;
    };

    expect(response.status).toBe(502);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Canonical studio-theme activation failed");
    expect(getStudioStore().themes.map((theme) => ({ id: theme.id, status: theme.status }))).toEqual(initialStatuses);
  });
});
