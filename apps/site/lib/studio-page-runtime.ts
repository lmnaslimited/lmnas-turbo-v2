import type { CSSProperties } from "react";
import { loadProjectEnv } from "../app/lib/env";
import { buildStudioThemeCssVariables, createCanonicalBlockSnapshot, themeIsDarkMode } from "./studio-canonical";
import type { StudioBlockTemplate, StudioShell, StudioTheme } from "../app/platform/onboarding/_lib/studio-types";

type ImportedDomSnapshotBlock = {
  type: "imported_dom_snapshot";
  domJson: NonNullable<StudioBlockTemplate["domJson"]>;
  classMap: Record<string, string>;
  stylesheetRef: string;
};

type StudioPageStatus = "draft" | "published";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type StudioPageSeoMetadata = {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
};

type StudioRuntimePageRecord = {
  id: string;
  name: string;
  slug: string;
  locale: string;
  status: StudioPageStatus;
  previewValid: boolean;
  blockSchemaValid: boolean;
  seoJsonLdValid: boolean;
  productMapping: string;
  industryMapping: string[];
  primaryCta: {
    text: string;
    url: string;
  };
  conversionConfig: {
    strategy: string;
  };
  seoMetadata: StudioPageSeoMetadata;
  blockOrder: string[];
  shellKey?: string;
  themeKey?: string;
};

type StudioRuntimeTheme = {
  themeScopeClass: string;
  darkMode: boolean;
  cssVars: CSSProperties;
};

function statusMatches(value: unknown, expected: StudioPageStatus | undefined): boolean {
  if (!expected) {
    return true;
  }
  return (value === "published" ? "published" : "draft") === expected;
}

export type StudioRuntimePage = {
  id: string;
  name: string;
  slug: string;
  locale: string;
  status: StudioPageStatus;
  seoMetadata: StudioPageSeoMetadata;
  canonicalPath: string;
  canonicalUrl: string;
  renderBlocks: ImportedDomSnapshotBlock[];
  jsonLd: object[];
  theme: StudioRuntimeTheme;
};

export type StudioRuntimeRouteResult =
  | {
      state: "missing";
    }
  | {
      state: "blocked";
      page: Pick<StudioRuntimePage, "id" | "name" | "slug" | "locale" | "status" | "seoMetadata" | "canonicalPath" | "canonicalUrl">;
      issues: string[];
    }
  | {
      state: "ready";
      page: StudioRuntimePage;
    };

function readStrapiConfig(): { url: string; token?: string } | null {
  loadProjectEnv();
  const url = process.env.STRAPI_URL?.trim();
  const token = process.env.STRAPI_API_TOKEN?.trim();
  if (!url) {
    return null;
  }
  return {
    url: url.replace(/\/$/, ""),
    ...(token ? { token } : {})
  };
}

