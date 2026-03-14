import type { OnboardingAnalysis } from "@lmnas/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioStore, resetStore } from "../../_lib/store";

const { analyzeOnboardingSourceMock } = vi.hoisted(() => ({
  analyzeOnboardingSourceMock: vi.fn()
}));

vi.mock("@lmnas/integrations", () => ({
  analyzeOnboardingSource: analyzeOnboardingSourceMock
}));

vi.mock("../../../../../lib/env", () => ({
  loadProjectEnv: () => undefined
}));

vi.mock("../../_lib/strapi", () => ({
  isStrapiConfigured: () => false,
  requestStrapi: vi.fn()
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
      sourceType: "stitch_full_page",
      sourceValue: "stitch source",
      slug: "import-source",
      locale: "en",
      themeKey: "default"
    },
    source: {
      sourceRef: "stitch:artifact",
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
      tokenFirstMatchRatio: 0.91,
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

function createZipBase64(entries: Array<{ fileName: string; content: string }>): string {
  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let localOffset = 0;

  entries.forEach((entry) => {
    const nameBuffer = Buffer.from(entry.fileName, "utf8");
    const dataBuffer = Buffer.from(entry.content, "utf8");
    const compressedSize = dataBuffer.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(compressedSize, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localRecord = Buffer.concat([localHeader, nameBuffer, dataBuffer]);
    localRecords.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(compressedSize, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    const centralRecord = Buffer.concat([centralHeader, nameBuffer]);
    centralRecords.push(centralRecord);
    localOffset += localRecord.length;
  });

  const centralDirectory = Buffer.concat(centralRecords);
  const centralDirectoryOffset = localOffset;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(centralDirectoryOffset, 16);
  eocd.writeUInt16LE(0, 20);

  const zipBuffer = Buffer.concat([...localRecords, centralDirectory, eocd]);
  return zipBuffer.toString("base64");
}

describe("studio import process route", () => {
  beforeEach(() => {
    resetStore();
    analyzeOnboardingSourceMock.mockReset();
    analyzeOnboardingSourceMock.mockResolvedValue(buildAnalysis());
    delete process.env.STUDIO_DEBUG_ALLOW_IMPORT_FALLBACK;
  });

  it("rejects invalid Stitch zip signature", async () => {
    const response = await POST(
      buildPostRequest({
        sourceType: "stitch_full_page",
        sourceValue: "",
        stitchZipUpload: {
          fileName: "broken.zip",
          dataBase64: Buffer.from("not-a-zip", "utf8").toString("base64")
        },
        slug: "import-source",
        locale: "en",
        themeKey: "default"
      })
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { ok: boolean; code: string; error: string };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("import.stitch_zip_signature_invalid");
  });

  it("requires canonical Strapi persistence by default when Strapi is unavailable", async () => {
    const zipBase64 = createZipBase64([
      {
        fileName: "index.html",
        content: "<!doctype html><html><body><section class='hero'><h1>Hero</h1></section></body></html>"
      }
    ]);

    const response = await POST(
      buildPostRequest({
        sourceType: "stitch_full_page",
        sourceValue: "",
        stitchZipUpload: {
          fileName: "stitch-export.zip",
          dataBase64: zipBase64
        },
        slug: "import-source",
        locale: "en",
        themeKey: "default",
        shellKey: "shell-main"
      })
    );

    expect(response.status).toBe(503);
    const payload = (await response.json()) as { ok: boolean; code: string; error: string };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("import.strapi_required");
  });

  it("allows explicit debug fallback persistence only when env flag is enabled", async () => {
    const beforeBlocks = getStudioStore().blocks.length;
    process.env.STUDIO_DEBUG_ALLOW_IMPORT_FALLBACK = "1";
    const zipBase64 = createZipBase64([
      {
        fileName: "index.html",
        content: "<!doctype html><html><body><section class='hero'><h1>Hero</h1></section></body></html>"
      }
    ]);

    const response = await POST(
      buildPostRequest({
        sourceType: "stitch_full_page",
        sourceValue: "",
        stitchZipUpload: {
          fileName: "stitch-export.zip",
          dataBase64: zipBase64
        },
        slug: "import-source",
        locale: "en",
        themeKey: "default",
        shellKey: "shell-main"
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
        proposalBlocks: Array<{ proposalId: string; blockKey: string; schemaStatus: string; targetPreviewHtml: string }>;
        upload?: { fileName: string; htmlEntry: string };
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.persistence.source).toBe("fallback");
    expect(payload.persistence.schemaSource).toBe("fallback");
    expect(payload.persistence.proposalsPersisted).toBe(1);
    expect(payload.persistence.proposalBlocks[0]?.proposalId).toBe("hero-1");
    expect(payload.persistence.proposalBlocks[0]?.schemaStatus).toBe("valid");
    expect(payload.persistence.proposalBlocks[0]?.targetPreviewHtml).toContain("lmnas-preview-tailwind-config");
    expect(payload.persistence.proposalBlocks[0]?.targetPreviewHtml).toContain("/studio-runtime.css");
    expect(payload.persistence.proposalBlocks[0]?.targetPreviewHtml).not.toContain("LMNAs");
    expect(payload.persistence.upload?.fileName).toBe("stitch-export.zip");
    expect(payload.persistence.upload?.htmlEntry).toBe("index.html");
    expect(payload.analysis.blockProposals[0]?.previewHtml?.length ?? 0).toBeGreaterThan(0);

    const afterBlocks = getStudioStore().blocks.length;
    expect(afterBlocks).toBe(beforeBlocks + 1);
  });

  it("updates existing draft canonical blocks on repeat import and persists renamed proposals", async () => {
    process.env.STUDIO_DEBUG_ALLOW_IMPORT_FALLBACK = "1";
    analyzeOnboardingSourceMock
      .mockResolvedValueOnce(
        buildAnalysis()
      )
      .mockResolvedValueOnce({
        ...buildAnalysis(),
        blockProposals: [
          {
            ...buildAnalysis().blockProposals[0],
            displayName: "Renamed Imported Hero"
          }
        ]
      });

    const firstResponse = await POST(
      buildPostRequest({
        sourceType: "raw_html",
        sourceValue: "<section class='hero'><h1>Hero</h1></section>",
        slug: "import-source",
        locale: "en",
        themeKey: "default"
      })
    );
    expect(firstResponse.status).toBe(200);
    const firstPayload = (await firstResponse.json()) as {
      ok: boolean;
      persistence: {
        proposalBlocks: Array<{ blockKey: string; disposition: "created" | "updated"; name: string }>;
      };
    };
    expect(firstPayload.ok).toBe(true);
    expect(firstPayload.persistence.proposalBlocks[0]?.disposition).toBe("created");
    const firstBlockKey = firstPayload.persistence.proposalBlocks[0]?.blockKey;
    expect(firstBlockKey).toBeTruthy();

    const secondResponse = await POST(
      buildPostRequest({
        sourceType: "raw_html",
        sourceValue: "<section class='hero'><h1>Hero</h1></section>",
        slug: "import-source",
        locale: "en",
        themeKey: "default"
      })
    );
    expect(secondResponse.status).toBe(200);
    const secondPayload = (await secondResponse.json()) as {
      ok: boolean;
      persistence: {
        proposalBlocks: Array<{ blockKey: string; disposition: "created" | "updated"; name: string }>;
      };
    };

    expect(secondPayload.ok).toBe(true);
    expect(secondPayload.persistence.proposalBlocks[0]?.blockKey).toBe(firstBlockKey);
    expect(secondPayload.persistence.proposalBlocks[0]?.disposition).toBe("updated");
    expect(secondPayload.persistence.proposalBlocks[0]?.name).toBe("Renamed Imported Hero");

    const persistedBlock = getStudioStore().blocks.find((block) => block.key === firstBlockKey);
    expect(persistedBlock?.name).toBe("Renamed Imported Hero");
    expect(getStudioStore().blocks.filter((block) => block.key === firstBlockKey)).toHaveLength(1);
  });
});
