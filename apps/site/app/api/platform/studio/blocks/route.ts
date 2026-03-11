import type { StudioActionType, StudioBlockTemplate, StudioPageDocument } from "../../../../platform/onboarding/_lib/studio-types";
import { isStudioActionType } from "../../../../platform/onboarding/_lib/studio-types";
import { getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured, requestStrapi, StudioApiError, unwrapStrapiEntity } from "../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type BlockWhereUsedEntry = Pick<StudioPageDocument, "id" | "slug" | "locale">;

function normalizeActionType(value: unknown): StudioActionType {
  if (isStudioActionType(value)) {
    return value;
  }
  return "workflow";
}

function normalizeTemplate(value: unknown): StudioBlockTemplate {
  const row = (value ?? {}) as Record<string, unknown>;
  const rowId =
    typeof row.id === "string" && row.id.length > 0 ? row.id : typeof row.id === "number" ? String(row.id) : undefined;
  const fallbackId = `block-${Date.now()}`;
  return {
    id: rowId ?? fallbackId,
    key: typeof row.templateKey === "string" && row.templateKey.length > 0 ? row.templateKey : rowId ?? fallbackId,
    name: typeof row.name === "string" && row.name.length > 0 ? row.name : "Block",
    family: typeof row.family === "string" && row.family.length > 0 ? row.family : "rich_text_section",
    status: row.status === "inactive" || row.status === "draft" ? row.status : "active",
    themeKey: typeof row.themeKey === "string" && row.themeKey.length > 0 ? row.themeKey : "default",
    sourceType: typeof row.sourceType === "string" && row.sourceType.length > 0 ? row.sourceType : "unknown",
    sourceRef: typeof row.sourceRef === "string" && row.sourceRef.length > 0 ? row.sourceRef : "unknown",
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    editableFields: Array.isArray(row.editableFields) ? row.editableFields.filter((field): field is string => typeof field === "string") : [],
    actions: Array.isArray(row.actions)
      ? row.actions
          .map((action, index) => {
            if (!action || typeof action !== "object" || Array.isArray(action)) {
              return null;
            }
            const record = action as Record<string, unknown>;
            return {
              id: typeof record.id === "string" ? record.id : `action-${index + 1}`,
              label: typeof record.label === "string" ? record.label : `Action ${index + 1}`,
              type: normalizeActionType(record.type),
              target: typeof record.target === "string" ? record.target : "/"
            };
          })
          .filter((action): action is StudioBlockTemplate["actions"][number] => action !== null)
      : [],
    previewHtml: typeof row.previewHtml === "string" ? row.previewHtml : "<div>No preview available</div>",
    inUseCount: typeof row.inUseCount === "number" ? row.inUseCount : 0,
    createdAt: typeof row.createdAt === "string" ? row.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
  };
}

function applyFilters(templates: StudioBlockTemplate[], url: URL): StudioBlockTemplate[] {
  const family = url.searchParams.get("family");
  const status = url.searchParams.get("status");
  const theme = url.searchParams.get("theme");
  const search = url.searchParams.get("search")?.trim().toLowerCase();
  const recentlyAdded = url.searchParams.get("recent") === "1";
  const activeInUse = url.searchParams.get("inUse") === "1";

  let next = [...templates];
  if (family) {
    next = next.filter((template) => template.family === family);
  }
  if (status) {
    next = next.filter((template) => template.status === status);
  }
  if (theme) {
    next = next.filter((template) => template.themeKey === theme);
  }
  if (search) {
    next = next.filter((template) => {
      const text = `${template.name} ${template.family} ${template.key}`.toLowerCase();
      return text.includes(search);
    });
  }
  if (activeInUse) {
    next = next.filter((template) => template.inUseCount > 0);
  }
  if (recentlyAdded) {
    next = next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  return next;
}

async function listFromStrapi(): Promise<StudioBlockTemplate[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(
    "/api/block-templates?pagination[pageSize]=200&sort=updatedAt:desc"
  );
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => normalizeTemplate(unwrapStrapiEntity(row)));
}

