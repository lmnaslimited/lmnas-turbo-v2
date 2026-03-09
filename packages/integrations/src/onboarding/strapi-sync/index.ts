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
import { loadProjectEnv, validateRequiredEnv } from "../../env/bootstrap";
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

type ApplyReadiness = OnboardingPublishResult["applyReadiness"];

function resolveApplyReadiness(): ApplyReadiness {
  loadProjectEnv();
  const envValidation = validateRequiredEnv(["STRAPI_URL", "STRAPI_API_TOKEN"]);
  if (envValidation.ok) {
    return {
      canApply: true,
      missingEnvKeys: [],
      operatorMessage: "Ready to publish to Strapi.",
      developerMessage: "Required Strapi env keys are present."
    };
  }

  return {
    canApply: false,
    missingEnvKeys: envValidation.missingKeys,
    operatorMessage: "Publish is not ready yet. Ask a developer to configure Strapi connection settings.",
    developerMessage: `Missing env keys: ${envValidation.missingKeys.join(", ")}`
  };
}

async function checkStrapiConnection(strapiUrl: string, token: string): Promise<{
  ok: boolean;
  warning?: OnboardingPublishResult["warnings"][number];
}> {
  try {
    const baseUrl = strapiUrl.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/api/pages?pagination[pageSize]=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        warning: {
          code: "strapi.invalid_token",
          message: "Strapi credentials were rejected. Check STRAPI_API_TOKEN before publishing.",
          severity: "error"
        }
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        warning: {
          code: "strapi.publish_unavailable",
          message: `Strapi responded with status ${response.status}. Publish was not applied.`,
          severity: "warning"
        }
      };
    }

    return {
      ok: true
    };
  } catch {
    return {
      ok: false,
      warning: {
        code: "strapi.unreachable",
        message: `Unable to reach Strapi at ${strapiUrl}. Publish was not applied.`,
        severity: "error"
      }
    };
  }
}

export async function publishStrapiSyncPayload(params: {
  mode: "dry-run" | "apply";
  payload: StrapiSyncPayload;
  warnings: OnboardingPublishResult["warnings"];
  previewLinks: string[];
  assemblyPreviewHtml?: string;
}): Promise<OnboardingPublishResult> {
  const applyRequested = params.mode === "apply";
  const warnings = [...params.warnings];
  const applyReadiness = resolveApplyReadiness();
  let applied = false;

  if (applyRequested) {
    if (!applyReadiness.canApply) {
      warnings.push({
        code: "strapi.apply_unavailable",
        message: "Publish mode is apply, but required Strapi environment keys are missing.",
        severity: "warning"
      });
    } else {
      const strapiUrl = process.env.STRAPI_URL as string;
      const strapiToken = process.env.STRAPI_API_TOKEN as string;
      const connectivity = await checkStrapiConnection(strapiUrl, strapiToken);

      if (connectivity.ok) {
        applied = true;
      } else if (connectivity.warning) {
        warnings.push(connectivity.warning);
      }
    }
  }

  const editableFieldsCreated =
    params.payload.blockInstances.reduce((sum, block) => sum + block.editableFields.length, 0) +
    params.payload.widgetDefinitions.reduce((sum, widget) => sum + widget.editableFields.length, 0);

  return parseOnboardingPublishResult({
    mode: params.mode,
    applied,
    applyReadiness,
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
    assemblyPreviewHtml: params.assemblyPreviewHtml,
    strapiPayload: params.payload
  });
}
