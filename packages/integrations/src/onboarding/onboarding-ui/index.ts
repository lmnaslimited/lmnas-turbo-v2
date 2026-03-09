import {
  parseOnboardingAnalysis,
  parseOnboardingPublishRequest,
  type ExitBinding,
  type ExitDefinition,
  type OnboardingActionProposal,
  type OnboardingAnalysis,
  type OnboardingBlockProposal,
  type OnboardingPublishResult,
  type OnboardingWidgetProposal,
  type WidgetDefinition
} from "@lmnas/contracts";
import { detectActionProposals } from "../action-detector";
import { mapActionsToSchema } from "../action-schema-mapper";
import { detectBlockProposals } from "../block-detector";
import { mapBlocksToSchema } from "../block-schema-mapper";
import { createExitContractsFromProposals } from "../exit-contract-registry";
import { detectExitProposals } from "../exit-detector";
import { detectEditableFields } from "../field-detector";
import { buildFidelityWarnings } from "../fidelity-reporter";
import { assemblePage } from "../page-assembler";
import { buildFinalAssemblyPreviewDocument } from "../preview-renderer";
import { renderAssemblyPreviewModel } from "../renderer";
import { mapShellCandidatesToSchema } from "../shell-schema-mapper";
import { detectShellCandidates } from "../shell-detector";
import { ingestSource } from "../source-ingestion";
import { buildStrapiSyncPayload, publishStrapiSyncPayload } from "../strapi-sync";
import { analyzeTheme } from "../theme-engine";
import { detectWidgetProposals } from "../widget-detector";
import { mapWidgetsToSchema } from "../widget-schema-mapper";

function enrichBlocksWithActions(blocks: OnboardingBlockProposal[], actions: OnboardingActionProposal[]): OnboardingBlockProposal[] {
  return blocks.map((block) => {
    const linkedActions = actions.filter(
      (action) => action.sourceSurface === "block" && (action.sourceItemId === block.id || block.ctaLabels.includes(action.label))
    );

    return {
      ...block,
      actionIds: linkedActions.map((action) => action.id),
      ctaLabels: Array.from(new Set([...block.ctaLabels, ...linkedActions.map((action) => action.label)]))
    };
  });
}

function enrichWidgetsWithActions(widgets: OnboardingWidgetProposal[], actions: OnboardingActionProposal[]): OnboardingWidgetProposal[] {
  return widgets.map((widget) => {
    const linkedActions = actions.filter((action) => action.destination.kind === "widget" && action.destination.value === widget.id);

    return {
      ...widget,
      associatedActionIds: linkedActions.map((action) => action.id),
      triggerLabels: Array.from(new Set([...widget.triggerLabels, ...linkedActions.map((action) => action.label)]))
    };
  });
}

function isImported(importMap: Record<string, boolean>, id: string): boolean {
  return importMap[id] !== false;
}

function applyDisplayNameOverrides<T extends { id: string; displayName?: string }>(
  items: T[],
  overrides: Record<string, string>
): T[] {
  return items.map((item) => ({
    ...item,
    displayName: overrides[item.id] ?? item.displayName
  }));
}

