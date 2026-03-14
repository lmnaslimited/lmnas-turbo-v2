import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestStrapiMock, collectWidgetStrapiProbeSnapshotMock } = vi.hoisted(() => ({
  requestStrapiMock: vi.fn(),
  collectWidgetStrapiProbeSnapshotMock: vi.fn(async () => ({
    pages: 1,
    blocks: 1,
    shells: 1,
    source: "strapi" as const,
    warnings: []
  }))
}));

vi.mock("../_lib/strapi", () => ({
  isStrapiConfigured: () => true,
  requestStrapi: requestStrapiMock,
  unwrapStrapiEntity: (value: unknown) => value
}));

vi.mock("./_lib/strapi-probe", () => ({
  collectWidgetStrapiProbeSnapshot: collectWidgetStrapiProbeSnapshotMock
}));

import { DELETE, GET, POST } from "./route";

function buildPostRequest(body: unknown): Request {
  return new Request("http://localhost/api/platform/studio/widgets", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("studio widgets route canonical mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns canonical empty widgets without degrading to fallback", async () => {
    requestStrapiMock.mockResolvedValueOnce({
      data: []
    });

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

  it("hard fails instead of persisting widget mappings to fallback", async () => {
    requestStrapiMock
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValueOnce(new Error("strapi_503: write failed"));

    const response = await POST(
      buildPostRequest({
        widget: {
          id: "widget-canonical-fail",
          key: "widget-canonical-fail",
          name: "Canonical Fail Widget",
          repoPath: "/components/widgets/calendar-widget.ts",
          placement: {
            mode: "reference"
          }
        }
      })
    );
    const payload = (await response.json()) as {
      ok: boolean;
      error: string;
    };

    expect(response.status).toBe(502);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Canonical studio widgets could not be persisted");
  });

  it("hard fails instead of deleting widget mappings through fallback", async () => {
    requestStrapiMock.mockRejectedValueOnce(new Error("strapi_503: delete failed"));

    const response = await DELETE(new Request("http://localhost/api/platform/studio/widgets?id=widget-1", { method: "DELETE" }));
    const payload = (await response.json()) as {
      ok: boolean;
      error: string;
    };

    expect(response.status).toBe(502);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Canonical studio widgets could not be deleted");
  });
});
