import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { StudioActionType, StudioBlockTemplate, StudioPageDocument } from "../../../../platform/onboarding/_lib/studio-types";
import { isStudioActionType } from "../../../../platform/onboarding/_lib/studio-types";
import { loadProjectEnv } from "../../../../lib/env";
import { getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured, requestStrapi, unwrapStrapiEntity } from "../_lib/strapi";

type PageSaveRequest = {
  page?: Partial<StudioPageDocument>;
  mode?: "save" | "apply" | "import-blocks";
  html?: unknown;
  sourceRef?: unknown;
  createRouteSlug?: unknown;
  routeSlug?: unknown;
};

type PageApplyResult = {
  applied: boolean;
  warnings: string[];
};

type BlockTemplateUpsert = {
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
};

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
  meta?: {
    pagination?: {
      total?: number;
    };
  };
};

type ImportNormalization = {
  html: string;
  sourceRef: string;
};

function normalizePage(input: Partial<StudioPageDocument>): StudioPageDocument {
  const slug = typeof input.slug === "string" && input.slug.trim().length > 0 ? input.slug.trim() : "new-page";
  const locale = typeof input.locale === "string" && input.locale.trim().length > 0 ? input.locale.trim() : "en";
  const industryMapping = Array.isArray(input.industryMapping)
    ? input.industryMapping.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const productMapping = typeof input.productMapping === "string" && input.productMapping.trim().length > 0 ? input.productMapping.trim() : "";
  const primaryCtaText =
    typeof input.primaryCta?.text === "string" && input.primaryCta.text.trim().length > 0 ? input.primaryCta.text.trim() : "";
  const primaryCtaUrl =
    typeof input.primaryCta?.url === "string" && input.primaryCta.url.trim().length > 0 ? input.primaryCta.url.trim() : "";

  return {
    id: typeof input.id === "string" && input.id.length > 0 ? input.id : `page-${Date.now()}`,
    name: typeof input.name === "string" && input.name.length > 0 ? input.name : slug,
    slug,
    locale,
    lifecycle: input.lifecycle ?? "draft",
    status: input.status ?? "draft",
    activeShellId: typeof input.activeShellId === "string" ? input.activeShellId : undefined,
    shellKey: typeof input.shellKey === "string" ? input.shellKey : undefined,
    blockOrder: Array.isArray(input.blockOrder) ? input.blockOrder.filter((value): value is string => typeof value === "string") : [],
    fieldValues:
      input.fieldValues && typeof input.fieldValues === "object" && !Array.isArray(input.fieldValues)
        ? (input.fieldValues as Record<string, string>)
        : {},
    actionOverrides:
      input.actionOverrides && typeof input.actionOverrides === "object" && !Array.isArray(input.actionOverrides)
        ? (input.actionOverrides as StudioPageDocument["actionOverrides"])
        : {},
    productMapping,
    industryMapping,
    primaryCta: {
      text: primaryCtaText,
      url: primaryCtaUrl
    },
    conversionConfig: {
      trackConversions: Boolean(input.conversionConfig?.trackConversions),
      strategy: typeof input.conversionConfig?.strategy === "string" ? input.conversionConfig.strategy : "",
      valuePoints: Number.isFinite(input.conversionConfig?.valuePoints)
        ? Number(input.conversionConfig?.valuePoints)
        : 0
    },
    campaignUtmStrategy: {
      source: typeof input.campaignUtmStrategy?.source === "string" ? input.campaignUtmStrategy.source : "",
      medium: typeof input.campaignUtmStrategy?.medium === "string" ? input.campaignUtmStrategy.medium : "",
      campaign: typeof input.campaignUtmStrategy?.campaign === "string" ? input.campaignUtmStrategy.campaign : "",
      ...(typeof input.campaignUtmStrategy?.content === "string" ? { content: input.campaignUtmStrategy.content } : {}),
      ...(typeof input.campaignUtmStrategy?.term === "string" ? { term: input.campaignUtmStrategy.term } : {})
    },
    taxonomyState: {
      valid: Boolean(input.taxonomyState?.valid),
      tags: Array.isArray(input.taxonomyState?.tags)
        ? input.taxonomyState.tags.filter((value): value is string => typeof value === "string")
        : [],
      ...(typeof input.taxonomyState?.notes === "string" ? { notes: input.taxonomyState.notes } : {})
    },
    seoMetadata: {
      metaTitle: typeof input.seoMetadata?.metaTitle === "string" ? input.seoMetadata.metaTitle : "",
      metaDescription: typeof input.seoMetadata?.metaDescription === "string" ? input.seoMetadata.metaDescription : "",
      ...(typeof input.seoMetadata?.canonicalUrl === "string" ? { canonicalUrl: input.seoMetadata.canonicalUrl } : {})
    },
    seoJsonLdValid: Boolean(input.seoJsonLdValid),
    blockSchemaValid: Boolean(input.blockSchemaValid),
    previewValid: Boolean(input.previewValid),
    previewHtml: typeof input.previewHtml === "string" ? input.previewHtml : "",
    updatedAt: new Date().toISOString().slice(0, 10)
  };
}

