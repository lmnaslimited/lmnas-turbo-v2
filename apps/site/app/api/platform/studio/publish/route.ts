import type { StudioFidelityMode, StudioTheme } from "../../../../platform/onboarding/_lib/studio-types";
import { evaluateStudioFidelity, type StudioFigmaValidationToken } from "../_lib/fidelity";
import { getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured, requestStrapi, unwrapStrapiEntity } from "../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type PublishRequestPayload = {
  mode?: unknown;
  sourceHtml?: unknown;
  previewSwatchThemeId?: unknown;
  validationToken?: unknown;
};

type PublishWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

function toIsoDate(input?: unknown): string {
  if (typeof input !== "string" || input.length < 10) {
    return new Date().toISOString().slice(0, 10);
  }
  return input.slice(0, 10);
}

function normalizeTokenCoverage(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function normalizeTheme(value: unknown): StudioTheme {
  const row = (value ?? {}) as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.length > 0 ? row.id : `theme-${Date.now()}`;
  return {
    id,
    themeKey: typeof row.themeKey === "string" && row.themeKey.length > 0 ? row.themeKey : id,
    name: typeof row.name === "string" && row.name.length > 0 ? row.name : "Theme",
    status: row.status === "active" || row.status === "draft" ? row.status : "inactive",
    sourceRef: typeof row.sourceRef === "string" ? row.sourceRef : "unknown",
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    tokenCoverage: normalizeTokenCoverage(row.tokenCoverage),
    themeDebt: typeof row.themeDebt === "string" ? row.themeDebt : "",
    darkMode: Boolean(row.darkMode),
    tokens: Array.isArray(row.tokens) ? (row.tokens as StudioTheme["tokens"]) : []
  };
}

async function listThemesFromStrapi(): Promise<StudioTheme[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(
    "/api/theme-variants?pagination[pageSize]=200&sort=updatedAt:desc"
  );
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => normalizeTheme(unwrapStrapiEntity(row)));
}

