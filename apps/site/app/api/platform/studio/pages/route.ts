import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { StudioActionType, StudioBlockTemplate, StudioPageDocument } from "../../../../platform/onboarding/_lib/studio-types";
import { isStudioActionType } from "../../../../platform/onboarding/_lib/studio-types";
import { loadProjectEnv } from "../../../../lib/env";
import { getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured, requestStrapi } from "../_lib/strapi";

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
  return {
    id: typeof input.id === "string" && input.id.length > 0 ? input.id : `page-${Date.now()}`,
    name: typeof input.name === "string" && input.name.length > 0 ? input.name : slug,
    slug,
    locale,
    activeShellId: typeof input.activeShellId === "string" ? input.activeShellId : undefined,
    blockOrder: Array.isArray(input.blockOrder) ? input.blockOrder.filter((value): value is string => typeof value === "string") : [],
    fieldValues:
      input.fieldValues && typeof input.fieldValues === "object" && !Array.isArray(input.fieldValues)
        ? (input.fieldValues as Record<string, string>)
        : {},
    actionOverrides:
      input.actionOverrides && typeof input.actionOverrides === "object" && !Array.isArray(input.actionOverrides)
        ? (input.actionOverrides as StudioPageDocument["actionOverrides"])
        : {},
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
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `/api/block-templates?filters[templateKey][$eq]=${encodeURIComponent(template.key)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  const existingId =
    existing && typeof existing.documentId === "string"
      ? existing.documentId
      : existing && (typeof existing.id === "number" || typeof existing.id === "string")
        ? String(existing.id)
        : undefined;

  const payload = {
    templateKey: template.key,
    name: template.name,
    family: template.family,
    status: template.status,
    themeKey: template.themeKey,
    sourceType: template.sourceType,
    sourceRef: template.sourceRef,
    confidence: template.confidence,
    editableFields: template.editableFields,
    actions: template.actions,
    previewHtml: template.previewHtml,
    inUseCount: template.inUseCount
  };

  if (existingId !== undefined) {
    await requestStrapi(`/api/block-templates/${encodeURIComponent(existingId)}`, {
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
    themeKey: template.themeKey,
    sourceType: template.sourceType,
    sourceRef: template.sourceRef,
    confidence: template.confidence,
    editableFields: template.editableFields,
    actions: template.actions,
    previewHtml: template.previewHtml,
    inUseCount: index >= 0 ? blocks[index].inUseCount : template.inUseCount,
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
    const response = await requestStrapi<StrapiCollectionResponse>("/api/pages?pagination[pageSize]=1");
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
  const pages = getStudioStore().pages;
  if (slug) {
    const page = pages.find((entry) => entry.slug === slug);
    return Response.json({
      ok: true,
      data: page ?? null,
      source: "fallback"
    });
  }

  return Response.json({
    ok: true,
    data: pages,
    source: "fallback"
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

    if (payload.mode !== "apply") {
      return Response.json({
        ok: true,
        data: {
          page,
          applied: false,
          warnings: [],
          previewRoute: page.slug === "home" ? `/${page.locale}` : `/${page.locale}/${page.slug}`
        },
        source: "fallback"
      });
    }

    if (!isStrapiConfigured()) {
      return Response.json({
        ok: true,
        data: {
          page,
          applied: false,
          warnings: ["Strapi is not configured. Page was saved in local fallback store only."],
          previewRoute: page.slug === "home" ? `/${page.locale}` : `/${page.locale}/${page.slug}`
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
        warnings: applied.warnings,
        previewRoute: page.slug === "home" ? `/${page.locale}` : `/${page.locale}/${page.slug}`
      },
      source: applied.applied ? "strapi" : "fallback"
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
