import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { invalidatePageValidationOnEdit } from "../../../../platform/onboarding/_lib/page-validation";
import { evaluatePagePreviewAcceptance } from "../../../../platform/onboarding/_lib/page-validation";
import type { StudioActionType, StudioBlockTemplate, StudioPageDocument } from "../../../../platform/onboarding/_lib/studio-types";
import { isStudioActionType } from "../../../../platform/onboarding/_lib/studio-types";
import { loadProjectEnv } from "../../../../lib/env";
import { getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured, requestStrapi, StudioApiError, unwrapStrapiEntity } from "../_lib/strapi";

type PageSaveRequest = {
  page?: Partial<StudioPageDocument>;
  pageId?: unknown;
  mode?: "save" | "apply" | "preview" | "preview-accept" | "import-blocks";
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

type BlockImportDisposition = "created" | "updated";

type ImportedBlockMatch = {
  disposition: BlockImportDisposition;
  matchedBlockKey: string;
  matchedBlockId: string | null;
  nameChanged: boolean;
  previewChanged: boolean;
  publishedContentChanged: boolean;
};

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
  meta?: {
    pagination?: {
      total?: number;
    };
  };
};

type StrapiSingleResponse = {
  data?: Record<string, unknown> | null;
};

type ImportNormalization = {
  html: string;
  sourceRef: string;
};

const CANONICAL_IMPORT_MASTER_COLLECTION = "/api/studio-import-masters";

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
    publishedAt: typeof input.publishedAt === "string" ? input.publishedAt : undefined,
    publishedPreviewHtml: typeof input.publishedPreviewHtml === "string" ? input.publishedPreviewHtml : undefined,
    importMasterId: typeof input.importMasterId === "string" ? input.importMasterId : undefined,
    lifecycle: input.lifecycle ?? "draft",
    status: input.status ?? "draft",
    activeShellId: typeof input.activeShellId === "string" ? input.activeShellId : undefined,
    shellId: typeof input.shellId === "string" ? input.shellId : undefined,
    shellKey: typeof input.shellKey === "string" ? input.shellKey : undefined,
    themeId: typeof input.themeId === "string" ? input.themeId : undefined,
    themeKey: typeof input.themeKey === "string" ? input.themeKey : undefined,
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

function normalizeHtmlComparison(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim() : "";
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
  const shellRelation =
    row.shell && typeof row.shell === "object" && !Array.isArray(row.shell)
      ? (unwrapStrapiEntity(row.shell as Record<string, unknown>) as Record<string, unknown>)
      : null;
  const themeRelation =
    row.theme && typeof row.theme === "object" && !Array.isArray(row.theme)
      ? (unwrapStrapiEntity(row.theme as Record<string, unknown>) as Record<string, unknown>)
      : null;
  const importMasterRelation =
    row.importMaster && typeof row.importMaster === "object" && !Array.isArray(row.importMaster)
      ? (unwrapStrapiEntity(row.importMaster as Record<string, unknown>) as Record<string, unknown>)
      : null;
  const idCandidate = row.documentId ?? row.id;
  return normalizePage({
    id: typeof idCandidate === "string" || typeof idCandidate === "number" ? String(idCandidate) : undefined,
    name: coerceString(row.name, coerceString(row.slug, "Untitled Page")),
    slug: coerceString(row.slug, "new-page"),
    locale: coerceString(row.locale, "en"),
    publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : undefined,
    importMasterId:
      importMasterRelation && (typeof importMasterRelation.documentId === "string" || typeof importMasterRelation.id === "string")
        ? String(importMasterRelation.documentId ?? importMasterRelation.id)
        : undefined,
    activeShellId: typeof row.activeShellId === "string" ? row.activeShellId : undefined,
    shellId:
      shellRelation && (typeof shellRelation.documentId === "string" || typeof shellRelation.id === "string")
        ? String(shellRelation.documentId ?? shellRelation.id)
        : undefined,
    shellKey:
      typeof row.shellKey === "string"
        ? row.shellKey
        : shellRelation && typeof shellRelation.shellKey === "string"
          ? shellRelation.shellKey
          : undefined,
    themeId:
      themeRelation && (typeof themeRelation.documentId === "string" || typeof themeRelation.id === "string")
        ? String(themeRelation.documentId ?? themeRelation.id)
        : undefined,
    themeKey:
      typeof row.themeKey === "string"
        ? row.themeKey
        : themeRelation && typeof themeRelation.themeKey === "string"
          ? themeRelation.themeKey
          : undefined,
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
    publishedPreviewHtml: coerceString(row.publishedPreviewHtml),
    updatedAt: coerceString(row.updatedAt, new Date().toISOString())
  });
}

