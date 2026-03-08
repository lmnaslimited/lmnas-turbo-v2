import { describe, expect, it, vi } from "vitest";

const { publishOnboardingDraftMock } = vi.hoisted(() => ({
  publishOnboardingDraftMock: vi.fn(async () => ({
    mode: "dry-run",
    applied: false,
    summary: {
      shellVariants: 1,
      blockInstances: 2,
      exitDefinitions: 1,
      exitBindings: 1
    },
    warnings: [],
    strapiPayload: {
      shellVariants: [],
      navbarVariants: [],
      footerVariants: [],
      menus: [],
      blockInstances: [],
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
        navbarVariantId: "navbar-home",
        footerVariantId: "footer-home"
      }
    }
  }))
}));

vi.mock("@lmnas/integrations", () => ({
  publishOnboardingDraft: publishOnboardingDraftMock
}));

import { POST } from "./route";

describe("onboarding publish route", () => {
  it("returns publish payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/platform/onboarding/publish", {
        method: "POST",
        body: JSON.stringify({
          mode: "dry-run"
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { ok: boolean };
    expect(payload.ok).toBe(true);
    expect(publishOnboardingDraftMock).toHaveBeenCalledTimes(1);
  });
});