function savePageInFallback(page: StudioPageDocument): StudioPageDocument[] {
  const store = getStudioStore();
  const pages = [...store.pages];
  const index = pages.findIndex((candidate) => candidate.id === page.id || candidate.slug === page.slug);
  if (index >= 0) {
    pages[index] = {
      ...pages[index],
      ...page,
      updatedAt: new Date().toISOString().slice(0, 10)
    };
  } else {
    pages.unshift(page);
  }

  replaceStore({
    ...store,
    pages
  });

  return pages;
}

function coerceString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function mapBlocksToOrder(value: unknown): string[] {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return null;
        }
        const row = entry as Record<string, unknown>;
        if (typeof row.blockKey === "string" && row.blockKey.trim().length > 0) {
          return row.blockKey;
        }
        if (typeof row.id === "string" && row.id.trim().length > 0) {
          return row.id;
        }
        if (typeof row.id === "number") {
          return String(row.id);
        }
        if (typeof row.__component === "string" && row.__component.length > 0) {
          return row.__component;
        }
        return null;
      })
      .filter((entry): entry is string => entry !== null);

    if (normalized.length > 0) {
      return normalized;
    }
  }
  return [];
}

function mapStrapiPageToStudio(value: unknown): StudioPageDocument {
  const row = (value ?? {}) as Record<string, unknown>;
  const idCandidate = row.documentId ?? row.id;
  return normalizePage({
    id: typeof idCandidate === "string" || typeof idCandidate === "number" ? String(idCandidate) : undefined,
    name: coerceString(row.name, coerceString(row.slug, "Untitled Page")),
    slug: coerceString(row.slug, "new-page"),
    locale: coerceString(row.locale, "en"),
    activeShellId: typeof row.activeShellId === "string" ? row.activeShellId : undefined,
    shellKey: typeof row.shellKey === "string" ? row.shellKey : undefined,
    lifecycle:
      row.lifecycle === "published" || row.lifecycle === "archived" ? row.lifecycle : row.lifecycle === "draft" ? "draft" : "draft",
    status: row.status === "published" ? "published" : "draft",
    blockOrder: Array.isArray(row.blockOrder) ? (row.blockOrder as string[]) : mapBlocksToOrder(row.blocks),
    fieldValues:
      row.fieldValues && typeof row.fieldValues === "object" && !Array.isArray(row.fieldValues)
        ? (row.fieldValues as Record<string, string>)
        : {},
    actionOverrides:
      row.actionOverrides && typeof row.actionOverrides === "object" && !Array.isArray(row.actionOverrides)
        ? (row.actionOverrides as StudioPageDocument["actionOverrides"])
        : {},
    productMapping: coerceString(row.productMapping),
    industryMapping: Array.isArray(row.industryMapping)
      ? row.industryMapping.filter((entry): entry is string => typeof entry === "string")
      : [],
    primaryCta:
      row.primaryCta && typeof row.primaryCta === "object" && !Array.isArray(row.primaryCta)
        ? (row.primaryCta as StudioPageDocument["primaryCta"])
        : { text: "", url: "" },
    conversionConfig:
      row.conversionConfig && typeof row.conversionConfig === "object" && !Array.isArray(row.conversionConfig)
        ? (row.conversionConfig as StudioPageDocument["conversionConfig"])
        : {
            trackConversions: false,
            strategy: "",
            valuePoints: 0
          },
    campaignUtmStrategy:
      row.campaignUtmStrategy && typeof row.campaignUtmStrategy === "object" && !Array.isArray(row.campaignUtmStrategy)
        ? (row.campaignUtmStrategy as StudioPageDocument["campaignUtmStrategy"])
        : {
            source: "",
            medium: "",
            campaign: ""
          },
    taxonomyState:
      row.taxonomyState && typeof row.taxonomyState === "object" && !Array.isArray(row.taxonomyState)
        ? (row.taxonomyState as StudioPageDocument["taxonomyState"])
        : {
            valid: false,
            tags: []
          },
    seoMetadata:
      row.seoMetadata && typeof row.seoMetadata === "object" && !Array.isArray(row.seoMetadata)
        ? (row.seoMetadata as StudioPageDocument["seoMetadata"])
        : {
            metaTitle: "",
            metaDescription: ""
          },
    seoJsonLdValid: Boolean(row.seoJsonLdValid),
    blockSchemaValid: Boolean(row.blockSchemaValid),
    previewValid: Boolean(row.previewValid),
    previewHtml: coerceString(row.previewHtml),
    updatedAt: coerceString(row.updatedAt, new Date().toISOString())
  });
}