type PageVersionStatus = "draft" | "published";

function statusMatches(value: unknown, expected: PageVersionStatus | undefined): boolean {
  if (!expected) {
    return true;
  }
  return (value === "published" ? "published" : "draft") === expected;
}

async function listPagesFromStrapi(status?: PageVersionStatus): Promise<StudioPageDocument[]> {
  const suffix = status ? `&status=${encodeURIComponent(status)}` : "";
  const response = await requestStrapi<StrapiCollectionResponse>(
    `/api/studio-pages?pagination[pageSize]=200&sort=updatedAt:desc${suffix}&populate[theme][fields][0]=themeKey&populate[shell][fields][0]=shellKey&populate[importMaster][fields][0]=importKey`
  );
  const rows = Array.isArray(response.data) ? response.data : [];
  const filteredRows = rows.filter((row) => statusMatches(unwrapStrapiEntity(row).status, status));
  return filteredRows.map((row) => mapStrapiPageToStudio(unwrapStrapiEntity(row)));
}

async function findStudioPageInStrapi(params: {
  id?: string;
  slug: string;
  locale: string;
  status?: PageVersionStatus;
}): Promise<StudioPageDocument | null> {
  if (params.id && params.id.trim().length > 0) {
    try {
      const response = await requestStrapi<StrapiSingleResponse>(
        `/api/studio-pages/${encodeURIComponent(params.id)}?populate[theme][fields][0]=themeKey&populate[shell][fields][0]=shellKey&populate[importMaster][fields][0]=importKey${
          params.status ? `&status=${encodeURIComponent(params.status)}` : ""
        }`
      );
      if (response.data && typeof response.data === "object" && !Array.isArray(response.data)) {
        return mapStrapiPageToStudio(unwrapStrapiEntity(response.data));
      }
    } catch {
      // fall through to collection lookup
    }

    try {
      const pageKeyLookup = await requestStrapi<StrapiCollectionResponse>(
        `/api/studio-pages?filters[pageKey][$eq]=${encodeURIComponent(
          params.id
        )}&pagination[pageSize]=1&sort=updatedAt:desc${params.status ? `&status=${encodeURIComponent(params.status)}` : ""}&populate[theme][fields][0]=themeKey&populate[shell][fields][0]=shellKey&populate[importMaster][fields][0]=importKey`
      );
      const row = Array.isArray(pageKeyLookup.data) ? pageKeyLookup.data[0] : undefined;
      if (row) {
        return mapStrapiPageToStudio(unwrapStrapiEntity(row));
      }
    } catch {
      // fall through to slug lookup
    }
  }

  const suffix = params.status ? `&status=${encodeURIComponent(params.status)}` : "";
  const response = await requestStrapi<StrapiCollectionResponse>(
    `/api/studio-pages?filters[slug][$eq]=${encodeURIComponent(
      params.slug
    )}&pagination[pageSize]=20&sort=updatedAt:desc${suffix}&populate[theme][fields][0]=themeKey&populate[shell][fields][0]=shellKey&populate[importMaster][fields][0]=importKey`
  );
  const filteredRows = Array.isArray(response.data)
    ? response.data.filter((entry) => statusMatches(unwrapStrapiEntity(entry).status, params.status))
    : [];
  const row = filteredRows.length > 0
    ? filteredRows.find((entry) => {
        const candidate = unwrapStrapiEntity(entry) as Record<string, unknown>;
        return typeof candidate.locale === "string" ? candidate.locale === params.locale : true;
      }) ?? filteredRows[0]
    : undefined;
  if (!row) {
    return null;
  }
  return mapStrapiPageToStudio(unwrapStrapiEntity(row));
}