function unwrapStrapiEntity(entity: Record<string, unknown>): Record<string, unknown> & { id: string } {
  const attributes =
    entity.attributes && typeof entity.attributes === "object" && !Array.isArray(entity.attributes)
      ? (entity.attributes as Record<string, unknown>)
      : entity;
  const idValue = entity.documentId ?? entity.id ?? attributes.documentId ?? attributes.id;
  return {
    id: String(idValue ?? ""),
    ...attributes
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeSeoMetadata(value: unknown): StudioPageSeoMetadata {
  const row = asObject(value);
  const canonicalUrl = asString(row.canonicalUrl).trim();
  return {
    metaTitle: asString(row.metaTitle).trim(),
    metaDescription: asString(row.metaDescription).trim(),
    ...(canonicalUrl.length > 0 ? { canonicalUrl } : {})
  };
}

function buildCanonicalPath(slug: string, locale: string): string {
  const normalizedSlug = slug.trim();
  const normalizedLocale = locale.trim() || "en";
  return normalizedSlug === "home" ? `/${normalizedLocale}` : `/${normalizedLocale}/${normalizedSlug.replace(/^\/+/, "")}`;
}

function resolveCanonicalBaseUrl(): string {
  loadProjectEnv();
  const configuredBase = process.env.SITE_CANONICAL_BASE?.trim();
  if (configuredBase && configuredBase.length > 0) {
    return configuredBase.replace(/\/$/, "");
  }
  return "https://lmnas.com";
}

function resolveCanonicalUrl(record: StudioRuntimePageRecord): string {
  return record.seoMetadata.canonicalUrl?.trim() || `${resolveCanonicalBaseUrl()}${buildCanonicalPath(record.slug, record.locale)}`;
}

function mapStudioRuntimePageRecord(value: Record<string, unknown>): StudioRuntimePageRecord | null {
  const row = unwrapStrapiEntity(value);
  const primaryCta = asObject(row.primaryCta);
  const conversionConfig = asObject(row.conversionConfig);
  const slug = asString(row.slug).trim();
  if (!slug) {
    return null;
  }

  return {
    id: row.id,
    name: asString(row.name).trim() || slug,
    slug,
    locale: asString(row.locale).trim() || "en",
    status: row.status === "published" ? "published" : "draft",
    previewValid: Boolean(row.previewValid),
    blockSchemaValid: Boolean(row.blockSchemaValid),
    seoJsonLdValid: Boolean(row.seoJsonLdValid),
    productMapping: asString(row.productMapping).trim(),
    industryMapping: asStringArray(row.industryMapping),
    primaryCta: {
      text: asString(primaryCta.text).trim(),
      url: asString(primaryCta.url).trim()
    },
    conversionConfig: {
      strategy: asString(conversionConfig.strategy).trim()
    },
    seoMetadata: normalizeSeoMetadata(row.seoMetadata),
    blockOrder: Array.isArray(row.blockOrder) ? row.blockOrder.filter((entry): entry is string => typeof entry === "string") : [],
    shellKey: asString(row.shellKey).trim() || undefined,
    themeKey: asString(row.themeKey).trim() || undefined
  };
}

function normalizeThemeToken(value: unknown): StudioTheme["tokens"][number] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.key !== "string" || typeof row.value !== "string") {
    return null;
  }
  const category = row.category;
  return {
    key: row.key,
    label: typeof row.label === "string" ? row.label : row.key,
    category:
      category === "color" || category === "typography" || category === "spacing" || category === "radius" || category === "shadow"
        ? category
        : "color",
    value: row.value,
    cssVariable: typeof row.cssVariable === "string" ? row.cssVariable : row.key,
    mapped: Boolean(row.mapped)
  };
}

function normalizeTheme(value: Record<string, unknown>): StudioTheme {
  const row = unwrapStrapiEntity(value);
  const darkMode = Boolean(row.darkMode);
  const themeMode = row.themeMode === "light" || row.themeMode === "dark" || row.themeMode === "system" ? row.themeMode : darkMode ? "dark" : "system";
  return {
    id: row.id,
    themeKey: asString(row.themeKey).trim() || row.id,
    name: asString(row.name).trim() || "Theme",
    status: row.status === "active" || row.status === "draft" ? row.status : "inactive",
    sourceRef: asString(row.sourceRef).trim() || "canonical-theme",
    themeScopeClass: asString(row.themeScopeClass).trim() || `theme-${asString(row.themeKey).trim() || row.id}`,
    themeMode,
    createdAt: asString(row.createdAt).slice(0, 10),
    updatedAt: asString(row.updatedAt).slice(0, 10),
    tokenCoverage: typeof row.tokenCoverage === "number" ? row.tokenCoverage : Number(row.tokenCoverage ?? 0) || 0,
    themeDebt: asString(row.themeDebt),
    darkMode: themeMode === "dark" || (themeMode === "system" && darkMode),
    tokens: Array.isArray(row.tokens)
      ? row.tokens.map((entry) => normalizeThemeToken(entry)).filter((entry): entry is NonNullable<ReturnType<typeof normalizeThemeToken>> => entry !== null)
      : []
  };
}

function normalizeBlock(value: Record<string, unknown>): StudioBlockTemplate {
  const row = unwrapStrapiEntity(value);
  const snapshot =
    row.domJson && typeof row.domJson === "object" && !Array.isArray(row.domJson)
      ? {
          blockType: row.blockType === "imported_dom_snapshot" ? row.blockType : "imported_dom_snapshot",
          domJson: row.domJson as NonNullable<StudioBlockTemplate["domJson"]>,
          classMap:
            row.classMap && typeof row.classMap === "object" && !Array.isArray(row.classMap)
              ? (row.classMap as Record<string, string>)
              : {},
          stylesheetRef: asString(row.stylesheetRef).trim() || "/studio-runtime.css"
        }
      : createCanonicalBlockSnapshot({
          html: "<section></section>",
          sourceUrl: asString(row.sourceRef).trim() || "studio-runtime",
          stylesheetRef: "/studio-runtime.css"
        });

  return {
    id: row.id,
    key: asString(row.blockKey).trim() || row.id,
    name: asString(row.name).trim() || "Block",
    blockType: "imported_dom_snapshot",
    family: asString(row.family).trim() || "rich_text_section",
    status: row.status === "inactive" || row.status === "draft" ? row.status : "active",
    lifecycle: row.lifecycle === "published" || row.lifecycle === "archived" ? row.lifecycle : "draft",
    scope: row.scope === "page-local" ? "page-local" : "global",
    schemaStatus: row.schemaStatus === "invalid" || row.schemaStatus === "warning" ? row.schemaStatus : "valid",
    themeKey: asString(row.themeKey).trim() || "default",
    sourceType: asString(row.sourceType).trim() || "unknown",
    sourceRef: asString(row.sourceRef).trim() || "unknown",
    domJson: snapshot.domJson,
    classMap: snapshot.classMap,
    stylesheetRef: snapshot.stylesheetRef,
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    editableFields: [],
    actions: [],
    inUseCount: typeof row.usageCount === "number" ? row.usageCount : 0,
    usageCount: typeof row.usageCount === "number" ? row.usageCount : 0,
    createdAt: asString(row.createdAt).slice(0, 10),
    updatedAt: asString(row.updatedAt).slice(0, 10)
  };
}

