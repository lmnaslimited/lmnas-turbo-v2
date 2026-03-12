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
  pageId?: unknown;
  pageSlug?: unknown;
};

type PublishWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

type GovernanceCheck = {
  id:
    | "preview-valid"
    | "block-schema-valid"
    | "product-mapped"
    | "industry-mapped"
    | "primary-cta-set"
    | "conversion-present"
    | "campaign-present"
    | "taxonomy-valid"
    | "seo-metadata-valid"
    | "seo-jsonld-valid";
  label: string;
  pass: boolean;
};

type GovernancePage = {
  id: string;
  name: string;
  slug: string;
  previewValid: boolean;
  blockSchemaValid: boolean;
  productMapping: string;
  industryMapping: string[];
  primaryCta: { text: string; url: string };
  conversionConfig: { strategy: string };
  campaignUtmStrategy: { source: string; medium: string; campaign: string };
  taxonomyState: { valid: boolean };
  seoMetadata: { metaTitle: string; metaDescription: string };
  seoJsonLdValid: boolean;
};

type GovernanceReport = {
  ready: boolean;
  page: { id: string; name: string; slug: string } | null;
  checks: GovernanceCheck[];
  source: "strapi" | "fallback";
};

type ThemeSchemaSource = "canonical" | "legacy";

const CANONICAL_THEME_COLLECTION = "/api/studio-themes";
const LEGACY_THEME_COLLECTION = "/api/theme-variants";

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

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
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

function normalizeGovernancePage(value: unknown): GovernancePage {
  const row = asObject(value);
  const idRaw = row.documentId ?? row.id;
  const id = typeof idRaw === "string" || typeof idRaw === "number" ? String(idRaw) : `page-${Date.now()}`;
  const primaryCta = asObject(row.primaryCta);
  const conversionConfig = asObject(row.conversionConfig);
  const campaignUtmStrategy = asObject(row.campaignUtmStrategy);
  const taxonomyState = asObject(row.taxonomyState);
  const seoMetadata = asObject(row.seoMetadata);

  return {
    id,
    name: asString(row.name) || asString(row.slug) || "Untitled Page",
    slug: asString(row.slug) || "untitled-page",
    previewValid: Boolean(row.previewValid),
    blockSchemaValid: Boolean(row.blockSchemaValid),
    productMapping: asString(row.productMapping),
    industryMapping: asStringArray(row.industryMapping),
    primaryCta: {
      text: asString(primaryCta.text),
      url: asString(primaryCta.url)
    },
    conversionConfig: {
      strategy: asString(conversionConfig.strategy)
    },
    campaignUtmStrategy: {
      source: asString(campaignUtmStrategy.source),
      medium: asString(campaignUtmStrategy.medium),
      campaign: asString(campaignUtmStrategy.campaign)
    },
    taxonomyState: {
      valid: Boolean(taxonomyState.valid)
    },
    seoMetadata: {
      metaTitle: asString(seoMetadata.metaTitle),
      metaDescription: asString(seoMetadata.metaDescription)
    },
    seoJsonLdValid: Boolean(row.seoJsonLdValid)
  };
}

async function listThemesFromCollection(collectionPath: string): Promise<StudioTheme[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(
    `${collectionPath}?pagination[pageSize]=200&sort=updatedAt:desc`
  );
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => normalizeTheme(unwrapStrapiEntity(row)));
}

async function listThemesFromStrapi(): Promise<{ themes: StudioTheme[]; schemaSource: ThemeSchemaSource }> {
  try {
    const themes = await listThemesFromCollection(CANONICAL_THEME_COLLECTION);
    return {
      themes,
      schemaSource: "canonical"
    };
  } catch {
    const themes = await listThemesFromCollection(LEGACY_THEME_COLLECTION);
    return {
      themes,
      schemaSource: "legacy"
    };
  }
}

async function listGovernancePagesFromStrapi(): Promise<GovernancePage[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(
    "/api/studio-pages?pagination[pageSize]=200&sort=updatedAt:desc"
  );
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => normalizeGovernancePage(unwrapStrapiEntity(row)));
}

