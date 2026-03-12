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

import { GET } from "./route";

describe("studio blocks route canonical schema", () => {
  beforeEach(() => {
    requestStrapiMock.mockReset();
    requestStrapiMock.mockResolvedValue({
      data: [
        {
          id: "block-1",
          blockKey: "blk-hero-1",
          name: "Hero",
          family: "hero",
          status: "active",
          lifecycle: "draft",
          scope: "global",
          schemaStatus: "valid",
          themeKey: "default",
          sourceType: "seed",
          sourceRef: "seed",
          confidence: 1,
          editableFields: [],
          actions: [],
          previewHtml: "<section />",
          usageCount: 0
        }
      ]
    });
  });

  it("queries canonical studio-blocks collection first", async () => {
    const request = new Request("http://localhost/api/platform/studio/blocks", {
      method: "GET"
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(requestStrapiMock).toHaveBeenCalled();
    const firstCall = requestStrapiMock.mock.calls[0]?.[0] as string;
    expect(firstCall.startsWith("/api/studio-blocks")).toBe(true);

    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      schemaSource: string;
      data: Array<{ key: string }>;
    };
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.schemaSource).toBe("canonical");
    expect(payload.data[0]?.key).toBe("blk-hero-1");
  });
});