function normalizeShell(value: Record<string, unknown>): StudioShell {
  const row = unwrapStrapiEntity(value);
  return {
    id: row.id,
    key: asString(row.shellKey).trim() || row.id,
    name: asString(row.name).trim() || "Shell",
    role: row.role === "navbar" || row.role === "footer" ? row.role : "full",
    status: row.status === "inactive" ? "inactive" : "active",
    updatedAt: asString(row.updatedAt).slice(0, 10),
    menuItems: [],
    actions: [],
    navbarBlocks: [],
    footerBlocks: []
  };
}

function evaluateRuntimeGovernance(record: StudioRuntimePageRecord, renderBlocks: ImportedDomSnapshotBlock[]): string[] {
  const issues: string[] = [];

  if (!record.previewValid) {
    issues.push("Preview acceptance is incomplete.");
  }
  if (!record.blockSchemaValid) {
    issues.push("Block schema validation failed.");
  }
  if (record.productMapping.length === 0) {
    issues.push("Product mapping is required.");
  }
  if (record.industryMapping.length === 0) {
    issues.push("Industry mapping is required.");
  }
  if (record.primaryCta.text.length === 0 || record.primaryCta.url.length === 0) {
    issues.push("Primary CTA is required.");
  }
  if (record.conversionConfig.strategy.length === 0) {
    issues.push("Conversion configuration is required.");
  }
  if (record.seoMetadata.metaTitle.length === 0 || record.seoMetadata.metaDescription.length === 0) {
    issues.push("SEO metadata is incomplete.");
  }
  if (!record.seoJsonLdValid) {
    issues.push("SEO JSON-LD validation is incomplete.");
  }
  if (renderBlocks.length === 0) {
    issues.push("Runtime render model is empty.");
  }

  return issues;
}

function buildRuntimeJsonLd(record: StudioRuntimePageRecord, canonicalUrl: string): object[] {
  if (!record.seoJsonLdValid) {
    return [];
  }

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: record.seoMetadata.metaTitle || record.name,
      description: record.seoMetadata.metaDescription,
      url: canonicalUrl,
      inLanguage: record.locale,
      about: record.productMapping,
      potentialAction: {
        "@type": "ViewAction",
        name: record.primaryCta.text,
        target: record.primaryCta.url
      }
    }
  ];
}

function buildRuntimeTheme(record: StudioRuntimePageRecord, themes: StudioTheme[]): StudioRuntimeTheme {
  const theme = themes.find((entry) => entry.themeKey === record.themeKey) ?? themes.find((entry) => entry.status === "active") ?? null;
  return {
    themeScopeClass: theme?.themeScopeClass ?? "theme-default",
    darkMode: themeIsDarkMode(theme),
    cssVars: buildStudioThemeCssVariables(theme)
  };
}

