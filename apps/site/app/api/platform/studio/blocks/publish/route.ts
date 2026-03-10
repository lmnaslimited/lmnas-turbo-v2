import {
  parseOnboardingPublishRequest,
  parseOnboardingPublishResult,
  type OnboardingPublishResult
} from "@lmnas/contracts";
import { publishOnboardingDraft } from "@lmnas/integrations";
import type { StudioActionType } from "../../../../../platform/onboarding/_lib/studio-types";
import { isStudioActionType } from "../../../../../platform/onboarding/_lib/studio-types";
import { loadProjectEnv } from "../../../../../lib/env";
import { getStudioStore, replaceStore } from "../../_lib/store";
import { isStrapiConfigured, requestStrapi, StudioApiError } from "../../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

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
  inUseCount: number;
}): Promise<void> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `/api/block-templates?filters[templateKey][$eq]=${encodeURIComponent(template.key)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  const existingId =
    existing && typeof existing.documentId === "string"
      ? existing.documentId
      : existing && (typeof existing.id === "number" || typeof existing.id === "string")
        ? String(existing.id)
        : undefined;
  const payload = {
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
    inUseCount: template.inUseCount
  };

  if (existingId !== undefined) {
    await requestStrapi(`/api/block-templates/${encodeURIComponent(existingId)}`, {
      method: "PUT",
      body: payload
    });
    return;
  }

  await requestStrapi("/api/block-templates", {
    method: "POST",
    body: payload
  });
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
}): void {
  const store = getStudioStore();
  const blocks = [...store.blocks];
  const index = blocks.findIndex((entry) => entry.key === template.key || entry.id === template.key);
  const now = new Date().toISOString().slice(0, 10);

  const next = {
    id: index >= 0 ? blocks[index].id : template.key,
    key: template.key,
    name: template.name,
    family: template.family,
    status: "active" as const,
    themeKey: template.themeKey,
    sourceType: template.sourceType,
    sourceRef: template.sourceRef,
    confidence: template.confidence,
    editableFields: template.editableFields,
    actions: template.actions,
    previewHtml: template.previewHtml,
    inUseCount: index >= 0 ? blocks[index].inUseCount : 0,
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
    const rawPayload = (await request.json()) as unknown;
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
    const selectedBlocksFromPublish = dryRunResult.strapiPayload.blockInstances;
    const blockOverrideEntries = parsed.analysis.blockProposals.map((block) => [
      block.id,
      parsed.overrides.itemImportState[block.id] !== false
    ] as const);
    const hasBlockOverrides = blockOverrideEntries.some(([id]) =>
      Object.prototype.hasOwnProperty.call(parsed.overrides.itemImportState, id)
    );
    const selectedBlockIds = new Set(blockOverrideEntries.filter(([, include]) => include).map(([id]) => id));
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

          await upsertBlockTemplateInStrapi({
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
            inUseCount: 0
          });
        }
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

          upsertBlockTemplateInFallback({
            key: mappedKey,
            name: block.displayName ?? block.id,
            family: block.family,
            themeKey: parsed.analysis.intake.themeKey,
            sourceType: parsed.analysis.intake.sourceType,
            sourceRef: parsed.analysis.source.sourceRef,
            confidence: block.confidence,
            editableFields: block.editableFields,
            actions: blockActions,
            previewHtml: block.previewHtml ?? block.rawHtmlSnippet ?? "<section></section>"
          });
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