async function acceptStudioPagePreviewInStrapi(pageId: string): Promise<{
  page: StudioPageDocument;
  evaluation: ReturnType<typeof evaluatePagePreviewAcceptance>;
}> {
  const page = await findStudioPageInStrapi({
    id: pageId,
    slug: "",
    locale: "en",
    status: "draft"
  });

  if (!page) {
    throw new StudioApiError({
      status: 404,
      operatorMessage: "Draft page not found for preview acceptance.",
      developerMessage: "pages.preview_accept.page_not_found"
    });
  }

  const evaluation = evaluatePagePreviewAcceptance(page);
  if (!evaluation.previewValid) {
    throw new StudioApiError({
      status: 400,
      operatorMessage: evaluation.previewIssues.join(" "),
      developerMessage: "pages.preview_accept.preview_invalid"
    });
  }

  await requestStrapi(`/api/studio-pages/${encodeURIComponent(page.id)}?status=draft`, {
    method: "PUT",
    body: {
      previewValid: true,
      seoJsonLdValid: evaluation.seoJsonLdValid
    }
  });

  const refreshed =
    (await findStudioPageInStrapi({
      id: page.id,
      slug: page.slug,
      locale: page.locale,
      status: "draft"
    })) ??
    ({
      ...page,
      previewValid: true,
      seoJsonLdValid: evaluation.seoJsonLdValid
    } satisfies StudioPageDocument);

  return {
    page: refreshed,
    evaluation
  };
}

function resolvePreviewSecret(): string {
  return process.env.PREVIEW_SECRET ?? process.env.STRAPI_PREVIEW_TOKEN ?? "local-preview-token";
}

function buildStudioPreviewRoute(page: StudioPageDocument): string {
  const previewTarget = `/platform/onboarding/pages/preview?pageId=${encodeURIComponent(page.id)}&previewStatus=draft`;
  return `/api/preview?path=${encodeURIComponent(previewTarget)}&token=${encodeURIComponent(resolvePreviewSecret())}`;
}

async function lookupRelationDocumentId(params: {
  collectionPath: string;
  keyField: string;
  keyValue: string | undefined;
}): Promise<string | undefined> {
  const keyValue = params.keyValue?.trim();
  if (!keyValue) {
    return undefined;
  }

  const response = await requestStrapi<StrapiCollectionResponse>(
    `${params.collectionPath}?filters[${encodeURIComponent(params.keyField)}][$eq]=${encodeURIComponent(keyValue)}&pagination[pageSize]=1`
  );
  const row = Array.isArray(response.data) ? response.data[0] : undefined;
  if (!row) {
    return undefined;
  }

  if (typeof row.documentId === "string" && row.documentId.length > 0) {
    return row.documentId;
  }
  if (typeof row.id === "string" || typeof row.id === "number") {
    return String(row.id);
  }
  return undefined;
}

async function canonicalizeBlockOrderInStrapi(blockOrder: string[]): Promise<string[]> {
  if (blockOrder.length === 0) {
    return blockOrder;
  }

  const response = await requestStrapi<StrapiCollectionResponse>("/api/studio-blocks?pagination[pageSize]=200&sort=updatedAt:desc");
  const rows = Array.isArray(response.data) ? response.data : [];
  const keyByReference = new Map<string, string>();

  rows.forEach((row) => {
    const entity = unwrapStrapiEntity(row);
    const blockKey = typeof entity.blockKey === "string" ? entity.blockKey : typeof entity.key === "string" ? entity.key : null;
    if (!blockKey || blockKey.trim().length === 0) {
      return;
    }
    const references = [entity.documentId, entity.id, entity.blockKey, entity.key]
      .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
      .map((value) => String(value));
    references.forEach((reference) => keyByReference.set(reference, blockKey));
  });

  return blockOrder.map((entry) => keyByReference.get(entry) ?? entry);
}