function buildRenderBlocks(params: {
  record: StudioRuntimePageRecord;
  blocks: StudioBlockTemplate[];
  shells: StudioShell[];
  canonicalUrl: string;
}): ImportedDomSnapshotBlock[] {
  const keyToBlock = new Map<string, StudioBlockTemplate>();
  params.blocks.forEach((block) => {
    keyToBlock.set(block.key, block);
    keyToBlock.set(block.id, block);
  });

  const selectedShell =
    (params.record.shellKey
      ? params.shells.find((shell) => shell.key === params.record.shellKey || shell.id === params.record.shellKey)
      : null) ?? params.shells.find((shell) => shell.status === "active" && shell.role === "full") ?? null;
  const activeNavbar = params.shells.find((shell) => shell.status === "active" && shell.role === "navbar") ?? null;
  const activeFooter = params.shells.find((shell) => shell.status === "active" && shell.role === "footer") ?? null;

  const shellSnapshots: ImportedDomSnapshotBlock[] = [];
  
  // No longer building shell snapshots from previewHtml
  // Canonical shells must eventually provide domJson

  const blockSnapshots = params.record.blockOrder
    .map((reference) => keyToBlock.get(reference) ?? null)
    .filter((block): block is StudioBlockTemplate => block !== null)
    .flatMap((block) => {
      if (!block.domJson) {
        return [];
      }
      return [
        {
          type: "imported_dom_snapshot" as const,
          domJson: block.domJson,
          classMap: block.classMap ?? {},
          stylesheetRef: block.stylesheetRef ?? "/studio-runtime.css"
        }
      ];
    });

  return [...shellSnapshots, ...blockSnapshots];
}

async function fetchStrapiCollection(
  config: { url: string; token?: string },
  path: string,
  cacheMode: RequestCache,
  revalidateSeconds?: number
): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(`${config.url}${path}`, {
    method: "GET",
    headers: {
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {})
    },
    cache: cacheMode,
    ...(revalidateSeconds !== undefined ? { next: { revalidate: revalidateSeconds } } : {})
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as StrapiCollectionResponse;
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function loadStudioPageForRoute(params: {
  slug: string;
  locale: string;
  preview: boolean;
}): Promise<StudioRuntimeRouteResult> {
  const config = readStrapiConfig();
  if (!config) {
    return { state: "missing" };
  }

  const status = params.preview ? "draft" : "published";
  const cacheMode = params.preview || process.env.NODE_ENV !== "production" ? "no-store" : "force-cache";
  const revalidateSeconds = params.preview || process.env.NODE_ENV !== "production" ? undefined : 60;

  try {
    const pages = await fetchStrapiCollection(
      config,
      `/api/studio-pages?filters[slug][$eq]=${encodeURIComponent(params.slug)}&pagination[pageSize]=20&sort=updatedAt:desc&status=${encodeURIComponent(status)}`,
      cacheMode,
      revalidateSeconds
    );
    const filteredRows = pages.filter((entry) => statusMatches(unwrapStrapiEntity(entry).status, status));
    const selectedRow =
      filteredRows.find((entry) => asString(unwrapStrapiEntity(entry).locale).trim() === params.locale) ??
      filteredRows.find((entry) => asString(unwrapStrapiEntity(entry).locale).trim() === "en") ??
      filteredRows[0] ??
      null;

    if (!selectedRow) {
      return { state: "missing" };
    }

    const record = mapStudioRuntimePageRecord(selectedRow);
    if (!record) {
      return { state: "missing" };
    }

    const [blocksPayload, themesPayload, shellsPayload] = await Promise.all([
      fetchStrapiCollection(config, "/api/studio-blocks?pagination[pageSize]=200&sort=updatedAt:desc", cacheMode, revalidateSeconds),
      fetchStrapiCollection(config, "/api/studio-themes?pagination[pageSize]=200&sort=updatedAt:desc", cacheMode, revalidateSeconds),
      fetchStrapiCollection(config, "/api/studio-shells?pagination[pageSize]=200&sort=updatedAt:desc", cacheMode, revalidateSeconds)
    ]);
    const blocks = blocksPayload.map((entry) => normalizeBlock(entry));
    const themes = themesPayload.map((entry) => normalizeTheme(entry));
    const shells = shellsPayload.map((entry) => normalizeShell(entry));

    const canonicalPath = buildCanonicalPath(record.slug, record.locale);
    const canonicalUrl = resolveCanonicalUrl(record);
    const renderBlocks = buildRenderBlocks({
      record,
      blocks,
      shells,
      canonicalUrl
    });
    const issues = evaluateRuntimeGovernance(record, renderBlocks);

    if (issues.length > 0) {
      return {
        state: "blocked",
        page: {
          id: record.id,
          name: record.name,
          slug: record.slug,
          locale: record.locale,
          status: record.status,
          seoMetadata: record.seoMetadata,
          canonicalPath,
          canonicalUrl
        },
        issues
      };
    }

    return {
      state: "ready",
      page: {
        id: record.id,
        name: record.name,
        slug: record.slug,
        locale: record.locale,
        status: record.status,
        seoMetadata: record.seoMetadata,
        canonicalPath,
        canonicalUrl,
        renderBlocks,
        jsonLd: buildRuntimeJsonLd(record, canonicalUrl),
        theme: buildRuntimeTheme(record, themes)
      }
    };
  } catch {
    return { state: "missing" };
  }
}