function applyTypeReclassification(params: {
  blocks: OnboardingBlockProposal[];
  widgets: OnboardingWidgetProposal[];
  itemTypeOverrides: Record<string, string>;
}): { blocks: OnboardingBlockProposal[]; widgets: OnboardingWidgetProposal[] } {
  const blocks = [...params.blocks];
  const widgets = [...params.widgets];

  params.blocks.forEach((block) => {
    if (params.itemTypeOverrides[block.id] !== "widget") {
      return;
    }

    const index = blocks.findIndex((candidate) => candidate.id === block.id);
    if (index >= 0) {
      blocks.splice(index, 1);
    }

    widgets.push({
      id: `${block.id}_widget`,
      name: `${block.family.replaceAll("_", " ")} widget`,
      displayName: `${block.family.replaceAll("_", " ")} widget`,
      widgetType: "embedded_form",
      selectorHint: block.selectorHint,
      previewSelector: block.previewSelector,
      confidence: block.confidence,
      editableFields: block.editableFields,
      triggerLabels: block.ctaLabels,
      associatedActionIds: block.actionIds,
      sourceSnippet: block.sourceSnippet ?? block.rawHtmlSnippet,
      previewHtml: block.previewHtml
    });
  });

  params.widgets.forEach((widget) => {
    if (params.itemTypeOverrides[widget.id] !== "block") {
      return;
    }

    const index = widgets.findIndex((candidate) => candidate.id === widget.id);
    if (index >= 0) {
      widgets.splice(index, 1);
    }

    blocks.push({
      id: `${widget.id}_block`,
      displayName: widget.displayName ?? widget.name,
      family: "rich_text_section",
      selectorHint: widget.selectorHint,
      previewSelector: widget.previewSelector,
      confidence: widget.confidence,
      editableFields: widget.editableFields,
      ctaLabels: widget.triggerLabels,
      actionIds: widget.associatedActionIds,
      segmentation: "keep",
      rawHtmlSnippet: widget.previewHtml,
      sourceSnippet: widget.sourceSnippet,
      previewHtml: widget.previewHtml
    });
  });

  return {
    blocks,
    widgets
  };
}

function ensureExitDefinitions(params: {
  definitions: ExitDefinition[];
  bindings: ExitBinding[];
  actionBindings: ReturnType<typeof mapActionsToSchema>;
  slug: string;
}): { definitions: ExitDefinition[]; bindings: ExitBinding[] } {
  const definitions = new Map(params.definitions.map((definition) => [definition.id, definition]));
  const bindings = new Map(params.bindings.map((binding) => [binding.id, binding]));

  params.actionBindings.forEach((action) => {
    if (!action.exitId) {
      return;
    }

    if (!definitions.has(action.exitId)) {
      definitions.set(action.exitId, {
        id: action.exitId,
        name: action.label,
        state: "active",
        eventName: `exit_${action.exitId}_triggered`,
        payloadSchema: {
          format: "json-schema",
          schema: {
            type: "object",
            additionalProperties: true
          }
        },
        frontendAdapterType: "none",
        backendAdapterType: "n8n_webhook",
        workflowTarget: {
          kind: "n8n_webhook",
          value: `n8n://workflow/${action.exitId}`
        },
        fallbackBehavior: "show_contact_fallback",
        successBehavior: "show_success_message",
        failureBehavior: "show_failure_message",
        analyticsMapping: {
          click: `exit_${action.exitId}_triggered`
        },
        policy: {
          environmentAllowlist: [],
          roleAllowlist: []
        }
      });
    }

    const bindingId = `binding-${params.slug}-${action.id}`;
    if (!bindings.has(bindingId)) {
      bindings.set(bindingId, {
        id: bindingId,
        exitId: action.exitId,
        locationType: action.locationType,
        locationId: action.locationId,
        label: action.label
      });
    }
  });

  return {
    definitions: Array.from(definitions.values()),
    bindings: Array.from(bindings.values())
  };
}

function appendActionMappingWarnings(params: {
  warnings: OnboardingPublishResult["warnings"];
  actionBindings: ReturnType<typeof mapActionsToSchema>;
  widgetDefinitions: WidgetDefinition[];
  proposedExitIds: Set<string>;
  resolvedExitDefinitions: ExitDefinition[];
}): void {
  const widgetIds = new Set(params.widgetDefinitions.map((widget) => widget.id));
  const widgetRequiredActions = params.actionBindings.filter((binding) =>
    ["open_modal", "open_drawer", "open_widget"].includes(binding.actionType)
  );
  const missingWidgetCount = widgetRequiredActions.filter((binding) => !binding.widgetId || !widgetIds.has(binding.widgetId))
    .length;

  if (missingWidgetCount > 0) {
    params.warnings.push({
      code: "actions.widget_mapping_gap",
      message: `${missingWidgetCount} action(s) reference a widget that is not part of this import selection. Review widget mappings.`,
      severity: "warning"
    });
  }

  const autoProvisionedExitCount = params.resolvedExitDefinitions.filter(
    (definition) => !params.proposedExitIds.has(definition.id)
  ).length;
  if (autoProvisionedExitCount > 0) {
    params.warnings.push({
      code: "actions.exit_mapping_gap",
      message: `${autoProvisionedExitCount} action(s) required auto-generated exit contracts. Review workflow mapping before publish.`,
      severity: "warning"
    });
  }
}

