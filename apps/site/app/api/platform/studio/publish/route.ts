import type { StudioFidelityMode, StudioTheme } from "../../../../platform/onboarding/_lib/studio-types";
import { evaluateStudioFidelity, type StudioFigmaValidationToken } from "../_lib/fidelity";
import { getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured, requestStrapi, unwrapStrapiEntity } from "../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type StrapiEntityResponse = {
  data?: Record<string, unknown> | null;
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

const CANONICAL_THEME_COLLECTION = "/api/studio-themes";
const CANONICAL_PAGE_COLLECTION = "/api/studio-pages";

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

async function listThemesFromStrapi(): Promise<StudioTheme[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(
    `${CANONICAL_THEME_COLLECTION}?pagination[pageSize]=200&sort=updatedAt:desc`
  );
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => normalizeTheme(unwrapStrapiEntity(row)));
}

async function listGovernancePagesFromStrapi(status?: "draft" | "published"): Promise<GovernancePage[]> {
  const statusQuery = status ? `&status=${status}` : "";
  const response = await requestStrapi<StrapiCollectionResponse>(
    `${CANONICAL_PAGE_COLLECTION}?pagination[pageSize]=200&sort=updatedAt:desc${statusQuery}`
  );
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => normalizeGovernancePage(unwrapStrapiEntity(row)));
}

async function readDraftPagePublishFields(pageId: string): Promise<Record<string, unknown> | null> {
  const response = await requestStrapi<StrapiEntityResponse>(
    `${CANONICAL_PAGE_COLLECTION}/${encodeURIComponent(pageId)}?status=draft`
  );
  if (!response.data) {
    return null;
  }
  const row = unwrapStrapiEntity(response.data);
  return {
    pageKey: typeof row.pageKey === "string" ? row.pageKey : undefined,
    name: typeof row.name === "string" ? row.name : undefined,
    slug: typeof row.slug === "string" ? row.slug : undefined,
    locale: typeof row.locale === "string" ? row.locale : undefined,
    activeShellId: typeof row.activeShellId === "string" ? row.activeShellId : undefined,
    shellKey: typeof row.shellKey === "string" ? row.shellKey : undefined,
    themeKey: typeof row.themeKey === "string" ? row.themeKey : undefined,
    blockOrder: row.blockOrder,
    fieldValues: row.fieldValues,
    actionOverrides: row.actionOverrides,
    productMapping: row.productMapping,
    industryMapping: row.industryMapping,
    primaryCta: row.primaryCta,
    conversionConfig: row.conversionConfig,
    campaignUtmStrategy: row.campaignUtmStrategy,
    taxonomyState: row.taxonomyState,
    seoMetadata: row.seoMetadata,
    seoJsonLdValid: row.seoJsonLdValid,
    blockSchemaValid: row.blockSchemaValid,
    previewValid: row.previewValid,
    previewHtml: row.previewHtml,
    publishedPreviewHtml: row.previewHtml
  };
}

async function publishPageInStrapi(pageId: string): Promise<{ pageId: string }> {
  const draftFields = await readDraftPagePublishFields(pageId).catch(() => null);
  const publishedAt = new Date().toISOString();
  const publishEndpoints = [
    `${CANONICAL_PAGE_COLLECTION}/${encodeURIComponent(pageId)}/actions/publish`,
    `${CANONICAL_PAGE_COLLECTION}/${encodeURIComponent(pageId)}/publish`
  ];

  for (const endpoint of publishEndpoints) {
    try {
      await requestStrapi(endpoint, {
        method: "POST",
        body: {}
      });
      if (draftFields) {
        await requestStrapi(`${CANONICAL_PAGE_COLLECTION}/${encodeURIComponent(pageId)}?status=draft`, {
          method: "PUT",
          body: {
            publishedPreviewHtml: draftFields.previewHtml,
            publishedAt
          }
        });
        await requestStrapi(`${CANONICAL_PAGE_COLLECTION}/${encodeURIComponent(pageId)}?status=published`, {
          method: "PUT",
          body: {
            ...draftFields,
            status: "published",
            lifecycle: "published",
            publishedAt
          }
        });
      }
      return { pageId };
    } catch {
      // try next canonical publish endpoint
    }
  }

  await requestStrapi(`${CANONICAL_PAGE_COLLECTION}/${encodeURIComponent(pageId)}`, {
    method: "PUT",
    body: {
      ...(draftFields ?? {}),
      publishedPreviewHtml: draftFields?.previewHtml,
      status: "published",
      lifecycle: "published",
      publishedAt
    }
  });
  return { pageId };
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
      pass: Boolean(page?.seoMetadata.metaTitle.trim() && page?.seoMetadata.metaDescription.trim())
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
      const strapiPages = await listGovernancePagesFromStrapi("draft");
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

function markFallbackPagePublished(pageId: string): void {
  const store = getStudioStore();
  replaceStore({
    ...store,
    pages: store.pages.map((page) =>
      page.id === pageId
        ? {
            ...page,
            status: "published",
            lifecycle: "published",
            updatedAt: new Date().toISOString().slice(0, 10)
          }
        : page
    )
  });
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
    const { theme: activeTheme, source: themeSource } = await resolveActiveTheme();
    if (isStrapiConfigured() && (governance.source !== "strapi" || themeSource !== "strapi")) {
      return Response.json(
        {
          ok: false,
          error: "Canonical studio publish requires canonical studio-page governance and canonical studio-theme resolution from Strapi."
        },
        { status: 502 }
      );
    }
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
      source: governance.source,
      mutated: false,
      pageId: null as string | null
    };

    if (applied && governance.page) {
      if (governance.source === "fallback") {
        markFallbackPagePublished(governance.page.id);
        persistence.mutated = true;
        persistence.pageId = governance.page.id;
      } else {
        try {
          const persisted = await publishPageInStrapi(governance.page.id);
          persistence.mutated = true;
          persistence.pageId = persisted.pageId;
        } catch (error) {
          warnings.push({
            code: "publish.strapi_persist_failed",
            message: `Canonical page publish failed in Strapi: ${error instanceof Error ? error.message : String(error)}`,
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
      governancePageId: governance.page?.id ?? null,
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
        source: governance.source === "strapi" && themeSource === "strapi" ? "strapi" : governance.source,
        fidelityMode: settings.fidelity.mode,
        warnings,
        activeTheme: summarizeTheme(activeTheme),
        ignoredPreviewSwatchThemeId: previewSwatchThemeId,
        rejectionReason: blocked
          ? fidelityBlocked
            ? `Highest mismatch ${fidelityReport.highestMismatchRatio.toFixed(3)} exceeded threshold ${fidelityReport.threshold.toFixed(3)}.`
            : "Governance readiness checks failed."
          : null,
        fidelity: {
          threshold: fidelityReport.threshold,
          hasDarkMediaQuery: fidelityReport.hasDarkMediaQuery,
          darkModeMismatchRatio: fidelityReport.darkModeMismatchRatio,
          typographyMismatchRatio: fidelityReport.typographyMismatchRatio,
          highestMismatchRatio: fidelityReport.highestMismatchRatio,
          exceedsThreshold: fidelityReport.exceedsThreshold
        },
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