async function resolveThemeMutationId(themeKey: string, schemaSource: ThemeSchemaSource): Promise<string | null> {
  const collectionPath = schemaSource === "canonical" ? CANONICAL_THEME_COLLECTION : LEGACY_THEME_COLLECTION;
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `${collectionPath}?filters[themeKey][$eq]=${encodeURIComponent(themeKey)}&pagination[pageSize]=1`
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
      const { themes } = await listThemesFromStrapi();
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

function resolveRequestedPage(pages: GovernancePage[], pageId: string | null, pageSlug: string | null): GovernancePage | null {
  if (pages.length === 0) {
    return null;
  }
  if (pageId) {
    const byId = pages.find((page) => page.id === pageId);
    if (byId) {
      return byId;
    }
  }
  if (pageSlug) {
    const bySlug = pages.find((page) => page.slug === pageSlug);
    if (bySlug) {
      return bySlug;
    }
  }
  return pages[0] ?? null;
}

function buildGovernanceChecks(page: GovernancePage | null): GovernanceCheck[] {
  return [
    { id: "preview-valid", label: "Preview valid", pass: Boolean(page?.previewValid) },
    { id: "block-schema-valid", label: "Block schema valid", pass: Boolean(page?.blockSchemaValid) },
    { id: "product-mapped", label: "Product mapped", pass: Boolean(page?.productMapping.trim()) },
    { id: "industry-mapped", label: "Industry mapped", pass: Boolean(page && page.industryMapping.length > 0) },
    {
      id: "primary-cta-set",
      label: "Primary CTA set",
      pass: Boolean(page?.primaryCta.text.trim() && page.primaryCta.url.trim())
    },
    {
      id: "conversion-present",
      label: "Conversion configuration present",
      pass: Boolean(page?.conversionConfig.strategy.trim())
    },
    {
      id: "campaign-present",
      label: "Campaign / UTM strategy present",
      pass: Boolean(
        page?.campaignUtmStrategy.source.trim() &&
          page.campaignUtmStrategy.medium.trim() &&
          page.campaignUtmStrategy.campaign.trim()
      )
    },
    { id: "taxonomy-valid", label: "Taxonomy valid", pass: Boolean(page?.taxonomyState.valid) },
    {
      id: "seo-metadata-valid",
      label: "SEO metadata valid",
      pass: Boolean(page?.seoMetadata.metaTitle.trim() && page.seoMetadata.metaDescription.trim())
    },
    { id: "seo-jsonld-valid", label: "SEO / JSON-LD valid", pass: Boolean(page?.seoJsonLdValid) }
  ];
}

async function resolveGovernanceReport(payload: PublishRequestPayload): Promise<GovernanceReport> {
  const requestedPageId =
    typeof payload.pageId === "string" && payload.pageId.trim().length > 0 ? payload.pageId.trim() : null;
  const requestedPageSlug =
    typeof payload.pageSlug === "string" && payload.pageSlug.trim().length > 0 ? payload.pageSlug.trim() : null;

  if (isStrapiConfigured()) {
    try {
      const strapiPages = await listGovernancePagesFromStrapi();
      const selected = resolveRequestedPage(strapiPages, requestedPageId, requestedPageSlug);
      const checks = buildGovernanceChecks(selected);
      return {
        ready: checks.every((check) => check.pass),
        page: selected
          ? {
              id: selected.id,
              name: selected.name,
              slug: selected.slug
            }
          : null,
        checks,
        source: "strapi"
      };
    } catch {
      // fall through to fallback store
    }
  }

  const fallbackPages = getStudioStore().pages.map((page) => normalizeGovernancePage(page));
  const selected = resolveRequestedPage(fallbackPages, requestedPageId, requestedPageSlug);
  const checks = buildGovernanceChecks(selected);
  return {
    ready: checks.every((check) => check.pass),
    page: selected
      ? {
          id: selected.id,
          name: selected.name,
          slug: selected.slug
        }
      : null,
    checks,
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

async function persistPublishToStrapi(activeTheme: StudioTheme): Promise<{ themeId: string; schemaSource: ThemeSchemaSource }> {
  const { schemaSource } = await listThemesFromStrapi();
  const mutationId = await resolveThemeMutationId(activeTheme.themeKey, schemaSource);
  if (!mutationId) {
    throw new Error(`Unable to resolve Strapi mutation id for themeKey="${activeTheme.themeKey}" in ${schemaSource} collection.`);
  }

  const collectionPath = schemaSource === "canonical" ? CANONICAL_THEME_COLLECTION : LEGACY_THEME_COLLECTION;
  await requestStrapi(`${collectionPath}/${encodeURIComponent(mutationId)}`, {
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
    themeId: mutationId,
    schemaSource
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
    const governance = await resolveGovernanceReport(payload);
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
    const fidelityBlocked =
      mode === "apply" && settings.fidelity.mode === "disallow-below-threshold" && fidelityReport.exceedsThreshold;
    const governanceBlocked = mode === "apply" && !governance.ready;
    const blocked = fidelityBlocked || governanceBlocked;
    let applied = mode === "apply" && !blocked;
    const warnings = buildWarnings({
      report: fidelityReport,
      fidelityMode: settings.fidelity.mode,
      blocked: fidelityBlocked
    });

    if (!governance.page) {
      warnings.push({
        code: "publish.governance_no_page",
        message: "No governed page is available for publish readiness evaluation.",
        severity: mode === "apply" ? "error" : "warning"
      });
    } else if (!governance.ready) {
      warnings.push({
        code: "publish.governance_incomplete",
        message: `Governance readiness failed for "${governance.page.slug}".`,
        severity: mode === "apply" ? "error" : "warning"
      });
    }

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
          warnings.push({
            code: "publish.theme_schema_source",
            message: `Theme mutation persisted through ${persisted.schemaSource} schema collection.`,
            severity: persisted.schemaSource === "canonical" ? "info" : "warning"
          });
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
        blockedBy: {
          fidelity: fidelityBlocked,
          governance: governanceBlocked
        },
        source,
        fidelityMode: settings.fidelity.mode,
        warnings,
        activeTheme: summarizeTheme(activeTheme),
        ignoredPreviewSwatchThemeId: previewSwatchThemeId,
        rejectionReason: fidelityBlocked
          ? "Fidelity threshold rejection in disallow mode."
          : governanceBlocked
            ? "Governance readiness checklist failed."
            : null,
        fidelity: fidelityReport,
        governance,
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
