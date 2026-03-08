import { describe, expect, it, vi } from "vitest";

const { analyzeOnboardingSourceMock } = vi.hoisted(() => ({
  analyzeOnboardingSourceMock: vi.fn(async () => ({
    intake: {
      sourceType: "raw_html",
      sourceValue: "<section></section>",
      slug: "home",
      locale: "en",
      themeKey: "default"
    },
    shellCandidates: [],
    blockProposals: [],
    exitProposals: [],
    theme: {
      themeKey: "default",
      tokenFirstMatchRatio: 1,
      arbitraryValueCount: 0,
      themeDebtSummary: "ok"
    },
    fidelityWarnings: []
  }))
}));

vi.mock("@lmnas/integrations", () => ({
  analyzeOnboardingSource: analyzeOnboardingSourceMock
}));

import { POST } from "./route";

describe("onboarding analyze route", () => {
  it("returns analysis payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/platform/onboarding/analyze", {
        method: "POST",
        body: JSON.stringify({
          sourceType: "raw_html",
          sourceValue: "<section></section>",
          slug: "home",
          locale: "en",
          themeKey: "default"
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { ok: boolean };
    expect(payload.ok).toBe(true);
    expect(analyzeOnboardingSourceMock).toHaveBeenCalledTimes(1);
  });
});
