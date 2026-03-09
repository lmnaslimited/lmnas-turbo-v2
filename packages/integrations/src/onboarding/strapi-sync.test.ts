import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StrapiSyncPayload } from "@lmnas/contracts";
import { publishStrapiSyncPayload } from "./strapi-sync";

const basePayload: StrapiSyncPayload = {
  shellVariants: [],
  navbarVariants: [],
  footerVariants: [],
  menus: [],
  blockInstances: [],
  widgetDefinitions: [],
  widgetVariants: [],
  actionBindings: [],
  exitDefinitions: [],
  exitBindings: [],
  pageAssembly: {
    slug: "home",
    locale: "en",
    shellAssignment: {
      scope: "page",
      shellVariantId: "shell-home",
      navbarVariantId: "navbar-home",
      footerVariantId: "footer-home"
    },
    blockOrder: ["block-1"],
    widgetOrder: [],
    actionBindingIds: [],
    navbarVariantId: "navbar-home",
    footerVariantId: "footer-home"
  }
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("publishStrapiSyncPayload", () => {
  it("reports missing env keys for apply", async () => {
    process.env.STRAPI_URL = "";
    process.env.STRAPI_API_TOKEN = "";

    const result = await publishStrapiSyncPayload({
      mode: "apply",
      payload: basePayload,
      warnings: [],
      previewLinks: ["/home"]
    });

    expect(result.applied).toBe(false);
    expect(result.applyReadiness.canApply).toBe(false);
    expect(result.applyReadiness.missingEnvKeys.length).toBeGreaterThan(0);
    expect(result.warnings.some((warning) => warning.code === "strapi.apply_unavailable")).toBe(true);
  });

  it("reports invalid token when Strapi rejects credentials", async () => {
    process.env.STRAPI_URL = "http://localhost:1337";
    process.env.STRAPI_API_TOKEN = "invalid-token";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401
      }))
    );

    const result = await publishStrapiSyncPayload({
      mode: "apply",
      payload: basePayload,
      warnings: [],
      previewLinks: ["/home"]
    });

    expect(result.applied).toBe(false);
    expect(result.warnings.some((warning) => warning.code === "strapi.invalid_token")).toBe(true);
  });

  it("reports unreachable Strapi when network call fails", async () => {
    process.env.STRAPI_URL = "http://localhost:1337";
    process.env.STRAPI_API_TOKEN = "valid-token";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      })
    );

    const result = await publishStrapiSyncPayload({
      mode: "apply",
      payload: basePayload,
      warnings: [],
      previewLinks: ["/home"]
    });

    expect(result.applied).toBe(false);
    expect(result.warnings.some((warning) => warning.code === "strapi.unreachable")).toBe(true);
  });

  it("applies when Strapi responds successfully", async () => {
    process.env.STRAPI_URL = "http://localhost:1337";
    process.env.STRAPI_API_TOKEN = "valid-token";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200
      }))
    );

    const result = await publishStrapiSyncPayload({
      mode: "apply",
      payload: basePayload,
      warnings: [],
      previewLinks: ["/home"]
    });

    expect(result.applied).toBe(true);
    expect(result.applyReadiness.canApply).toBe(true);
  });
});