export async function analyzeOnboardingSource(input: unknown): Promise<OnboardingAnalysis> {
  const ingested = await ingestSource(input);
  const shellCandidates = detectShellCandidates(ingested.html);
  const baseBlocks = detectEditableFields(detectBlockProposals(ingested.html));
  const baseWidgets = detectWidgetProposals(ingested.html);

  const actionProposals = detectActionProposals({
    html: ingested.html,
    blocks: baseBlocks,
    shells: shellCandidates,
    widgets: baseWidgets
  });

  const blockProposals = enrichBlocksWithActions(baseBlocks, actionProposals);
  const widgetProposals = enrichWidgetsWithActions(baseWidgets, actionProposals);
  const exitProposals = detectExitProposals(actionProposals, widgetProposals);
  const theme = analyzeTheme(ingested.html, ingested.intake.themeKey);

  const fidelityWarnings = buildFidelityWarnings({
    shellCandidates,
    blockProposals,
    widgetProposals,
    actionProposals,
    theme
  });

  const preview = renderAssemblyPreviewModel(ingested.html, blockProposals);
  fidelityWarnings.push({
    code: "preview.structural_match",
    message: `Source sections=${preview.sourceSectionCount}, mapped blocks=${preview.mappedBlockCount}, structural match=${(
      preview.structuralMatchRatio * 100
    ).toFixed(1)}%`,
    severity: preview.structuralMatchRatio < 0.7 ? "warning" : "info"
  });

  if (ingested.styleProfile.fidelityNotes.length > 0) {
    ingested.styleProfile.fidelityNotes.forEach((note, index) => {
      fidelityWarnings.push({
        code: `preview.fidelity_note_${index + 1}`,
        message: note,
        severity: "warning"
      });
    });
  }

  return parseOnboardingAnalysis({
    intake: ingested.intake,
    source: {
      sourceRef: ingested.sourceRef,
      title: ingested.title,
      referencePreviewHtml: ingested.referencePreviewHtml,
      productionPreviewHtml: ingested.productionPreviewHtml,
      rawMarkupPreview: ingested.rawMarkupPreview,
      baseUrl: ingested.baseUrl,
      themeScopeClass: ingested.themeScopeClass,
      styleProfile: ingested.styleProfile
    },
    shellCandidates,
    blockProposals,
    widgetProposals,
    actionProposals,
    exitProposals,
    theme,
    fidelityWarnings
  });
}

