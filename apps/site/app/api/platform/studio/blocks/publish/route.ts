import {
  parseOnboardingPublishRequest,
  parseOnboardingPublishResult,
  type OnboardingPublishResult
} from "@lmnas/contracts";
import { publishOnboardingDraft } from "@lmnas/integrations";
import type { StudioActionType } from "../../../../../platform/onboarding/_lib/studio-types";
import { isStudioActionType } from "../../../../../platform/onboarding/_lib/studio-types";
import { createCanonicalBlockSnapshot } from "../../../../../../lib/studio-canonical";
import { loadProjectEnv } from "../../../../../lib/env";
import { getStudioStore, replaceStore } from "../../_lib/store";
import { isStrapiConfigured, requestStrapi, StudioApiError } from "../../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

const CANONICAL_BLOCK_COLLECTION = "/api/studio-blocks";
const CANONICAL_IMPORT_MASTER_COLLECTION = "/api/studio-import-masters";

type PublishedBlockMatch = {
  proposalId: string;
  disposition: "created" | "updated";
  matchedBlockKey: string;
  matchedBlockId: string | null;
  nameChanged: boolean;
  previewChanged: boolean;
  publishedContentChanged: boolean;
};

function unwrapStrapiEntity(value: Record<string, unknown>): Record<string, unknown> {
  if (value.attributes && typeof value.attributes === "object" && !Array.isArray(value.attributes)) {
    return {
      ...(value.attributes as Record<string, unknown>),
      id: value.id,
      documentId: value.documentId
    };
  }
  return value;
}

function extractActionTarget(action: Record<string, unknown>): string {
  const targets = [action.targetUrl, action.targetSectionId, action.widgetId, action.exitId];
  for (const target of targets) {
    if (typeof target === "string" && target.length > 0) {
      return target;
    }
  }
  return "/";
}

function normalizeActionType(value: unknown): StudioActionType {
  if (isStudioActionType(value)) {
    return value;
  }
  return "workflow";
}

function normalizeTemplateKey(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }
  return fallback;
}

function resolveEntityMutationId(value: Record<string, unknown>): string | null {
  if (typeof value.documentId === "string" && value.documentId.length > 0) {
    return value.documentId;
  }
  if (typeof value.id === "string" || typeof value.id === "number") {
    return String(value.id);
  }
  return null;
}

function normalizeHtmlComparison(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim() : "";
}

async function updateImportMasterStatus(importMasterId: string | undefined, status: "imported_blocks" | "imported_page"): Promise<void> {
  if (!importMasterId || importMasterId.trim().length === 0) {
    return;
  }
  await requestStrapi(`${CANONICAL_IMPORT_MASTER_COLLECTION}/${encodeURIComponent(importMasterId)}`, {
    method: "PUT",
    body: {
      status
    }
  });
}