async function resolveThemeVariantMutationId(themeKey: string): Promise<string | null> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `/api/theme-variants?filters[themeKey][$eq]=${encodeURIComponent(themeKey)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  if (!existing) {
    return null;
  }
  if (typeof existing.documentId === "string" && existing.documentId.length > 0) {
    return existing.documentId;
  }
  if (typeof existing.id === "number" || typeof existing.id === "string") {
    return String(existing.id);
  }
  return null;
}

async function resolveActiveTheme(): Promise<{ theme: StudioTheme | null; source: "strapi" | "fallback" }> {
  if (isStrapiConfigured()) {
    try {
      const themes = await listThemesFromStrapi();
      const activeTheme = themes.find((theme) => theme.status === "active") ?? themes[0] ?? null;
      if (activeTheme) {
        return {
          theme: activeTheme,
          source: "strapi"
        };
      }
    } catch {
      // fallback below
    }
  }

  const fallbackThemes = getStudioStore().themes;
  return {
    theme: fallbackThemes.find((theme) => theme.status === "active") ?? fallbackThemes[0] ?? null,
    source: "fallback"
  };
}

function normalizeMode(value: unknown): "dry-run" | "apply" {
  return value === "dry-run" ? "dry-run" : "apply";
}

function normalizeValidationToken(value: unknown): Partial<StudioFigmaValidationToken> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const expectedTypography = Array.isArray(row.expectedTypography)
    ? row.expectedTypography.filter((entry): entry is string => typeof entry === "string")
    : undefined;
  const requiresDarkMode = typeof row.requiresDarkMode === "boolean" ? row.requiresDarkMode : undefined;
  return {
    ...(expectedTypography ? { expectedTypography } : {}),
    ...(requiresDarkMode !== undefined ? { requiresDarkMode } : {})
  };
}

function buildWarnings(params: {
  report: ReturnType<typeof evaluateStudioFidelity>;
  fidelityMode: StudioFidelityMode;
  blocked: boolean;
}): PublishWarning[] {
  const warnings: PublishWarning[] = [];
  if (params.report.hasDarkMediaQuery) {
    warnings.push({
      code: "publish.fidelity_dark_media_detected",
      message: "Source includes @media(dark) or prefers-color-scheme dark rules.",
      severity: "info"
    });
  }

  if (params.report.darkModeMismatchRatio > params.report.threshold) {
    warnings.push({
      code: "publish.fidelity_dark_mode_mismatch",
      message: `Dark-mode mismatch ${params.report.darkModeMismatchRatio.toFixed(3)} exceeds threshold ${params.report.threshold.toFixed(3)}.`,
      severity: "warning"
    });
  }

  if (params.report.typographyMismatchRatio > params.report.threshold) {
    warnings.push({
      code: "publish.fidelity_typography_mismatch",
      message: `Typography mismatch ${params.report.typographyMismatchRatio.toFixed(3)} exceeds threshold ${params.report.threshold.toFixed(3)}.`,
      severity: "warning"
    });
  }

  if (params.blocked) {
    warnings.push({
      code: "publish.fidelity_hard_block",
      message: `Publish blocked because fidelity mode is "${params.fidelityMode}" and mismatch exceeded threshold.`,
      severity: "error"
    });
  }

  return warnings;
}

function summarizeTheme(theme: StudioTheme): {
  id: string;
  themeKey: string;
  name: string;
  darkMode: boolean;
  status: StudioTheme["status"];
} {
  return {
    id: theme.id,
    themeKey: theme.themeKey,
    name: theme.name,
    darkMode: theme.darkMode,
    status: theme.status
  };
}

function markFallbackCommitApplied(activeThemeId: string): void {
  const store = getStudioStore();
  const themes = store.themes.map((theme) =>
    theme.id === activeThemeId
      ? {
          ...theme,
          updatedAt: new Date().toISOString().slice(0, 10)
        }
      : theme
  );
  replaceStore({
    ...store,
    themes
  });
}

async function persistPublishToStrapi(activeTheme: StudioTheme): Promise<{ themeId: string }> {
  const mutationId = await resolveThemeVariantMutationId(activeTheme.themeKey);
  if (!mutationId) {
    throw new Error(`Unable to resolve Strapi mutation id for themeKey="${activeTheme.themeKey}".`);
  }

  await requestStrapi(`/api/theme-variants/${encodeURIComponent(mutationId)}`, {
    method: "PUT",
    body: {
      themeKey: activeTheme.themeKey,
      name: activeTheme.name,
      status: activeTheme.status,
      sourceRef: activeTheme.sourceRef,
      tokenCoverage: activeTheme.tokenCoverage,
      themeDebt: activeTheme.themeDebt,
      darkMode: activeTheme.darkMode,
      tokens: activeTheme.tokens
    }
  });
  return {
    themeId: mutationId
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as PublishRequestPayload;
    const mode = normalizeMode(payload.mode);
    const sourceHtml = typeof payload.sourceHtml === "string" ? payload.sourceHtml : "";
    const previewSwatchThemeId =
      typeof payload.previewSwatchThemeId === "string" && payload.previewSwatchThemeId.trim().length > 0
        ? payload.previewSwatchThemeId.trim()
        : null;
    const { theme: activeTheme, source } = await resolveActiveTheme();
    if (!activeTheme) {
      return Response.json(
        {
          ok: false,
          error: "No active theme is available for publish review."
        },
        { status: 409 }
      );
    }

    const settings = getStudioStore().settings;
    const fidelityReport = evaluateStudioFidelity({
      sourceHtml,
      activeTheme,
      threshold: settings.fidelity.threshold,
      validationToken: normalizeValidationToken(payload.validationToken)
    });
    const blocked = mode === "apply" && settings.fidelity.mode === "disallow-below-threshold" && fidelityReport.exceedsThreshold;
    let applied = mode === "apply" && !blocked;
    const warnings = buildWarnings({
      report: fidelityReport,
      fidelityMode: settings.fidelity.mode,
      blocked
    });
    const persistence = {
      source,
      mutated: false,
      themeId: null as string | null
    };

    if (applied) {
      if (source === "fallback") {
        markFallbackCommitApplied(activeTheme.id);
        persistence.mutated = true;
        persistence.themeId = activeTheme.id;
      } else {
        try {
          const persisted = await persistPublishToStrapi(activeTheme);
          persistence.mutated = true;
          persistence.themeId = persisted.themeId;
        } catch (error) {
          warnings.push({
            code: "publish.strapi_persist_failed",
            message: `Publish persistence failed in Strapi: ${error instanceof Error ? error.message : String(error)}`,
            severity: "error"
          });
          applied = false;
        }
      }
    }

    const publishPayload = {
      generatedAt: new Date().toISOString(),
      mode,
      activeTheme: summarizeTheme(activeTheme),
      sourceHtml,
      fidelity: {
        mode: settings.fidelity.mode,
        threshold: fidelityReport.threshold,
        report: {
          hasDarkMediaQuery: fidelityReport.hasDarkMediaQuery,
          darkModeMismatchRatio: fidelityReport.darkModeMismatchRatio,
          typographyMismatchRatio: fidelityReport.typographyMismatchRatio,
          highestMismatchRatio: fidelityReport.highestMismatchRatio,
          exceedsThreshold: fidelityReport.exceedsThreshold
        }
      }
    };

    return Response.json({
      ok: true,
      data: {
        mode,
        applied,
        blocked,
        source,
        fidelityMode: settings.fidelity.mode,
        warnings,
        activeTheme: summarizeTheme(activeTheme),
        ignoredPreviewSwatchThemeId: previewSwatchThemeId,
        rejectionReason: blocked ? "Fidelity threshold rejection in disallow mode." : null,
        fidelity: fidelityReport,
        payload: publishPayload,
        persistence
      }
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 400 }
    );
  }
}
