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
});
