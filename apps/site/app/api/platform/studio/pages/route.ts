import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { StudioPageDocument } from "../../../../platform/onboarding/_lib/studio-types";
import { loadProjectEnv } from "../../../../lib/env";
import { getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured } from "../_lib/strapi";

type PageSaveRequest = {
  page?: Partial<StudioPageDocument>;
  mode?: "save" | "apply";
};

type PageApplyResult = {
  applied: boolean;
  warnings: string[];
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
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 400 }
    );
  }
}
