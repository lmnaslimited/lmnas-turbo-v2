import type { StudioImportMaster } from "../../../../../platform/onboarding/_lib/studio-types";
import { isStrapiConfigured, requestStrapi, StudioApiError, unwrapStrapiEntity } from "../../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

const CANONICAL_IMPORT_MASTER_COLLECTION = "/api/studio-import-masters";

function mapImportMaster(value: Record<string, unknown>): StudioImportMaster {
  const row = unwrapStrapiEntity(value);
  const sourceAssetBases = Array.isArray(row.sourceAssetBases)
    ? row.sourceAssetBases.filter((entry): entry is string => typeof entry === "string")
    : [];
  const warnings = Array.isArray(row.warnings) ? row.warnings.filter((entry): entry is string => typeof entry === "string") : [];
  const uploadSummary =
    row.uploadSummary && typeof row.uploadSummary === "object" && !Array.isArray(row.uploadSummary)
      ? (row.uploadSummary as StudioImportMaster["uploadSummary"])
      : undefined;

  return {
    id: String(row.documentId ?? row.id ?? ""),
    importKey: typeof row.importKey === "string" ? row.importKey : "",
    sourceType: typeof row.sourceType === "string" ? row.sourceType : "raw_html",
    sourceRef: typeof row.sourceRef === "string" ? row.sourceRef : "",
    sourceTitle: typeof row.sourceTitle === "string" ? row.sourceTitle : undefined,
    sourceSummary: typeof row.sourceSummary === "string" ? row.sourceSummary : undefined,
    sourceHtml: typeof row.sourceHtml === "string" ? row.sourceHtml : undefined,
    sourceRawMarkupPreview: typeof row.sourceRawMarkupPreview === "string" ? row.sourceRawMarkupPreview : undefined,
    sourceBaseUrl: typeof row.sourceBaseUrl === "string" ? row.sourceBaseUrl : undefined,
    sourceAssetBases,
    sourceAssetManifest:
      row.sourceAssetManifest && typeof row.sourceAssetManifest === "object" && !Array.isArray(row.sourceAssetManifest)
        ? (row.sourceAssetManifest as Record<string, string>)
        : undefined,
    sourceStyleProfile:
      row.sourceStyleProfile && typeof row.sourceStyleProfile === "object" && !Array.isArray(row.sourceStyleProfile)
        ? (row.sourceStyleProfile as Record<string, unknown>)
        : undefined,
    sourceThemeCharacteristics:
      row.sourceThemeCharacteristics && typeof row.sourceThemeCharacteristics === "object" && !Array.isArray(row.sourceThemeCharacteristics)
        ? (row.sourceThemeCharacteristics as Record<string, unknown>)
        : undefined,
    sourceShellCharacteristics: Array.isArray(row.sourceShellCharacteristics)
      ? row.sourceShellCharacteristics.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      : undefined,

    selectedThemeKey: typeof row.selectedThemeKey === "string" ? row.selectedThemeKey : "default",
    selectedShellKey: typeof row.selectedShellKey === "string" ? row.selectedShellKey : "",
    importMode: row.importMode === "page" ? "page" : "blocks",
    status:
      row.status === "imported_blocks" || row.status === "imported_page" || row.status === "failed"
        ? row.status
        : "processed",
    lifecycle: row.lifecycle === "active" || row.lifecycle === "archived" ? row.lifecycle : "draft",
    extractionSummary:
      row.extractionSummary && typeof row.extractionSummary === "object" && !Array.isArray(row.extractionSummary)
        ? (row.extractionSummary as Record<string, unknown>)
        : undefined,
    proposalSummary:
      row.proposalSummary && typeof row.proposalSummary === "object" && !Array.isArray(row.proposalSummary)
        ? (row.proposalSummary as Record<string, unknown>)
        : undefined,
    warnings,
    uploadSummary,
    processedAt: typeof row.processedAt === "string" ? row.processedAt : undefined,
    createdAt: typeof row.createdAt === "string" ? row.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
  };
}

export async function GET(request: Request): Promise<Response> {
  if (!isStrapiConfigured()) {
    return Response.json(
      {
        ok: false,
        error: "Canonical studio-import-master access requires Strapi configuration."
      },
      { status: 503 }
    );
  }

  try {
    const requestUrl = new URL(request.url);
    const importKey = requestUrl.searchParams.get("importKey")?.trim();
    const filter = importKey
      ? `&filters[importKey][$eq]=${encodeURIComponent(importKey)}`
      : "";

    const response = await requestStrapi<StrapiCollectionResponse>(
      `${CANONICAL_IMPORT_MASTER_COLLECTION}?pagination[pageSize]=100&sort=createdAt:desc${filter}`
    );
    const rows = Array.isArray(response.data) ? response.data : [];
    return Response.json({
      ok: true,
      data: rows.map((row) => mapImportMaster(row)),
      source: "strapi",
      schemaSource: "canonical"
    });
  } catch (error) {
    if (error instanceof StudioApiError) {
      return Response.json(
        {
          ok: false,
          error: error.operatorMessage,
          developerError: error.developerMessage
        },
        { status: error.status }
      );
    }

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 400 }
    );
  }
}
