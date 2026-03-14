import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioStore, resetStore } from "../_lib/store";

vi.mock("../_lib/strapi", () => ({
  isStrapiConfigured: () => false,
  requestStrapi: vi.fn(),
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

describe("studio settings route", () => {
  beforeEach(() => {
    resetStore();
  });

  it("returns fallback settings by default", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      data: {
        fidelity: {
          mode: string;
          threshold: number;
        };
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("fallback");
    expect(payload.data.fidelity.mode).toBe("allow-below-threshold");
  });

  it("updates fidelity mode and threshold", async () => {
    const response = await POST(
      buildRequest({
        fidelity: {
          mode: "disallow-below-threshold",
          threshold: 0.33
        }
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: {
        fidelity: {
          mode: string;
          threshold: number;
        };
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.fidelity.mode).toBe("disallow-below-threshold");
    expect(payload.data.fidelity.threshold).toBe(0.33);
    expect(getStudioStore().settings.fidelity.mode).toBe("disallow-below-threshold");
  });
});