async function upsertBlockInCollection(
  collectionPath: string,
  keyField: "blockKey" | "templateKey",
  template: {
    key: string;
    name: string;
    family: string;
    status: "active" | "inactive" | "draft";
    themeKey: string;
    sourceType: string;
    sourceRef: string;
    confidence: number;
    editableFields: string[];
    actions: Array<{ id: string; label: string; type: StudioActionType; target: string }>;
    previewHtml: string;
    sourcePreviewHtml?: string;
    targetPreviewHtml?: string;
    importMasterId?: string;
    importProposalId?: string;
    inUseCount: number;
  }
): Promise<PublishedBlockMatch> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `${collectionPath}?filters[${encodeURIComponent(keyField)}][$eq]=${encodeURIComponent(template.key)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  const existingEntity = existing ? unwrapStrapiEntity(existing) : undefined;
  const existingId = existing ? resolveEntityMutationId(existing) : null;
  const usageCount = template.inUseCount;
  const snapshot = createCanonicalBlockSnapshot({
    html: template.targetPreviewHtml ?? template.previewHtml,
    sourceUrl: template.sourceRef,
    themeScopeClass: `theme-${template.themeKey}`,
    stylesheetRef: "/studio-runtime.css"
  });
  const payload: Record<string, unknown> =
    keyField === "blockKey"
      ? {
          blockKey: template.key,
          name: template.name,
          blockType: snapshot.blockType,
          family: template.family,
          status: template.status,
          lifecycle: "draft",
          scope: "global",
          schemaStatus: "valid",
          themeKey: template.themeKey,
          sourceType: template.sourceType,
          sourceRef: template.sourceRef,
          domJson: snapshot.domJson,
          classMap: snapshot.classMap,
          stylesheetRef: snapshot.stylesheetRef,
          themeMapping: {
            themeKey: template.themeKey,
            themeScopeClass: `theme-${template.themeKey}`,
            tokenCoverage: 1
          },
          fidelityMetadata: {},
          confidence: template.confidence,
          editableFields: template.editableFields,
          actions: template.actions,
          sourcePreviewHtml: "",
          targetPreviewHtml: "",
          previewHtml: "",
          importMaster:
            template.importMasterId ??
            (existingEntity &&
            existingEntity.importMaster &&
            typeof existingEntity.importMaster === "object" &&
            !Array.isArray(existingEntity.importMaster)
              ? String(
                  (existingEntity.importMaster as Record<string, unknown>).documentId ??
                    (existingEntity.importMaster as Record<string, unknown>).id ??
                    ""
                )
              : undefined),
          importProposalId:
            template.importProposalId ??
            (typeof existingEntity?.importProposalId === "string" ? existingEntity.importProposalId : undefined),
          usageCount
        }
      : {
          templateKey: template.key,
          name: template.name,
          family: template.family,
          status: template.status,
          themeKey: template.themeKey,
          sourceType: template.sourceType,
          sourceRef: template.sourceRef,
          confidence: template.confidence,
          editableFields: template.editableFields,
          actions: template.actions,
          previewHtml: template.previewHtml,
          inUseCount: usageCount
        };
  const nextPreviewHtml =
    template.targetPreviewHtml ??
    template.previewHtml ??
    (typeof existingEntity?.previewHtml === "string" ? existingEntity.previewHtml : "<section></section>");
  const nextPublishedContentHtml = template.targetPreviewHtml ?? template.previewHtml ?? "";
  const matchedBlockKey =
    keyField === "blockKey"
      ? template.key
      : typeof existingEntity?.templateKey === "string"
        ? existingEntity.templateKey
        : template.key;
  const matchResult: PublishedBlockMatch = {
    proposalId: template.importProposalId ?? template.key,
    disposition: existingId !== null ? "updated" : "created",
    matchedBlockKey,
    matchedBlockId: existingId,
    nameChanged: existingId !== null ? String(existingEntity?.name ?? "").trim() !== template.name.trim() : false,
    previewChanged:
      existingId !== null
        ? normalizeHtmlComparison(existingEntity?.previewHtml) !== normalizeHtmlComparison(nextPreviewHtml)
        : true,
    publishedContentChanged:
      existingId !== null
        ? normalizeHtmlComparison(existingEntity?.targetPreviewHtml ?? existingEntity?.previewHtml) !==
          normalizeHtmlComparison(nextPublishedContentHtml)
        : true
  };

  if (existingId !== null) {
    await requestStrapi(`${collectionPath}/${encodeURIComponent(existingId)}`, {
      method: "PUT",
      body: payload
    });
    return matchResult;
  }

  const created = await requestStrapi<{
    data?: Record<string, unknown>;
  }>(collectionPath, {
    method: "POST",
    body: payload
  });
  const createdEntity = created.data ? unwrapStrapiEntity(created.data) : null;
  return {
    ...matchResult,
    matchedBlockId: createdEntity ? resolveEntityMutationId(createdEntity) : matchResult.matchedBlockId
  };
}

async function upsertBlockTemplateInStrapi(template: {
  key: string;
  name: string;
  family: string;
  status: "active" | "inactive" | "draft";
  themeKey: string;
  sourceType: string;
  sourceRef: string;
  confidence: number;
  editableFields: string[];
  actions: Array<{ id: string; label: string; type: StudioActionType; target: string }>;
  previewHtml: string;
  sourcePreviewHtml?: string;
  targetPreviewHtml?: string;
  importMasterId?: string;
  importProposalId?: string;
  inUseCount: number;
}): Promise<PublishedBlockMatch> {
  return upsertBlockInCollection(CANONICAL_BLOCK_COLLECTION, "blockKey", template);
}

function upsertBlockTemplateInFallback(template: {
  key: string;
  name: string;
  family: string;
  themeKey: string;
  sourceType: string;
  sourceRef: string;
  confidence: number;
  editableFields: string[];
  actions: Array<{ id: string; label: string; type: StudioActionType; target: string }>;
  previewHtml: string;
  importProposalId?: string;
}): PublishedBlockMatch {
  const store = getStudioStore();
  const blocks = [...store.blocks];
  const index = blocks.findIndex((entry) => entry.key === template.key || entry.id === template.key);
  const existing = index >= 0 ? blocks[index] : null;
  const now = new Date().toISOString().slice(0, 10);

  const next = {
    id: index >= 0 ? blocks[index].id : template.key,
    key: template.key,
    name: template.name,
    blockType: "imported_dom_snapshot" as const,
    family: template.family,
    status: "active" as const,
    lifecycle: "draft" as const,
    scope: "global" as const,
    schemaStatus: "valid" as const,
    themeKey: template.themeKey,
    sourceType: template.sourceType,
    sourceRef: template.sourceRef,
    ...createCanonicalBlockSnapshot({
      html: template.previewHtml,
      sourceUrl: template.sourceRef,
      themeScopeClass: `theme-${template.themeKey}`,
      stylesheetRef: "/studio-runtime.css"
    }),
    confidence: template.confidence,
    editableFields: template.editableFields,
    actions: template.actions,
    previewHtml: "",
    inUseCount: index >= 0 ? blocks[index].inUseCount : 0,
    usageCount: index >= 0 ? (blocks[index].usageCount ?? blocks[index].inUseCount) : 0,
    createdAt: index >= 0 ? blocks[index].createdAt : now,
    updatedAt: now
  };

  if (index >= 0) {
    blocks[index] = next;
  } else {
    blocks.unshift(next);
  }

  replaceStore({
    ...store,
    blocks
  });
  return {
    proposalId: template.importProposalId ?? template.key,
    disposition: index >= 0 ? "updated" : "created",
    matchedBlockKey: template.key,
    matchedBlockId: existing?.id ?? template.key,
    nameChanged: existing ? existing.name.trim() !== template.name.trim() : false,
    previewChanged: existing ? normalizeHtmlComparison(existing.previewHtml) !== normalizeHtmlComparison(template.previewHtml) : true,
    publishedContentChanged:
      existing ? normalizeHtmlComparison(existing.previewHtml) !== normalizeHtmlComparison(template.previewHtml) : true
  };
}

function withUpdatedPublishResult(base: OnboardingPublishResult, params: { applied: boolean; warnings: OnboardingPublishResult["warnings"] }): OnboardingPublishResult {
  return parseOnboardingPublishResult({
    ...base,
    mode: base.mode === "apply" ? "apply" : base.mode,
    applied: params.applied,
    warnings: params.warnings,
    summary: {
      ...base.summary,
      warningsCount: params.warnings.length
    }
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    loadProjectEnv();
    const rawPayload = (await request.json()) as Record<string, unknown>;
    const importMasterId = typeof rawPayload.importMasterId === "string" ? rawPayload.importMasterId : undefined;
    const parsed = parseOnboardingPublishRequest(rawPayload);

    const dryRunResult = await publishOnboardingDraft({
      ...parsed,
      mode: "dry-run"
    });

    if (parsed.mode !== "apply") {
      return Response.json({
        ok: true,
        result: dryRunResult,
        source: "fallback"
      });
    }

    const warnings = [...dryRunResult.warnings];
    let applied = false;
    const matchedBlocks: PublishedBlockMatch[] = [];
    const selectedBlocksFromPublish = dryRunResult.strapiPayload.blockInstances;
    const blockOverrideEntries = parsed.analysis.blockProposals.map((block) => {
      const mappedKey = normalizeTemplateKey(parsed.overrides.mapToExisting[block.id], block.id);
      return {
        proposalId: block.id,
        mappedKey,
        include: parsed.overrides.itemImportState[block.id] !== false
      };
    });
    const hasBlockOverrides = blockOverrideEntries.some((entry) =>
      Object.prototype.hasOwnProperty.call(parsed.overrides.itemImportState, entry.proposalId)
    );
    const selectedBlockIds = new Set(
      blockOverrideEntries
        .filter((entry) => entry.include)
        .flatMap((entry) => [entry.proposalId, entry.mappedKey].filter((value): value is string => value.length > 0))
    );
    const selectedBlocks = hasBlockOverrides
      ? selectedBlocksFromPublish.filter((block) => selectedBlockIds.has(block.id))
      : selectedBlocksFromPublish;
    const actionBindings = dryRunResult.strapiPayload.actionBindings.map((action) => action as Record<string, unknown>);

    if (selectedBlocks.length === 0) {
      warnings.push({
        code: "blocks.none_selected",
        message: "No blocks were selected for publish. Nothing was written.",
        severity: "warning"
      });
      const result = withUpdatedPublishResult(
        {
          ...dryRunResult,
          mode: "apply"
        },
        { applied: false, warnings }
      );
      return Response.json({
        ok: true,
        result,
        source: "fallback"
      });
    }

    try {
      if (isStrapiConfigured()) {
        for (const block of selectedBlocks) {
          const mappedKey = normalizeTemplateKey(parsed.overrides.mapToExisting[block.id], block.id);
          if (mappedKey !== block.id) {
            warnings.push({
              code: "blocks.map_to_existing",
              message: `${block.displayName ?? block.id} mapped to existing block ${mappedKey}.`,
              severity: "info"
            });
          }

          const blockActions = actionBindings
            .filter((action) => action.locationType === "block" && action.locationId === block.id)
            .map((action) => ({
              id: String(action.id),
              label: String(action.label),
                  type: normalizeActionType(action.actionType),
                  target: extractActionTarget(action)
                }));

          const match = await upsertBlockTemplateInStrapi({
            key: mappedKey,
            name: block.displayName ?? block.id,
            family: block.family,
            status: "active",
            themeKey: parsed.analysis.intake.themeKey,
            sourceType: parsed.analysis.intake.sourceType,
            sourceRef: parsed.analysis.source.sourceRef,
            confidence: block.confidence,
            editableFields: block.editableFields,
            actions: blockActions,
            previewHtml: block.previewHtml ?? block.rawHtmlSnippet ?? "<section></section>",
            sourcePreviewHtml: undefined,
            targetPreviewHtml: undefined,
            importMasterId,
            importProposalId: block.id,
            inUseCount: 0
          });
          matchedBlocks.push(match);
        }
        await updateImportMasterStatus(importMasterId, "imported_blocks");
        applied = true;
      } else {
        for (const block of selectedBlocks) {
          const mappedKey = normalizeTemplateKey(parsed.overrides.mapToExisting[block.id], block.id);
          if (mappedKey !== block.id) {
            warnings.push({
              code: "blocks.map_to_existing",
              message: `${block.displayName ?? block.id} mapped to existing block ${mappedKey}.`,
              severity: "info"
            });
          }

          const blockActions = actionBindings
            .filter((action) => action.locationType === "block" && action.locationId === block.id)
            .map((action) => ({
              id: String(action.id),
              label: String(action.label),
                  type: normalizeActionType(action.actionType),
                  target: extractActionTarget(action)
                }));

          const match = upsertBlockTemplateInFallback({
            key: mappedKey,
            name: block.displayName ?? block.id,
            family: block.family,
            themeKey: parsed.analysis.intake.themeKey,
            sourceType: parsed.analysis.intake.sourceType,
            sourceRef: parsed.analysis.source.sourceRef,
            confidence: block.confidence,
            editableFields: block.editableFields,
            actions: blockActions,
            previewHtml: block.previewHtml ?? block.rawHtmlSnippet ?? "<section></section>",
            importProposalId: block.id
          });
          matchedBlocks.push(match);
        }
        applied = true;
        warnings.push({
          code: "blocks.publish_fallback",
          message: "Strapi is not configured. Blocks were saved in local fallback store for this session.",
          severity: "warning"
        });
      }
    } catch (error) {
      warnings.push({
        code: "blocks.publish_failed",
        message: `Block publish failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: "error"
      });
      applied = false;
    }

    const result = withUpdatedPublishResult(
      {
        ...dryRunResult,
        mode: "apply"
      },
      { applied, warnings }
    );

    return Response.json({
      ok: true,
      result,
      matchedBlocks,
      source: applied && isStrapiConfigured() ? "strapi" : "fallback"
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