export async function publishOnboardingDraft(input: unknown): Promise<OnboardingPublishResult> {
  const request = parseOnboardingPublishRequest(input);

  const shellCandidates = request.analysis.shellCandidates.filter((candidate) =>
    isImported(request.overrides.itemImportState, candidate.id)
  );
  const blockCandidates = request.analysis.blockProposals.filter((candidate) =>
    isImported(request.overrides.itemImportState, candidate.id)
  );
  const widgetCandidates = request.analysis.widgetProposals.filter((candidate) =>
    isImported(request.overrides.itemImportState, candidate.id)
  );
  const actionCandidates = request.analysis.actionProposals.filter((candidate) =>
    isImported(request.overrides.itemImportState, candidate.id)
  );
  const exitCandidates = request.analysis.exitProposals.filter((candidate) =>
    isImported(request.overrides.itemImportState, candidate.id)
  );

  const publishWarnings = [...request.analysis.fidelityWarnings];
  const reclassified = applyTypeReclassification({
    blocks: blockCandidates,
    widgets: widgetCandidates,
    itemTypeOverrides: request.overrides.itemTypeOverrides
  });

  const fallbackBlocks = reclassified.blocks.length > 0 ? reclassified.blocks : request.analysis.blockProposals.slice(0, 1);
  if (reclassified.blocks.length === 0) {
    publishWarnings.push({
      code: "blocks.none_selected",
      message: "No blocks were selected, so the first detected block was kept as fallback for page assembly.",
      severity: "warning"
    });
  }

  const displayNameOverrides = request.overrides.displayNameOverrides ?? {};
  const namedShellCandidates = applyDisplayNameOverrides(shellCandidates, displayNameOverrides);
  const namedBlocks = applyDisplayNameOverrides(fallbackBlocks, displayNameOverrides);
  const namedWidgets = applyDisplayNameOverrides(reclassified.widgets, displayNameOverrides);
  const namedActions = applyDisplayNameOverrides(actionCandidates, displayNameOverrides);

  const shell = mapShellCandidatesToSchema({
    slug: request.analysis.intake.slug,
    shellCandidates: namedShellCandidates,
    overrides: request.overrides
  });

  const blocks = mapBlocksToSchema(namedBlocks, request.overrides);
  const widgets = mapWidgetsToSchema(namedWidgets, request.overrides);
  const actions = mapActionsToSchema(namedActions, request.overrides);

  const exitContracts = createExitContractsFromProposals({
    proposals: exitCandidates,
    overrides: request.overrides
  });
  const proposedExitIds = new Set(exitContracts.definitions.map((definition) => definition.id));

  const exits = ensureExitDefinitions({
    definitions: exitContracts.definitions,
    bindings: exitContracts.bindings,
    actionBindings: actions,
    slug: request.analysis.intake.slug
  });
  appendActionMappingWarnings({
    warnings: publishWarnings,
    actionBindings: actions,
    widgetDefinitions: widgets.definitions,
    proposedExitIds,
    resolvedExitDefinitions: exits.definitions
  });

  const pageAssembly = assemblePage({
    slug: request.analysis.intake.slug,
    locale: request.analysis.intake.locale,
    shellAssignment: shell.shellAssignment,
    blocks,
    widgetIds: widgets.definitions.map((widget) => widget.id),
    actionBindingIds: actions.map((action) => action.id)
  });

  const payload = buildStrapiSyncPayload({
    shell,
    blocks,
    widgets,
    actions,
    exits,
    pageAssembly
  });

  const assemblyPreviewHtml = buildFinalAssemblyPreviewDocument({
    sourcePreviewHtml: request.analysis.source.productionPreviewHtml,
    baseUrl: request.analysis.source.baseUrl,
    themeScopeClass: request.analysis.source.themeScopeClass,
    shellCandidates: namedShellCandidates,
    blockProposals: namedBlocks,
    widgetProposals: namedWidgets,
    actionProposals: namedActions
  });

  const localizedPreviewPath =
    request.analysis.intake.slug === "home"
      ? `/${request.analysis.intake.locale}`
      : `/${request.analysis.intake.locale}/${request.analysis.intake.slug}`;

  return publishStrapiSyncPayload({
    mode: request.mode,
    payload,
    warnings: publishWarnings,
    previewLinks: [
      localizedPreviewPath,
      `/${request.analysis.intake.slug}`,
      `/platform/onboarding?slug=${request.analysis.intake.slug}`
    ],
    assemblyPreviewHtml,
    applyContext: {
      slug: request.analysis.intake.slug,
      locale: request.analysis.intake.locale,
      themeKey: request.analysis.intake.themeKey,
      sourceType: request.analysis.intake.sourceType,
      sourceValue: request.analysis.intake.sourceValue,
      fallbackHtml: request.analysis.source.referencePreviewHtml
    }
  });
}
