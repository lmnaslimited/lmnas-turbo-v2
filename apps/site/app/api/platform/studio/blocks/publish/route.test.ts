import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type OnboardingAnalysis,
  type OnboardingPublishRequest
} from "../../../../../../../../packages/contracts/src/platform.contracts";

const { publishOnboardingDraftMock, requestStrapiMock } = vi.hoisted(() => ({
  publishOnboardingDraftMock: vi.fn(),
  requestStrapiMock: vi.fn()
}));

vi.mock("@lmnas/integrations", () => ({
  publishOnboardingDraft: publishOnboardingDraftMock
}));

vi.mock("@lmnas/contracts", () => ({
  parseOnboardingPublishRequest: (value: unknown) => value,
  parseOnboardingPublishResult: (value: unknown) => value
}));

vi.mock("../../_lib/strapi", () => ({
  isStrapiConfigured: () => true,
  requestStrapi: requestStrapiMock,
  StudioApiError: class StudioApiError extends Error {
    status = 500;
    operatorMessage = "error";
    developerMessage = "error";
  }
}));

vi.mock("../../../../../lib/env", () => ({
  loadProjectEnv: () => undefined
}));

import { POST } from "./route";

function buildAnalysis(): OnboardingAnalysis {
  return {
    intake: {
      sourceType: "raw_html",
      sourceValue: "<section><h1>Hero</h1></section>",
      slug: "import-source",
      locale: "en",
      themeKey: "default"
    },
    source: {
      sourceRef: "docs/testing-artifacts/code.html",
      referencePreviewHtml: "<main><section>Source</section></main>",
      productionPreviewHtml: "<main><section>Target</section></main>",
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
        displayName: "Imported Hero",
        family: "hero",
        selectorHint: "section.hero",
        confidence: 0.93,
        editableFields: ["heading"],
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

function buildRequest(body: OnboardingPublishRequest & { importMasterId?: string }): Request {
  return new Request("http://localhost/api/platform/studio/blocks/publish", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("studio block publish route", () => {
  beforeEach(() => {
    publishOnboardingDraftMock.mockReset();
    requestStrapiMock.mockReset();
  });

  it("persists edited display names when a repeated import maps to an existing canonical block", async () => {
    publishOnboardingDraftMock.mockImplementation(async (input: OnboardingPublishRequest) => {
      const nextDisplayName = input.overrides.displayNameOverrides["hero-1"] ?? "Imported Hero";
      return {
        mode: "dry-run",
        applied: false,
        applyReadiness: {
          canApply: true,
          missingEnvKeys: [],
          operatorMessage: "Ready to apply",
          developerMessage: "ready"
        },
        summary: {
          shellsToCreate: 0,
          blocksToCreate: 1,
          widgetsToCreate: 0,
          actionsToCreate: 0,
          exitsRequired: 0,
          editableFieldsCreated: 1,
          warningsCount: 0
        },
        previewLinks: ["/platform/onboarding/import"],
        warnings: [],
        assemblyPreviewHtml: "<main><section>Assembly</section></main>",
        strapiPayload: {
          shellVariants: [],
          navbarVariants: [],
          footerVariants: [],
          menus: [],
          blockInstances: [
            {
              ...input.analysis.blockProposals[0],
              displayName: nextDisplayName
            }
          ],
          widgetDefinitions: [],
          widgetVariants: [],
          actionBindings: [],
          exitDefinitions: [],
          exitBindings: [],
          pageAssembly: {
            slug: input.analysis.intake.slug,
            locale: input.analysis.intake.locale,
            shellAssignment: {
              scope: "site",
              shellVariantId: "shell-variant-1",
              navbarVariantId: "navbar-variant-1",
              footerVariantId: "footer-variant-1"
            },
            blockOrder: ["hero-1"],
            widgetOrder: [],
            actionBindingIds: [],
            footerVariantId: "footer-variant-1",
            navbarVariantId: "navbar-variant-1"
          }
        }
      };
    });

    requestStrapiMock.mockImplementation((path: string, init?: { method?: string; body?: Record<string, unknown> }) => {
      if (typeof path === "string" && path.startsWith("/api/studio-blocks?filters[blockKey][$eq]=")) {
        return Promise.resolve({
          data: [
            {
              documentId: "block-doc-1",
              blockKey: "import-source-hero-1-01",
              name: "Imported Hero",
              previewHtml: "<section class='hero'><h1>Hero</h1></section>",
              targetPreviewHtml: "<section class='hero'><h1>Hero</h1></section>"
            }
          ]
        });
      }

      if (typeof path === "string" && path === "/api/studio-blocks/block-doc-1" && init?.method === "PUT") {
        expect(init.body?.name).toBe("Executive Testimonial");
        expect(init.body?.blockKey).toBe("import-source-hero-1-01");
        return Promise.resolve({
          data: { documentId: "block-doc-1" }
        });
      }

      if (typeof path === "string" && path === "/api/studio-import-masters/import-master-1" && init?.method === "PUT") {
        expect(init.body?.status).toBe("imported_blocks");
        return Promise.resolve({
          data: { documentId: "import-master-1" }
        });
      }

      return Promise.resolve({ data: [] });
    });

    const response = await POST(
      buildRequest({
        analysis: buildAnalysis(),
        mode: "apply",
        importMasterId: "import-master-1",
        overrides: {
          displayNameOverrides: {
            "hero-1": "Executive Testimonial"
          },
          blockFamilyOverrides: {},
          exitStateOverrides: {},
          itemImportState: {
            "hero-1": true
          },
          itemTypeOverrides: {},
          fieldOverrides: {},
          mapToExisting: {
            "hero-1": "import-source-hero-1-01"
          },
          segmentationOverrides: {},
          actionTypeOverrides: {},
          actionLabelOverrides: {},
          actionTargetOverrides: {}
        }
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      result: {
        applied: boolean;
      };
      matchedBlocks: Array<{
        proposalId: string;
        disposition: "created" | "updated";
        matchedBlockKey: string;
        matchedBlockId: string | null;
        nameChanged: boolean;
        previewChanged: boolean;
        publishedContentChanged: boolean;
      }>;
    };

    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.result.applied).toBe(true);
    expect(payload.matchedBlocks).toEqual([
      {
        proposalId: "hero-1",
        disposition: "updated",
        matchedBlockKey: "import-source-hero-1-01",
        matchedBlockId: "block-doc-1",
        nameChanged: true,
        previewChanged: false,
        publishedContentChanged: false
      }
    ]);
    expect(publishOnboardingDraftMock).toHaveBeenCalledTimes(1);
    expect(publishOnboardingDraftMock.mock.calls[0]?.[0]?.overrides.displayNameOverrides["hero-1"]).toBe("Executive Testimonial");
  });
});
