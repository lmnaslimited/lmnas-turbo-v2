import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioStore, replaceStore, resetStore } from "../../_lib/store";

vi.mock("../../_lib/strapi", () => ({
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
  return new Request("http://localhost/api/platform/studio/themes/activate", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

describe("studio themes activate route", () => {
  beforeEach(() => {
    resetStore();
  });

  it("activates selected fallback theme by id", async () => {
    const store = getStudioStore();
    replaceStore({
      ...store,
      themes: store.themes.map((theme) => ({
        ...theme,
        status: "inactive" as const
      }))
    });

    const response = await POST(buildRequest({ id: "theme-default" }));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: Array<{ id: string; status: string }>;
      source: string;
    };
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("fallback");
    expect(payload.data.find((theme) => theme.id === "theme-default")?.status).toBe("active");
  });

  it("activates fallback theme by themeKey when request id is Strapi-scoped", async () => {
    const response = await POST(
      buildRequest({
        id: "theme-document-id-from-strapi",
        themeKey: "default"
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: Array<{ id: string; themeKey: string; status: string }>;
    };
    expect(payload.ok).toBe(true);
    const activated = payload.data.find((theme) => theme.themeKey === "default");
    expect(activated?.status).toBe("active");
    expect(payload.data.some((theme) => theme.status === "active")).toBe(true);
  });
});
