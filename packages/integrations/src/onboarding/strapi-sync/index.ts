import {
  type ActionBinding,
  parseOnboardingPublishResult,
  type OnboardingBlockProposal,
  type OnboardingPublishResult,
  type PageAssembly,
  type StrapiSyncPayload,
  type ExitBinding,
  type ExitDefinition,
  type WidgetDefinition,
  type WidgetVariant
} from "@lmnas/contracts";
import type { ShellSchemaMapResult } from "../shell-schema-mapper";

export function buildStrapiSyncPayload(params: {
  shell: ShellSchemaMapResult;
  blocks: OnboardingBlockProposal[];
  widgets: {
    definitions: WidgetDefinition[];
    variants: WidgetVariant[];
  };
  actions: ActionBinding[];
  exits: {
    definitions: ExitDefinition[];
    bindings: ExitBinding[];
  };
  pageAssembly: PageAssembly;
}): StrapiSyncPayload {
  return {
    shellVariants: params.shell.shellVariants,
    navbarVariants: params.shell.navbarVariants,
    footerVariants: params.shell.footerVariants,
    menus: params.shell.menus,
    blockInstances: params.blocks,
    widgetDefinitions: params.widgets.definitions,
    widgetVariants: params.widgets.variants,
    actionBindings: params.actions,
    exitDefinitions: params.exits.definitions,
    exitBindings: params.exits.bindings,
    pageAssembly: params.pageAssembly
  };
}

export async function publishStrapiSyncPayload(params: {
  mode: "dry-run" | "apply";
  payload: StrapiSyncPayload;
  warnings: OnboardingPublishResult["warnings"];
  previewLinks: string[];
}): Promise<OnboardingPublishResult> {
  const applyRequested = params.mode === "apply";
  const canApply = Boolean(process.env.STRAPI_URL && process.env.STRAPI_API_TOKEN);

  const applied = applyRequested && canApply;
  const warnings = [...params.warnings];

  if (applyRequested && !canApply) {
    warnings.push({
      code: "strapi.apply_unavailable",
      message: "Publish mode is apply, but STRAPI_URL/STRAPI_API_TOKEN is not configured. Returning dry-run payload.",
      severity: "warning"
    });
  }

  const editableFieldsCreated =
    params.payload.blockInstances.reduce((sum, block) => sum + block.editableFields.length, 0) +
    params.payload.widgetDefinitions.reduce((sum, widget) => sum + widget.editableFields.length, 0);

  return parseOnboardingPublishResult({
    mode: params.mode,
    applied,
    summary: {
      shellsToCreate: params.payload.shellVariants.length,
      blocksToCreate: params.payload.blockInstances.length,
      widgetsToCreate: params.payload.widgetDefinitions.length,
      actionsToCreate: params.payload.actionBindings.length,
      exitsRequired: params.payload.exitDefinitions.length,
      editableFieldsCreated,
      warningsCount: warnings.length
    },
    previewLinks: params.previewLinks,
    warnings,
    strapiPayload: params.payload
  });
}
