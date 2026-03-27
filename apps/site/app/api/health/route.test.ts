import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("/api/health", () => {
  it("returns ok response", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("site");
  });
});
