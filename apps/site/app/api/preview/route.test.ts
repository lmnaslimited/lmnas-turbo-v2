import { beforeEach, describe, expect, it, vi } from "vitest";

const { enableMock, draftModeMock } = vi.hoisted(() => {
  const enable = vi.fn();
  const draftMode = vi.fn(async () => ({ isEnabled: false, enable }));
  return { enableMock: enable, draftModeMock: draftMode };
});

vi.mock("next/headers", () => ({
  draftMode: draftModeMock
}));

import { GET } from "./route";

describe("/api/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRAPI_PREVIEW_TOKEN = "local-preview-token";
  });

  it("rejects invalid secret", async () => {
    const request = new Request("http://localhost:3000/api/preview?url=/&secret=wrong");
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(await response.text()).toContain("Invalid preview token");
    expect(draftModeMock).not.toHaveBeenCalled();
  });

  it("enables draft mode and redirects to target", async () => {
    const request = new Request("http://localhost:3000/api/preview?url=/about&secret=local-preview-token");
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/about");
    expect(draftModeMock).toHaveBeenCalledTimes(1);
    expect(enableMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes slug/home target to root", async () => {
    const request = new Request("http://localhost:3000/api/preview?slug=home&secret=local-preview-token");
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });
});