function canonicalizeBlockOrderInFallback(blockOrder: string[]): string[] {
  if (blockOrder.length === 0) {
    return blockOrder;
  }

  const keyByReference = new Map<string, string>();
  getStudioStore().blocks.forEach((block) => {
    [block.id, block.key].forEach((reference) => keyByReference.set(reference, block.key));
  });

  return blockOrder.map((entry) => keyByReference.get(entry) ?? entry);
}

async function updateImportMasterStatus(importMasterId: string | undefined, status: "imported_blocks" | "imported_page"): Promise<void> {
  if (!importMasterId || importMasterId.trim().length === 0) {
    return;
  }
  await requestStrapi(`${CANONICAL_IMPORT_MASTER_COLLECTION}/${encodeURIComponent(importMasterId)}`, {
    method: "PUT",
    body: {
      status
    }
  });
}

async function upsertStudioPageInStrapi(page: StudioPageDocument): Promise<void> {
  const existingPage = await findStudioPageInStrapi({
    id: page.id,
    slug: page.slug,
    locale: page.locale,
    status: "draft"
  });
  const existingId = existingPage?.id;
  const persistedPage = existingPage ? invalidatePageValidationOnEdit(existingPage, page) : page;

  const [themeId, shellId, importMasterId] = await Promise.all([
    lookupRelationDocumentId({
      collectionPath: "/api/studio-themes",
      keyField: "themeKey",
      keyValue: page.themeKey
    }),
    lookupRelationDocumentId({
      collectionPath: "/api/studio-shells",
      keyField: "shellKey",
      keyValue: page.shellKey ?? page.activeShellId
    }),
    Promise.resolve(typeof page.importMasterId === "string" && page.importMasterId.trim().length > 0 ? page.importMasterId.trim() : undefined)
  ]);

  const payload = {
    pageKey: persistedPage.id,
    name: persistedPage.name,
    slug: persistedPage.slug,
    locale: persistedPage.locale,
    status: persistedPage.status ?? "draft",
    lifecycle: persistedPage.lifecycle ?? "draft",
    activeShellId: persistedPage.activeShellId,
    shellKey: persistedPage.shellKey ?? persistedPage.activeShellId ?? "",
    shell: shellId,
    themeKey: persistedPage.themeKey ?? "",
    theme: themeId,
    importMaster: importMasterId,
    blockOrder: persistedPage.blockOrder,
    fieldValues: persistedPage.fieldValues,
    actionOverrides: persistedPage.actionOverrides,
    productMapping: persistedPage.productMapping,
    industryMapping: persistedPage.industryMapping,
    primaryCta: persistedPage.primaryCta,
    conversionConfig: persistedPage.conversionConfig,
    campaignUtmStrategy: persistedPage.campaignUtmStrategy,
    taxonomyState: persistedPage.taxonomyState,
    seoMetadata: persistedPage.seoMetadata,
    seoJsonLdValid: persistedPage.seoJsonLdValid,
    blockSchemaValid: persistedPage.blockSchemaValid,
    previewValid: persistedPage.previewValid,
    previewHtml: persistedPage.previewHtml,
    publishedPreviewHtml: persistedPage.publishedPreviewHtml ?? ""
  };

  if (existingId) {
    await requestStrapi(`/api/studio-pages/${encodeURIComponent(existingId)}?status=draft`, {
      method: "PUT",
      body: payload
    });
  } else {
    await requestStrapi("/api/studio-pages?status=draft", {
      method: "POST",
      body: payload
    });
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
      theme: page.themeKey && page.themeKey.trim().length > 0 ? page.themeKey : "default"
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

async function publishStudioPageDocument(pageId: string): Promise<void> {
  const draftPage = await findStudioPageInStrapi({
    id: pageId,
    slug: "",
    locale: "en",
    status: "draft"
  }).catch(() => null);
  const publishedAt = new Date().toISOString();
  const restoreDraftPayload = draftPage
    ? {
        pageKey: draftPage.id,
        name: draftPage.name,
        slug: draftPage.slug,
        locale: draftPage.locale,
        status: "draft",
        lifecycle: "draft",
        activeShellId: draftPage.activeShellId,
        shellKey: draftPage.shellKey ?? draftPage.activeShellId ?? "",
        themeKey: draftPage.themeKey ?? "",
        blockOrder: draftPage.blockOrder,
        fieldValues: draftPage.fieldValues,
        actionOverrides: draftPage.actionOverrides,
        productMapping: draftPage.productMapping,
        industryMapping: draftPage.industryMapping,
        primaryCta: draftPage.primaryCta,
        conversionConfig: draftPage.conversionConfig,
        campaignUtmStrategy: draftPage.campaignUtmStrategy,
        taxonomyState: draftPage.taxonomyState,
        seoMetadata: draftPage.seoMetadata,
        seoJsonLdValid: draftPage.seoJsonLdValid,
        blockSchemaValid: draftPage.blockSchemaValid,
        previewValid: draftPage.previewValid,
        previewHtml: draftPage.previewHtml,
        publishedPreviewHtml: draftPage.previewHtml,
        publishedAt
      }
    : null;
  const publishedPayload = draftPage
    ? {
        ...restoreDraftPayload,
        status: "published",
        lifecycle: "published"
      }
    : {
        status: "published",
        lifecycle: "published",
        publishedAt
      };
  const publishEndpoints = [
    `/api/studio-pages/${encodeURIComponent(pageId)}/actions/publish`,
    `/api/studio-pages/${encodeURIComponent(pageId)}/publish`
  ];

  for (const endpoint of publishEndpoints) {
    try {
      await requestStrapi(endpoint, {
        method: "POST",
        body: {}
      });
      if (restoreDraftPayload) {
        await requestStrapi(`/api/studio-pages/${encodeURIComponent(pageId)}?status=draft`, {
          method: "PUT",
          body: restoreDraftPayload
        });
        await requestStrapi(`/api/studio-pages/${encodeURIComponent(pageId)}?status=published`, {
          method: "PUT",
          body: publishedPayload
        });
      }
      return;
    } catch {
      // try next endpoint
    }
  }

  await requestStrapi(`/api/studio-pages/${encodeURIComponent(pageId)}`, {
    method: "PUT",
    body: publishedPayload
  });
  if (restoreDraftPayload) {
    await requestStrapi(`/api/studio-pages/${encodeURIComponent(pageId)}?status=draft`, {
      method: "PUT",
      body: restoreDraftPayload
    });
  }
}

function normalizeActionType(value: unknown): StudioActionType {
  if (isStudioActionType(value)) {
    return value;
  }
  return "workflow";
}

async function upsertBlockTemplateInStrapi(template: BlockTemplateUpsert): Promise<ImportedBlockMatch> {
  const canonicalLookup = await requestStrapi<StrapiCollectionResponse>(
    `/api/studio-blocks?filters[blockKey][$eq]=${encodeURIComponent(template.key)}&pagination[pageSize]=1`
  );
  const canonicalExisting = Array.isArray(canonicalLookup.data) ? canonicalLookup.data[0] : undefined;
  const canonicalExistingEntity = canonicalExisting ? unwrapStrapiEntity(canonicalExisting) : undefined;
  const canonicalId =
    canonicalExisting && typeof canonicalExisting.documentId === "string"
      ? canonicalExisting.documentId
      : canonicalExisting && (typeof canonicalExisting.id === "number" || typeof canonicalExisting.id === "string")
        ? String(canonicalExisting.id)
        : undefined;

  const payload = {
    blockKey: template.key,
    name: template.name,
    family: template.family,
    status: template.status,
    lifecycle: "draft",
    scope: "global",
    schemaStatus: "valid",
    themeKey: template.themeKey,
    sourceType: template.sourceType,
    sourceRef: template.sourceRef,
    sourcePreviewHtml: template.previewHtml,
    targetPreviewHtml: template.previewHtml,
    confidence: template.confidence,
    editableFields: template.editableFields,
    actions: template.actions,
    previewHtml: template.previewHtml,
    usageCount: template.inUseCount
  };
  const matchResult: ImportedBlockMatch = {
    disposition: canonicalId !== undefined ? "updated" : "created",
    matchedBlockKey: template.key,
    matchedBlockId: canonicalId ?? null,
    nameChanged: canonicalId !== undefined ? String(canonicalExistingEntity?.name ?? "").trim() !== template.name.trim() : false,
    previewChanged:
      canonicalId !== undefined
        ? normalizeHtmlComparison(canonicalExistingEntity?.previewHtml) !== normalizeHtmlComparison(template.previewHtml)
        : true,
    publishedContentChanged:
      canonicalId !== undefined
        ? normalizeHtmlComparison(canonicalExistingEntity?.targetPreviewHtml ?? canonicalExistingEntity?.previewHtml) !==
          normalizeHtmlComparison(template.previewHtml)
        : true
  };

  if (canonicalId !== undefined) {
    await requestStrapi(`/api/studio-blocks/${encodeURIComponent(canonicalId)}`, {
      method: "PUT",
      body: payload
    });
    return matchResult;
  }

  const created = await requestStrapi<{
    data?: Record<string, unknown>;
  }>("/api/studio-blocks", {
    method: "POST",
    body: payload
  });
  const createdEntity = created.data ? unwrapStrapiEntity(created.data) : null;
  return {
    ...matchResult,
    matchedBlockId:
      createdEntity && (typeof createdEntity.documentId === "string" || typeof createdEntity.id === "string" || typeof createdEntity.id === "number")
        ? String(createdEntity.documentId ?? createdEntity.id)
        : matchResult.matchedBlockId
  };
}

function upsertBlockTemplateInFallback(template: BlockTemplateUpsert): ImportedBlockMatch {
  const store = getStudioStore();
  const blocks = [...store.blocks];
  const index = blocks.findIndex((entry) => entry.key === template.key || entry.id === template.key);
  const existing = index >= 0 ? blocks[index] : null;
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
  return {
    disposition: index >= 0 ? "updated" : "created",
    matchedBlockKey: template.key,
    matchedBlockId: existing?.id ?? template.key,
    nameChanged: existing ? existing.name.trim() !== template.name.trim() : false,
    previewChanged: existing ? normalizeHtmlComparison(existing.previewHtml) !== normalizeHtmlComparison(template.previewHtml) : true,
    publishedContentChanged:
      existing ? normalizeHtmlComparison(existing.previewHtml) !== normalizeHtmlComparison(template.previewHtml) : true
  };
}

function normalizeSourceRef(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "docs/testing-artifacts/code.html";
  }
  return value.trim();
}

function normalizeImportedBlockName(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeSnippetIdentity(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeImportedKeyPrefix(sourceRef: string): string {
  const value = sourceRef
    .split("/")
    .pop()
    ?.replace(/\.[a-z0-9]+$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return value && value.length > 0 ? value : "page-import";
}

function createImportedBlockKey(sourceRef: string, snippet: string, index: number): string {
  const digest = createHash("sha1")
    .update(sourceRef)
    .update("::")
    .update(normalizeSnippetIdentity(snippet))
    .update("::")
    .update(String(index))
    .digest("hex")
    .slice(0, 12);
  const sequence = String(index + 1).padStart(2, "0");
  return `${normalizeImportedKeyPrefix(sourceRef)}-${digest}-${sequence}`;
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
  return snippets.map((snippet, index) => {
    return {
      key: createImportedBlockKey(payload.sourceRef, snippet, index),
      name: normalizeImportedBlockName(undefined, `Imported Block ${index + 1}`),
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
  imported: Array<BlockTemplateUpsert & ImportedBlockMatch>;
  warnings: string[];
  createdCount: number;
  updatedCount: number;
  pageCountBefore: number | null;
  pageCountAfter: number | null;
}> {
  const normalized = normalizeImportPayload(payload);
  const imported = buildImportedTemplates(normalized);
  const warnings: string[] = [];
  const pageCountBefore = isStrapiConfigured() ? await readStrapiPageCount() : getStudioStore().pages.length;

  if (isStrapiConfigured()) {
    try {
      const persisted: Array<BlockTemplateUpsert & ImportedBlockMatch> = [];
      for (const template of imported) {
        const match = await upsertBlockTemplateInStrapi(template);
        persisted.push({
          ...template,
          ...match
        });
      }
      const pageCountAfter = await readStrapiPageCount();
      const createdCount = persisted.filter((entry) => entry.disposition === "created").length;
      return {
        source: "strapi",
        imported: persisted,
        warnings,
        createdCount,
        updatedCount: persisted.length - createdCount,
        pageCountBefore,
        pageCountAfter
      };
    } catch (error) {
      throw new Error(`Canonical studio-block import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const persisted: Array<BlockTemplateUpsert & ImportedBlockMatch> = [];
  for (const template of imported) {
    const match = upsertBlockTemplateInFallback(template);
    persisted.push({
      ...template,
      ...match
    });
  }
  const createdCount = persisted.filter((entry) => entry.disposition === "created").length;

  return {
    source: "fallback",
    imported: persisted,
    warnings,
    createdCount,
    updatedCount: persisted.length - createdCount,
    pageCountBefore,
    pageCountAfter: getStudioStore().pages.length
  };
}

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const slug = requestUrl.searchParams.get("slug");
  const id = requestUrl.searchParams.get("id");
  const requestedStatus = requestUrl.searchParams.get("status");
  const status: PageVersionStatus | undefined =
    requestedStatus === "draft" || requestedStatus === "published" ? requestedStatus : undefined;
  let pages: StudioPageDocument[] = [];
  let source: "strapi" | "fallback" = "fallback";
  if (isStrapiConfigured()) {
    try {
      if (id) {
        const page = await findStudioPageInStrapi({
          id,
          slug: slug ?? "",
          locale: "en",
          status
        });
        return Response.json({
          ok: true,
          data: page ?? null,
          source: "strapi"
        });
      }
      const fromStrapi = await listPagesFromStrapi(status);
      pages = fromStrapi;
      source = "strapi";
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error: "Canonical studio pages could not be read from Strapi.",
          developerError: error instanceof Error ? error.message : String(error)
        },
        { status: 502 }
      );
    }
  }

  if (source === "fallback" && status) {
    pages = getStudioStore().pages;
    pages = pages.filter((entry) => (status === "published" ? entry.status === "published" : entry.status !== "published"));
  } else if (source === "fallback") {
    pages = getStudioStore().pages;
  }

  if (slug || id) {
    const page = pages.find((entry) => (id ? entry.id === id : false) || (slug ? entry.slug === slug : false));
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
            sourceRef: entry.sourceRef,
            disposition: entry.disposition,
            matchedBlockKey: entry.matchedBlockKey,
            matchedBlockId: entry.matchedBlockId,
            nameChanged: entry.nameChanged,
            previewChanged: entry.previewChanged,
            publishedContentChanged: entry.publishedContentChanged
          })),
          blockCount: result.imported.length,
          createdCount: result.createdCount,
          updatedCount: result.updatedCount,
          pageCountBefore: result.pageCountBefore,
          pageCountAfter: result.pageCountAfter,
          routeSlugEntitiesCreated: createdRouteSlugEntities,
          warnings: result.warnings
        },
        source: result.source
      });
    }

    if (payload.mode === "preview-accept") {
      if (!isStrapiConfigured()) {
        return Response.json(
          {
            ok: false,
            error: "Canonical preview acceptance requires Strapi configuration."
          },
          { status: 503 }
        );
      }

      const requestedPageId =
        typeof payload.pageId === "string" && payload.pageId.trim().length > 0
          ? payload.pageId.trim()
          : typeof payload.page?.id === "string" && payload.page.id.trim().length > 0
            ? payload.page.id.trim()
            : null;

      if (!requestedPageId) {
        return Response.json(
          {
            ok: false,
            error: "Page id is required for preview acceptance."
          },
          { status: 400 }
        );
      }

      try {
        const accepted = await acceptStudioPagePreviewInStrapi(requestedPageId);
        return Response.json({
          ok: true,
          data: {
            page: accepted.page,
            evaluation: accepted.evaluation
          },
          source: "strapi"
        });
      } catch (error: unknown) {
        if (error instanceof StudioApiError) {
          return Response.json(
            {
              ok: false,
              error: error.operatorMessage,
              developerError: error.developerMessage
            },
            { status: error.status }
          );
        }
        return Response.json(
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          },
          { status: 502 }
        );
      }
    }

    const normalizedPage = normalizePage(payload.page ?? {});
    const page = isStrapiConfigured()
      ? {
          ...normalizedPage,
          blockOrder: await canonicalizeBlockOrderInStrapi(normalizedPage.blockOrder)
        }
      : {
          ...normalizedPage,
          blockOrder: canonicalizeBlockOrderInFallback(normalizedPage.blockOrder)
        };
    const previewRoute = page.slug === "home" ? `/${page.locale}` : `/${page.locale}/${page.slug}`;
    const warnings: string[] = [];
    if (!isStrapiConfigured()) {
      const persistedPage = normalizePage(savePageInFallback(page).find((candidate) => candidate.id === page.id) ?? page);
      return Response.json({
        ok: true,
        data: {
          page: persistedPage,
          applied: false,
          warnings,
          previewRoute
        },
        source: "fallback"
      });
    }

    let persistedPage = page;
    try {
      await upsertStudioPageInStrapi(page);
      const resolvedPage = await findStudioPageInStrapi({
        slug: page.slug,
        locale: page.locale,
        status: "draft"
      });
      if (resolvedPage) {
        persistedPage = resolvedPage;
      }
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error: `Canonical studio-page persistence failed: ${error instanceof Error ? error.message : String(error)}`
        },
        { status: 502 }
      );
    }

    try {
      await updateImportMasterStatus(page.importMasterId, "imported_page");
    } catch {
      warnings.push("Import master status update failed after page save.");
    }

    if (payload.mode === "preview") {
      return Response.json({
        ok: true,
        data: {
          page: persistedPage,
          applied: false,
          warnings,
          previewRoute: buildStudioPreviewRoute(persistedPage)
        },
        source: "strapi"
      });
    }

    if (payload.mode !== "apply") {
      return Response.json({
        ok: true,
        data: {
          page: persistedPage,
          applied: false,
          warnings,
          previewRoute
        },
        source: "strapi"
      });
    }

    try {
      await publishStudioPageDocument(persistedPage.id);
    } catch (publishError) {
      return Response.json(
        {
          ok: false,
          error: `Canonical studio-page publish failed: ${publishError instanceof Error ? publishError.message : String(publishError)}`
        },
        { status: 502 }
      );
    }

    const applied = await applyPageToStrapi(page);
    return Response.json({
      ok: true,
      data: {
        page: persistedPage,
        applied: applied.applied,
        warnings: [...warnings, ...applied.warnings],
        previewRoute
      },
      source: "strapi"
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

export async function DELETE(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const id = requestUrl.searchParams.get("id")?.trim();
  const slug = requestUrl.searchParams.get("slug")?.trim();
  const locale = requestUrl.searchParams.get("locale")?.trim() ?? "en";

  if (!id && !slug) {
    return Response.json(
      {
        ok: false,
        error: "Page id or slug is required for delete."
      },
      { status: 400 }
    );
  }

  if (!isStrapiConfigured()) {
    return Response.json(
      {
        ok: false,
        error: "Canonical studio-page delete requires Strapi configuration."
      },
      { status: 503 }
    );
  }

  try {
    let targetId = id;
    if (!targetId && slug) {
      const resolved = await findStudioPageInStrapi({
        slug,
        locale
      });
      targetId = resolved?.id;
    }

    if (!targetId) {
      return Response.json(
        {
          ok: false,
          error: "Page not found in canonical Strapi."
        },
        { status: 404 }
      );
    }

    await requestStrapi(`/api/studio-pages/${encodeURIComponent(targetId)}`, {
      method: "DELETE"
    });

    return Response.json({
      ok: true,
      data: {
        id: targetId
      },
      source: "strapi"
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: `Canonical studio-page delete failed: ${error instanceof Error ? error.message : String(error)}`
      },
      { status: 502 }
    );
  }
}
