import {
  parseOnboardingPublishResult,
  type ExitBinding,
  type ExitDefinition,
  type OnboardingBlockProposal,
  type OnboardingPublishResult,
  type PageAssembly,
  type StrapiSyncPayload
} from "@lmnas/contracts";
import type { ShellSchemaMapResult } from "../shell-schema-mapper";

export function buildStrapiSyncPayload(params: {
  shell: ShellSchemaMapResult;
  blocks: OnboardingBlockProposal[];
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
    exitDefinitions: params.exits.definitions,
    exitBindings: params.exits.bindings,
    pageAssembly: params.pageAssembly
  };
}

export async function publishStrapiSyncPayload(params: {
  mode: "dry-run" | "apply";
  payload: StrapiSyncPayload;
  warnings: OnboardingPublishResult["warnings"];
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

  return parseOnboardingPublishResult({
    mode: params.mode,
    applied,
    summary: {
      shellVariants: params.payload.shellVariants.length,
      blockInstances: params.payload.blockInstances.length,
      exitDefinitions: params.payload.exitDefinitions.length,
      exitBindings: params.payload.exitBindings.length
    },
    warnings,
    strapiPayload: params.payload
  });
}
