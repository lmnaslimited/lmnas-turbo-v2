import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  type ActionBinding,
  type OnboardingSourceType,
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
type PublishWarning = OnboardingPublishResult["warnings"][number];

type OnboardingApplyContext = {
  slug: string;
  locale: string;
  themeKey: string;
  sourceType: OnboardingSourceType;
  sourceValue: string;
  fallbackHtml: string;
};

type ApplyWriter = (params: {
  context: OnboardingApplyContext;
  strapiUrl: string;
  strapiToken: string;
}) => Promise<UpsertLikeResult>;

type UpsertLikeResult = {
  mode: "upsert" | "force-create" | "force-update" | "force-replace";
  action: "created" | "updated" | "replaced";
  finalSlug: string;
  documentId?: string;
  status: "draft" | "published" | "unknown";
  existing: {
    found: boolean;
    count: number;
    status?: "draft" | "published" | "unknown";
  };
};

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

function resolveHtmlSource(context: OnboardingApplyContext): string {
  if (context.sourceType === "url") {
    return context.fallbackHtml;
  }

  const candidate = context.sourceValue.trim();
  if (candidate.length > 0) {
    return candidate;
  }

  return context.fallbackHtml;
}

function toApplyFailureWarning(error: unknown): PublishWarning {
  const message = error instanceof Error ? error.message : String(error);
  return {
    code: "strapi.apply_failed",
    message: `Strapi publish apply failed: ${message}`,
    severity: "error"
  };
}

function resolveContentImporterModulePath(): string {
  const cwd = process.cwd();
  const initCwd = process.env.INIT_CWD;
  const candidates = [
    path.join(cwd, "packages/content-importer/dist/index.js"),
    path.join(cwd, "../packages/content-importer/dist/index.js"),
    path.join(cwd, "../../packages/content-importer/dist/index.js"),
    path.join(cwd, "../../../packages/content-importer/dist/index.js"),
    path.join(cwd, "../../../../packages/content-importer/dist/index.js"),
    ...(initCwd ? [path.join(initCwd, "packages/content-importer/dist/index.js")] : [])
  ].map((candidate) => path.resolve(candidate));

  const match = candidates.find((candidate) => existsSync(candidate));
  if (match) {
    return match;
  }

  throw new Error(`Unable to resolve content-importer module from cwd=${cwd}`);
}

function keepSnapshotBlockOnly(plan: unknown): unknown {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    return plan;
  }

  const source = plan as Record<string, unknown>;
  if (!Array.isArray(source.blocks)) {
    return plan;
  }

  const snapshotBlock = source.blocks.find((block) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      return false;
    }

    return (block as Record<string, unknown>).__component === "blocks.imported-dom-snapshot";
  });

  if (!snapshotBlock) {
    return plan;
  }

  return {
    ...source,
    blocks: [snapshotBlock]
  };
}

async function runDefaultApplyWriter(params: {
  context: OnboardingApplyContext;
  strapiUrl: string;
  strapiToken: string;
}): Promise<UpsertLikeResult> {
  const { context, strapiUrl, strapiToken } = params;
  const importerModulePath = resolveContentImporterModulePath();
  const importerModuleUrl = pathToFileURL(importerModulePath).href;
  const contentImporter = (await import(/* webpackIgnore: true */ importerModuleUrl)) as {
    createImportPlan: (options: Record<string, unknown>) => Promise<unknown>;
    applyImportPlan: (plan: unknown, options: Record<string, unknown>) => Promise<UpsertLikeResult>;
  };

  if (context.sourceType === "url") {
    const plan = await contentImporter.createImportPlan({
      slug: context.slug,
      locale: context.locale,
      url: context.sourceValue,
      theme: context.themeKey
    });
    const snapshotPlan = keepSnapshotBlockOnly(plan);

    return contentImporter.applyImportPlan(snapshotPlan, {
      strapiUrl,
      strapiToken,
      publishState: "published",
      forceFidelity: true,
      forceReplace: true
    });
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "lmnas-onboarding-apply-"));
  const htmlPath = path.join(tempDir, `${context.slug}.${context.locale}.html`);
  const html = resolveHtmlSource(context);

  try {
    await writeFile(htmlPath, html, "utf8");
    const plan = await contentImporter.createImportPlan({
      slug: context.slug,
      locale: context.locale,
      html: htmlPath,
      theme: context.themeKey
    });
    const snapshotPlan = keepSnapshotBlockOnly(plan);

    return contentImporter.applyImportPlan(snapshotPlan, {
      strapiUrl,
      strapiToken,
      publishState: "published",
      forceFidelity: true,
      forceReplace: true
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function publishStrapiSyncPayload(params: {
  mode: "dry-run" | "apply";
  payload: StrapiSyncPayload;
  warnings: OnboardingPublishResult["warnings"];
  previewLinks: string[];
  assemblyPreviewHtml?: string;
  applyContext?: OnboardingApplyContext;
  applyWriter?: ApplyWriter;
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
        if (!params.applyContext) {
          warnings.push({
            code: "strapi.apply_context_missing",
            message: "Publish apply is missing source context. Re-run analysis and publish again.",
            severity: "error"
          });
        } else {
          const applyWriter = params.applyWriter ?? runDefaultApplyWriter;

          try {
            await applyWriter({
              context: params.applyContext,
              strapiUrl,
              strapiToken
            });
            applied = true;
          } catch (error) {
            warnings.push(toApplyFailureWarning(error));
          }
        }
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
