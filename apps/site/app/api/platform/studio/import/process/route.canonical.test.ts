import type { OnboardingAnalysis } from "@lmnas/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { analyzeOnboardingSourceMock, requestStrapiMock } = vi.hoisted(() => ({
  analyzeOnboardingSourceMock: vi.fn(),
  requestStrapiMock: vi.fn()
}));

vi.mock("@lmnas/integrations", () => ({
  analyzeOnboardingSource: analyzeOnboardingSourceMock
}));

vi.mock("../../../../../lib/env", () => ({
  loadProjectEnv: () => undefined
}));

vi.mock("../../_lib/strapi", () => ({
  isStrapiConfigured: () => true,
  requestStrapi: requestStrapiMock
}));

import { POST } from "./route";

function buildPostRequest(payload: Record<string, unknown>): Request {
  return new Request("http://localhost/api/platform/studio/import/process", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

function buildAnalysis(): OnboardingAnalysis {
  return {
    intake: {
      sourceType: "raw_html",
      sourceValue: "<section>Hero</section>",
      slug: "import-source",
      locale: "en",
      themeKey: "default"
    },
    source: {
      sourceRef: "raw-html",
      referencePreviewHtml: "<main><section>source</section></main>",
      productionPreviewHtml: "<main><section>target</section></main>",
      themeScopeClass: "theme-default",
      styleProfile: {
        appliedStrategy: "source_document",
        inlineStyleTagCount: 0,
        linkedStylesheetCount: 0,
        unresolvedStylesheetCount: 0,
        fidelityNotes: []
      }
    },
    shellCandidates: [],
    blockProposals: [
      {
        id: "hero-1",
        family: "hero",
        selectorHint: "section.hero",
        confidence: 0.92,
        editableFields: [],
        ctaLabels: [],
        actionIds: [],
        segmentation: "keep",
        rawHtmlSnippet: "<section class='hero'><h1>Hero</h1></section>",
        previewHtml: "<section class='hero'><h1>Hero</h1></section>"
      }
    ],
    widgetProposals: [],
    actionProposals: [],
    exitProposals: [],
    theme: {
      themeKey: "default",
      tokenFirstMatchRatio: 0.9,
      arbitraryValueCount: 0,
      themeDebtSummary: "none",
      hasDarkModeTrigger: false,
      extractedFonts: [],
      extractedColors: {},
      utilityClassUsages: []
    },
    fidelityWarnings: []
  };
}

describe("studio import process route canonical persistence", () => {
  beforeEach(() => {
    analyzeOnboardingSourceMock.mockReset();
    analyzeOnboardingSourceMock.mockResolvedValue(buildAnalysis());
    requestStrapiMock.mockReset();
    requestStrapiMock.mockImplementation((path: string, init?: { method?: string }) => {
      if (typeof path === "string" && path.startsWith("/api/studio-themes?")) {
        return Promise.resolve({ data: [{ id: "theme-1", themeKey: "default", name: "Default", darkMode: true, tokens: [] }] });
      }
      if (typeof path === "string" && path.startsWith("/api/studio-shells?")) {
        return Promise.resolve({ data: [{ id: "shell-1", shellKey: "shell-main", name: "Main", role: "full", previewHtml: "<nav></nav>" }] });
      }
      if (typeof path === "string" && path.startsWith("/api/studio-import-masters") && init?.method === "POST") {
        return Promise.resolve({ data: { id: "import-master-1", importKey: "import-source-1" } });
      }
      if (typeof path === "string" && path.startsWith("/api/studio-blocks?")) {
        return Promise.resolve({ data: [] });
      }
      if (typeof path === "string" && path === "/api/studio-blocks") {
        return Promise.resolve({ data: { id: "studio-block-1" } });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it("writes processed proposals to canonical studio-blocks collection", async () => {
    const response = await POST(
      buildPostRequest({
        sourceType: "raw_html",
        sourceValue: "<section class='hero'><h1>Hero</h1></section>",
        slug: "import-source",
        locale: "en",
        themeKey: "default"
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      analysis: OnboardingAnalysis;
      persistence: {
        source: string;
        schemaSource: string;
        proposalsPersisted: number;
        importMaster?: {
          id: string;
          importKey: string;
          status: string;
        };
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.persistence.source).toBe("strapi");
    expect(payload.persistence.schemaSource).toBe("canonical");
    expect(payload.persistence.proposalsPersisted).toBe(1);
    expect(payload.persistence.importMaster?.id).toBe("import-master-1");
    expect(payload.persistence.importMaster?.status).toBe("processed");
    expect(payload.analysis.source.productionPreviewHtml.length).toBeGreaterThan(0);

    const calls = requestStrapiMock.mock.calls.map((entry) => entry[0]);
    expect(calls.some((path: string) => typeof path === "string" && path.startsWith("/api/studio-import-masters"))).toBe(true);
    expect(calls.some((path: string) => typeof path === "string" && path.startsWith("/api/studio-blocks?"))).toBe(true);
    expect(calls.some((path: string) => path === "/api/studio-blocks")).toBe(true);
  });
});