async function upsertInStrapi(template: StudioBlockTemplate): Promise<void> {
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

function upsertInFallback(template: StudioBlockTemplate): StudioBlockTemplate[] {
  const store = getStudioStore();
  const blocks = [...store.blocks];
  const index = blocks.findIndex((entry) => entry.id === template.id || entry.key === template.key);
  const next = {
    ...template,
    updatedAt: new Date().toISOString().slice(0, 10),
    createdAt: index >= 0 ? blocks[index].createdAt : template.createdAt
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
  return blocks;
}

function findWhereUsedPages(template: StudioBlockTemplate, pages: StudioPageDocument[]): BlockWhereUsedEntry[] {
  return pages
    .filter((page) => page.blockOrder.some((blockId) => blockId === template.id || blockId === template.key))
    .map((page) => ({
      id: page.id,
      slug: page.slug,
      locale: page.locale
    }));
}

async function deleteInStrapi(templateKey: string): Promise<void> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `/api/block-templates?filters[templateKey][$eq]=${encodeURIComponent(templateKey)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  const existingId =
    existing && typeof existing.documentId === "string"
      ? existing.documentId
      : existing && (typeof existing.id === "number" || typeof existing.id === "string")
        ? String(existing.id)
        : undefined;

  if (existingId === undefined) {
    return;
  }

  await requestStrapi(`/api/block-templates/${encodeURIComponent(existingId)}`, {
    method: "DELETE"
  });
}

function deleteInFallback(target: StudioBlockTemplate): StudioBlockTemplate[] {
  const store = getStudioStore();
  const blocks = store.blocks.filter((template) => template.id !== target.id && template.key !== target.key);
  replaceStore({
    ...store,
    blocks
  });
  return blocks;
}

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  if (isStrapiConfigured()) {
    try {
      const templates = applyFilters(await listFromStrapi(), requestUrl);
      if (templates.length > 0) {
        return Response.json({
          ok: true,
          data: templates,
          source: "strapi"
        });
      }
    } catch {
      // fallback below
    }
  }

  return Response.json({
    ok: true,
    data: applyFilters(getStudioStore().blocks, requestUrl),
    source: "fallback"
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as { block?: unknown };
    const block = normalizeTemplate(payload.block);

    if (isStrapiConfigured()) {
      try {
        await upsertInStrapi(block);
        const templates = await listFromStrapi();
        return Response.json({
          ok: true,
          data: templates,
          source: "strapi"
        });
      } catch {
        const fallbackTemplates = upsertInFallback(block);
        return Response.json({
          ok: true,
          data: fallbackTemplates,
          source: "fallback"
        });
      }
    }

    const fallbackTemplates = upsertInFallback(block);
    return Response.json({
      ok: true,
      data: fallbackTemplates,
      source: "fallback"
    });
  } catch (error) {
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
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);
    const blockId = requestUrl.searchParams.get("id")?.trim();
    const blockKey = requestUrl.searchParams.get("key")?.trim();
    if (!blockId && !blockKey) {
      return Response.json(
        {
          ok: false,
          error: "Block id or key is required."
        },
        { status: 400 }
      );
    }

    const store = getStudioStore();
    const target = store.blocks.find((template) => template.id === blockId || template.key === blockKey);
    if (!target) {
      return Response.json(
        {
          ok: false,
          error: "Block not found."
        },
        { status: 404 }
      );
    }

    const whereUsed = findWhereUsedPages(target, store.pages);
    if (whereUsed.length > 0 || target.inUseCount > 0) {
      return Response.json(
        {
          ok: false,
          error: "Block is referenced by active pages and cannot be deleted.",
          code: "blocks.where_used",
          whereUsed,
          inUseCount: target.inUseCount
        },
        { status: 409 }
      );
    }

    if (isStrapiConfigured()) {
      try {
        await deleteInStrapi(target.key);
        const templates = await listFromStrapi();
        return Response.json({
          ok: true,
          data: applyFilters(templates, requestUrl),
          source: "strapi"
        });
      } catch {
        const fallbackTemplates = deleteInFallback(target);
        return Response.json({
          ok: true,
          data: applyFilters(fallbackTemplates, requestUrl),
          source: "fallback"
        });
      }
    }

    const fallbackTemplates = deleteInFallback(target);
    return Response.json({
      ok: true,
      data: applyFilters(fallbackTemplates, requestUrl),
      source: "fallback"
    });
  } catch (error) {
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
      { status: 400 }
    );
  }
}
