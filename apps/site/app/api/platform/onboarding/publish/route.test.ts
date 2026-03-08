import { describe, expect, it, vi } from "vitest";

const { publishOnboardingDraftMock } = vi.hoisted(() => ({
  publishOnboardingDraftMock: vi.fn(async () => ({
    mode: "dry-run",
    applied: false,
    summary: {
      shellsToCreate: 1,
      blocksToCreate: 2,
      widgetsToCreate: 1,
      actionsToCreate: 2,
      exitsRequired: 1,
      editableFieldsCreated: 6,
      warningsCount: 0
    },
    previewLinks: ["/home"],
    warnings: [],
    strapiPayload: {
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