async function listPagesFromStrapi(): Promise<StudioPageDocument[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(
    "/api/studio-pages?pagination[pageSize]=200&sort=updatedAt:desc"
  );
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => mapStrapiPageToStudio(unwrapStrapiEntity(row)));
}

async function upsertStudioPageInStrapi(page: StudioPageDocument): Promise<boolean> {
  try {
    const lookup = await requestStrapi<StrapiCollectionResponse>(
      `/api/studio-pages?filters[slug][$eq]=${encodeURIComponent(page.slug)}&filters[locale][$eq]=${encodeURIComponent(
        page.locale
      )}&pagination[pageSize]=1`
    );
    const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
    const existingId =
      existing && typeof existing.documentId === "string"
        ? existing.documentId
        : existing && (typeof existing.id === "number" || typeof existing.id === "string")
          ? String(existing.id)
          : undefined;

    const payload = {
      pageKey: page.id,
      name: page.name,
      slug: page.slug,
      locale: page.locale,
      status: page.status ?? "draft",
      lifecycle: page.lifecycle ?? "draft",
      activeShellId: page.activeShellId,
      shellKey: page.shellKey ?? page.activeShellId ?? "",
      blockOrder: page.blockOrder,
      fieldValues: page.fieldValues,
      actionOverrides: page.actionOverrides,
      productMapping: page.productMapping,
      industryMapping: page.industryMapping,
      primaryCta: page.primaryCta,
      conversionConfig: page.conversionConfig,
      campaignUtmStrategy: page.campaignUtmStrategy,
      taxonomyState: page.taxonomyState,
      seoMetadata: page.seoMetadata,
      seoJsonLdValid: page.seoJsonLdValid,
      blockSchemaValid: page.blockSchemaValid,
      previewValid: page.previewValid,
      previewHtml: page.previewHtml
    };

    if (existingId) {
      await requestStrapi(`/api/studio-pages/${encodeURIComponent(existingId)}`, {
        method: "PUT",
        body: payload
      });
    } else {
      await requestStrapi("/api/studio-pages", {
        method: "POST",
        body: payload
      });
    }
    return true;
  } catch {
    return false;
  }
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

async function applyPageToStrapi(page: StudioPageDocument): Promise<PageApplyResult> {
  loadProjectEnv();
  const strapiUrl = process.env.STRAPI_URL;
  const strapiToken = process.env.STRAPI_API_TOKEN;
  if (!strapiUrl || !strapiToken) {
    return {
      applied: false,
      warnings: ["Missing STRAPI_URL or STRAPI_API_TOKEN."]
    };
  }

  const importerModulePath = resolveContentImporterModulePath();
  const importerModuleUrl = pathToFileURL(importerModulePath).href;
  const contentImporter = (await import(/* webpackIgnore: true */ importerModuleUrl)) as {
    createImportPlan: (options: Record<string, unknown>) => Promise<unknown>;
    applyImportPlan: (plan: unknown, options: Record<string, unknown>) => Promise<unknown>;
  };

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "lmnas-studio-page-"));
  const htmlPath = path.join(tempDir, `${page.slug}.${page.locale}.html`);
  try {
    const html = page.previewHtml.trim().length > 0 ? page.previewHtml : "<section><h1>Untitled Page</h1></section>";
    await writeFile(htmlPath, html, "utf8");
    const plan = await contentImporter.createImportPlan({
      slug: page.slug,
      locale: page.locale,
      html: htmlPath,
      theme: "default"
    });
    await contentImporter.applyImportPlan(plan, {
      strapiUrl,
      strapiToken,
      publishState: "published",
      forceFidelity: true,
      forceReplace: true
    });
    return {
      applied: true,
      warnings: []
    };
  } catch (error) {
    return {
      applied: false,
      warnings: [error instanceof Error ? error.message : String(error)]
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function normalizeActionType(value: unknown): StudioActionType {
  if (isStudioActionType(value)) {
    return value;
  }
  return "workflow";
}

async function upsertBlockTemplateInStrapi(template: BlockTemplateUpsert): Promise<void> {
  const payload = {
    blockKey: template.key,
    templateKey: template.key,
    name: template.name,
    family: template.family,
    status: template.status,
    lifecycle: "draft",
    scope: "global",
    schemaStatus: "valid",
    themeKey: template.themeKey,
    sourceType: template.sourceType,
    sourceRef: template.sourceRef,
    confidence: template.confidence,
    editableFields: template.editableFields,
    actions: template.actions,
    previewHtml: template.previewHtml,
    usageCount: template.inUseCount,
    inUseCount: template.inUseCount
  };

  try {
    const canonicalLookup = await requestStrapi<StrapiCollectionResponse>(
      `/api/studio-blocks?filters[blockKey][$eq]=${encodeURIComponent(template.key)}&pagination[pageSize]=1`
    );
    const canonicalExisting = Array.isArray(canonicalLookup.data) ? canonicalLookup.data[0] : undefined;
    const canonicalId =
      canonicalExisting && typeof canonicalExisting.documentId === "string"
        ? canonicalExisting.documentId
        : canonicalExisting && (typeof canonicalExisting.id === "number" || typeof canonicalExisting.id === "string")
          ? String(canonicalExisting.id)
          : undefined;

    if (canonicalId !== undefined) {
      await requestStrapi(`/api/studio-blocks/${encodeURIComponent(canonicalId)}`, {
        method: "PUT",
        body: payload
      });
      return;
    }

    await requestStrapi("/api/studio-blocks", {
      method: "POST",
      body: payload
    });
  } catch {
    const legacyLookup = await requestStrapi<StrapiCollectionResponse>(
      `/api/block-templates?filters[templateKey][$eq]=${encodeURIComponent(template.key)}&pagination[pageSize]=1`
    );
    const legacyExisting = Array.isArray(legacyLookup.data) ? legacyLookup.data[0] : undefined;
    const legacyId =
      legacyExisting && typeof legacyExisting.documentId === "string"
        ? legacyExisting.documentId
        : legacyExisting && (typeof legacyExisting.id === "number" || typeof legacyExisting.id === "string")
          ? String(legacyExisting.id)
          : undefined;

    if (legacyId !== undefined) {
      await requestStrapi(`/api/block-templates/${encodeURIComponent(legacyId)}`, {
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
}

function upsertBlockTemplateInFallback(template: BlockTemplateUpsert): void {
  const store = getStudioStore();
  const blocks = [...store.blocks];
  const index = blocks.findIndex((entry) => entry.key === template.key || entry.id === template.key);
  const now = new Date().toISOString().slice(0, 10);

  const next: StudioBlockTemplate = {
    id: index >= 0 ? blocks[index].id : template.key,
    key: template.key,
    name: template.name,
    family: template.family,
    status: template.status,
    lifecycle: "draft",
    scope: "global",
    schemaStatus: "valid",
    themeKey: template.themeKey,
    sourceType: template.sourceType,
    sourceRef: template.sourceRef,
    confidence: template.confidence,
    editableFields: template.editableFields,
    actions: template.actions,
    previewHtml: template.previewHtml,
    inUseCount: index >= 0 ? blocks[index].inUseCount : template.inUseCount,
    usageCount: index >= 0 ? (blocks[index].usageCount ?? blocks[index].inUseCount) : template.inUseCount,
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

function normalizeSourceRef(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "docs/testing-artifacts/code.html";
  }
  return value.trim();
}

function extractBlockSnippets(fullHtml: string): string[] {
  const sectionMatches = fullHtml.match(/<section[\s\S]*?<\/section>/gi);
  if (Array.isArray(sectionMatches) && sectionMatches.length > 0) {
    return sectionMatches.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  }

  const mainMatches = fullHtml.match(/<main[\s\S]*?<\/main>/gi);
  if (Array.isArray(mainMatches) && mainMatches.length > 0) {
    return mainMatches.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  }

  return [`<section>${fullHtml.trim()}</section>`];
}

function inferFamily(snippet: string, index: number): string {
  const text = snippet.toLowerCase();
  if (text.includes("faq")) {
    return "faq";
  }
  if (text.includes("testimonial") || text.includes("case studies")) {
    return "testimonial_list";
  }
  if (text.includes("cta") || text.includes("contact us") || text.includes("book")) {
    return "cta_banner";
  }
  if (text.includes("hero") || (index === 0 && text.includes("<h1"))) {
    return "hero";
  }
  return "rich_text_section";
}

function inferActions(snippet: string, index: number): BlockTemplateUpsert["actions"] {
  const hrefMatch = snippet.match(/href\s*=\s*["']([^"']+)["']/i);
  if (!hrefMatch || !hrefMatch[1]) {
    return [];
  }

  return [
    {
      id: `import-action-${index + 1}`,
      label: "Imported Link",
      type: normalizeActionType("link_url"),
      target: hrefMatch[1]
    }
  ];
}

function buildImportedTemplates(payload: ImportNormalization): BlockTemplateUpsert[] {
  const snippets = extractBlockSnippets(payload.html).slice(0, 24);
  const stamp = Date.now();
  return snippets.map((snippet, index) => {
    const sequence = String(index + 1).padStart(2, "0");
    return {
      key: `page-import-${stamp}-${sequence}`,
      name: `Imported Block ${index + 1}`,
      family: inferFamily(snippet, index),
      status: "draft",
      themeKey: "default",
      sourceType: "full_page_html_ingest",
      sourceRef: payload.sourceRef,
      confidence: 0.75,
      editableFields: [],
      actions: inferActions(snippet, index),
      previewHtml: snippet,
      inUseCount: 0
    };
  });
}

function normalizeImportPayload(payload: PageSaveRequest): ImportNormalization {
  if (payload.mode !== "import-blocks") {
    throw new Error("pages.import_mode_required");
  }

  const attemptsRouteSlugGeneration =
    payload.createRouteSlug === true ||
    (typeof payload.routeSlug === "string" && payload.routeSlug.trim().length > 0) ||
    (payload.page?.slug !== undefined && typeof payload.page.slug === "string" && payload.page.slug.trim().length > 0);

  if (attemptsRouteSlugGeneration) {
    throw new Error("pages.import_slug_generation_forbidden");
  }

  const html = typeof payload.html === "string" ? payload.html.trim() : "";
  if (html.length === 0) {
    throw new Error("pages.import_html_required");
  }

  return {
    html,
    sourceRef: normalizeSourceRef(payload.sourceRef)
  };
}

async function readStrapiPageCount(): Promise<number | null> {
  try {
    const response = await requestStrapi<StrapiCollectionResponse>("/api/studio-pages?pagination[pageSize]=1");
    const total = response.meta?.pagination?.total;
    if (typeof total === "number" && Number.isFinite(total)) {
      return total;
    }
    if (Array.isArray(response.data)) {
      return response.data.length;
    }
    return null;
  } catch {
    return null;
  }
}

async function importBlocksOnly(payload: PageSaveRequest): Promise<{
  source: "strapi" | "fallback";
  imported: BlockTemplateUpsert[];
  warnings: string[];
  pageCountBefore: number | null;
  pageCountAfter: number | null;
}> {
  const normalized = normalizeImportPayload(payload);
  const imported = buildImportedTemplates(normalized);
  const warnings: string[] = [];
  const fallbackPageCount = getStudioStore().pages.length;
  const pageCountBefore = isStrapiConfigured() ? await readStrapiPageCount() : fallbackPageCount;

  if (isStrapiConfigured()) {
    try {
      for (const template of imported) {
        await upsertBlockTemplateInStrapi(template);
      }
      const pageCountAfter = await readStrapiPageCount();
      return {
        source: "strapi",
        imported,
        warnings,
        pageCountBefore,
        pageCountAfter
      };
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  for (const template of imported) {
    upsertBlockTemplateInFallback(template);
  }

  return {
    source: "fallback",
    imported,
    warnings,
    pageCountBefore,
    pageCountAfter: getStudioStore().pages.length
  };
}

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const slug = requestUrl.searchParams.get("slug");
  let pages = getStudioStore().pages;
  let source: "strapi" | "fallback" = "fallback";
  if (isStrapiConfigured()) {
    try {
      const fromStrapi = await listPagesFromStrapi();
      if (fromStrapi.length > 0) {
        pages = fromStrapi;
        source = "strapi";
      }
    } catch {
      // fall back to in-memory store
    }
  }

  if (slug) {
    const page = pages.find((entry) => entry.slug === slug);
    return Response.json({
      ok: true,
      data: page ?? null,
      source
    });
  }

  return Response.json({
    ok: true,
    data: pages,
    source
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as PageSaveRequest;

    if (payload.mode === "import-blocks") {
      const result = await importBlocksOnly(payload);
      const createdRouteSlugEntities =
        typeof result.pageCountBefore === "number" && typeof result.pageCountAfter === "number"
          ? Math.max(0, result.pageCountAfter - result.pageCountBefore)
          : 0;

      return Response.json({
        ok: true,
        data: {
          mode: "import-blocks",
          importedBlocks: result.imported.map((entry) => ({
            key: entry.key,
            name: entry.name,
            family: entry.family,
            sourceRef: entry.sourceRef
          })),
          blockCount: result.imported.length,
          pageCountBefore: result.pageCountBefore,
          pageCountAfter: result.pageCountAfter,
          routeSlugEntitiesCreated: createdRouteSlugEntities,
          warnings: result.warnings
        },
        source: result.source
      });
    }

    const page = normalizePage(payload.page ?? {});
    savePageInFallback(page);
    const previewRoute = page.slug === "home" ? `/${page.locale}` : `/${page.locale}/${page.slug}`;
    const warnings: string[] = [];
    let studioPersistedInStrapi = false;

    if (isStrapiConfigured()) {
      studioPersistedInStrapi = await upsertStudioPageInStrapi(page);
      if (!studioPersistedInStrapi) {
        warnings.push("Studio page state could not be written to canonical Strapi studio-pages.");
      }
    }

    if (payload.mode !== "apply") {
      return Response.json({
        ok: true,
        data: {
          page,
          applied: false,
          warnings,
          previewRoute
        },
        source: studioPersistedInStrapi ? "strapi" : "fallback"
      });
    }

    if (!isStrapiConfigured()) {
      return Response.json({
        ok: true,
        data: {
          page,
          applied: false,
          warnings: [...warnings, "Strapi is not configured. Page was saved in local fallback store only."],
          previewRoute
        },
        source: "fallback"
      });
    }

    const applied = await applyPageToStrapi(page);
    return Response.json({
      ok: true,
      data: {
        page,
        applied: applied.applied,
        warnings: [...warnings, ...applied.warnings],
        previewRoute
      },
      source: studioPersistedInStrapi || applied.applied ? "strapi" : "fallback"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "pages.import_slug_generation_forbidden") {
      return Response.json(
        {
          ok: false,
          code: "pages.import_slug_generation_forbidden",
          error: "Full-page HTML import may only generate block rows. Route slug creation is forbidden in import mode."
        },
        { status: 400 }
      );
    }

    if (message === "pages.import_html_required") {
      return Response.json(
        {
          ok: false,
          code: "pages.import_html_required",
          error: "Import HTML is required for mode=import-blocks."
        },
        { status: 400 }
      );
    }

    return Response.json(
      {
        ok: false,
        error: message
      },
      { status: 400 }
    );
  }
}
