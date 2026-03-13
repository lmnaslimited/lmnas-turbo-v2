import { afterEach, describe, expect, it, vi } from "vitest";
import { preflight } from "../src/strapi/graphqlClient";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("graphql preflight", () => {
  it("fails with clear message when token is missing", async () => {
    await expect(
      preflight({
        strapiUrl: "http://localhost:1337",
        token: "",
        graphqlPath: "/graphql"
      })
    ).rejects.toThrowError("Missing or invalid STRAPI_TOKEN");
  });

  it("formats 403 with remediation details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Forbidden", { status: 403, headers: { "content-type": "text/plain" } }))
    );

    await expect(
      preflight({
        strapiUrl: "http://localhost:1337",
        token: "1234567890123456789012345",
        graphqlPath: "/graphql"
      })
    ).rejects.toThrowError("Create/Use a Strapi API token with write permissions and set STRAPI_TOKEN");
  });
});
