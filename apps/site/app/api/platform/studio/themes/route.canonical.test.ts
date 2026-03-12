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

describe("studio themes route canonical schema", () => {
  beforeEach(() => {
    requestStrapiMock.mockReset();
    requestStrapiMock.mockResolvedValue({
      data: [
        {
          id: "theme-1",
          themeKey: "default",
          name: "Default",
          status: "active",
          sourceRef: "seed",
          tokenCoverage: 0.9,
          darkMode: true,
          tokens: []
        }
      ]
    });
  });

  it("queries canonical studio-themes collection first", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(requestStrapiMock).toHaveBeenCalled();
    const firstCall = requestStrapiMock.mock.calls[0]?.[0] as string;
    expect(firstCall.startsWith("/api/studio-themes")).toBe(true);

    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      schemaSource: string;
      data: Array<{ themeKey: string }>;
    };
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.schemaSource).toBe("canonical");
    expect(payload.data[0]?.themeKey).toBe("default");
  });
});
