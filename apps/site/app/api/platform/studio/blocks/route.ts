import type { StudioActionType, StudioBlockTemplate, StudioPageDocument } from "../../../../platform/onboarding/_lib/studio-types";
import { isStudioActionType } from "../../../../platform/onboarding/_lib/studio-types";
import { getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured, requestStrapi, StudioApiError, unwrapStrapiEntity } from "../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type BlockWhereUsedEntry = Pick<StudioPageDocument, "id" | "slug" | "locale">;

type StrapiSchemaSource = "canonical" | "legacy";

const CANONICAL_BLOCK_COLLECTION = "/api/studio-blocks";
const LEGACY_BLOCK_COLLECTION = "/api/block-templates";

function normalizeActionType(value: unknown): StudioActionType {
  if (isStudioActionType(value)) {
    return value;
  }
  return "workflow";
}

function resolveEntityMutationId(value: Record<string, unknown>): string | null {
  if (typeof value.documentId === "string" && value.documentId.length > 0) {
    return value.documentId;
  }
  if (typeof value.id === "string" || typeof value.id === "number") {
    return String(value.id);
  }
  return null;
}

function normalizeTemplate(value: unknown): StudioBlockTemplate {
  const row = (value ?? {}) as Record<string, unknown>;
  const rowDocumentId = typeof row.documentId === "string" ? row.documentId : undefined;
  const rowId =
    typeof row.id === "string" && row.id.length > 0
      ? row.id
      : typeof row.id === "number"
        ? String(row.id)
        : rowDocumentId;
  const fallbackId = `block-${Date.now()}`;
  const lifecycle = row.lifecycle === "published" || row.lifecycle === "archived" ? row.lifecycle : "draft";
  const scope = row.scope === "page-local" ? "page-local" : "global";
  const schemaStatus = row.schemaStatus === "invalid" || row.schemaStatus === "warning" ? row.schemaStatus : "valid";
  const usageCount =
    typeof row.usageCount === "number" && Number.isFinite(row.usageCount)
      ? row.usageCount
      : typeof row.inUseCount === "number" && Number.isFinite(row.inUseCount)
        ? row.inUseCount
        : 0;

  return {
    id: rowId ?? fallbackId,
    key:
      typeof row.blockKey === "string" && row.blockKey.length > 0
        ? row.blockKey
        : typeof row.templateKey === "string" && row.templateKey.length > 0
          ? row.templateKey
          : typeof row.key === "string" && row.key.length > 0
            ? row.key
            : rowId ?? fallbackId,
    name: typeof row.name === "string" && row.name.length > 0 ? row.name : "Block",
    family: typeof row.family === "string" && row.family.length > 0 ? row.family : "rich_text_section",
    status: row.status === "inactive" || row.status === "draft" ? row.status : "active",
    lifecycle,
    scope,
    schemaStatus,
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
    inUseCount: usageCount,
    usageCount,
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

async function listFromCollection(collectionPath: string): Promise<StudioBlockTemplate[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(`${collectionPath}?pagination[pageSize]=200&sort=updatedAt:desc`);
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => normalizeTemplate(unwrapStrapiEntity(row)));
}

async function listFromStrapi(): Promise<{ templates: StudioBlockTemplate[]; schemaSource: StrapiSchemaSource }> {
  try {
    const templates = await listFromCollection(CANONICAL_BLOCK_COLLECTION);
    return {
      templates,
      schemaSource: "canonical"
    };
  } catch {
    const templates = await listFromCollection(LEGACY_BLOCK_COLLECTION);
    return {
      templates,
      schemaSource: "legacy"
    };
  }
}

async function upsertInCollection(
  collectionPath: string,
  keyField: string,
  template: StudioBlockTemplate,
  includeLegacyInUseField: boolean
): Promise<void> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `${collectionPath}?filters[${encodeURIComponent(keyField)}][$eq]=${encodeURIComponent(template.key)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  const existingId = existing ? resolveEntityMutationId(existing) : null;
  const usageCount = template.usageCount ?? template.inUseCount;

  const payload: Record<string, unknown> = {
    blockKey: template.key,
    templateKey: template.key,
    name: template.name,
    family: template.family,
    status: template.status,
    lifecycle: template.lifecycle ?? "draft",
    scope: template.scope ?? "global",
    schemaStatus: template.schemaStatus ?? "valid",
    themeKey: template.themeKey,
    sourceType: template.sourceType,
    sourceRef: template.sourceRef,
    confidence: template.confidence,
    editableFields: template.editableFields,
    actions: template.actions,
    previewHtml: template.previewHtml,
    usageCount
  };

  if (includeLegacyInUseField) {
    payload.inUseCount = usageCount;
  }

  if (existingId !== null) {
    await requestStrapi(`${collectionPath}/${encodeURIComponent(existingId)}`, {
      method: "PUT",
      body: payload
    });
    return;
  }

  await requestStrapi(collectionPath, {
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
    lifecycle: template.lifecycle ?? "draft",
    scope: template.scope ?? "global",
    schemaStatus: template.schemaStatus ?? "valid",
    usageCount: template.usageCount ?? template.inUseCount,
    inUseCount: template.usageCount ?? template.inUseCount,
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

async function deleteInCollection(collectionPath: string, keyField: string, templateKey: string): Promise<void> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `${collectionPath}?filters[${encodeURIComponent(keyField)}][$eq]=${encodeURIComponent(templateKey)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  const existingId = existing ? resolveEntityMutationId(existing) : null;

  if (existingId === null) {
    return;
  }

  await requestStrapi(`${collectionPath}/${encodeURIComponent(existingId)}`, {
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
      const { templates, schemaSource } = await listFromStrapi();
      if (templates.length > 0) {
        return Response.json({
          ok: true,
          data: applyFilters(templates, requestUrl),
          source: "strapi",
          schemaSource
        });
      }
    } catch {
      // fallback below
    }
  }

  return Response.json({
    ok: true,
    data: applyFilters(getStudioStore().blocks, requestUrl),
    source: "fallback",
    schemaSource: "fallback"
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as { block?: unknown };
    const block = normalizeTemplate(payload.block);

    if (isStrapiConfigured()) {
      try {
        await upsertInCollection(CANONICAL_BLOCK_COLLECTION, "blockKey", block, false);
        const templates = await listFromCollection(CANONICAL_BLOCK_COLLECTION);
        return Response.json({
          ok: true,
          data: templates,
          source: "strapi",
          schemaSource: "canonical"
        });
      } catch {
        try {
          await upsertInCollection(LEGACY_BLOCK_COLLECTION, "templateKey", block, true);
          const templates = await listFromCollection(LEGACY_BLOCK_COLLECTION);
          return Response.json({
            ok: true,
            data: templates,
            source: "strapi",
            schemaSource: "legacy",
            warning: "Block persisted via legacy collection fallback. Run schema migration to canonical studio-blocks."
          });
        } catch {
          const fallbackTemplates = upsertInFallback(block);
          return Response.json({
            ok: true,
            data: fallbackTemplates,
            source: "fallback",
            schemaSource: "fallback"
          });
        }
      }
    }

    const fallbackTemplates = upsertInFallback(block);
    return Response.json({
      ok: true,
      data: fallbackTemplates,
      source: "fallback",
      schemaSource: "fallback"
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
        await deleteInCollection(CANONICAL_BLOCK_COLLECTION, "blockKey", target.key);
        const templates = await listFromCollection(CANONICAL_BLOCK_COLLECTION);
        return Response.json({
          ok: true,
          data: applyFilters(templates, requestUrl),
          source: "strapi",
          schemaSource: "canonical"
        });
      } catch {
        try {
          await deleteInCollection(LEGACY_BLOCK_COLLECTION, "templateKey", target.key);
          const templates = await listFromCollection(LEGACY_BLOCK_COLLECTION);
          return Response.json({
            ok: true,
            data: applyFilters(templates, requestUrl),
            source: "strapi",
            schemaSource: "legacy"
          });
        } catch {
          const fallbackTemplates = deleteInFallback(target);
          return Response.json({
            ok: true,
            data: applyFilters(fallbackTemplates, requestUrl),
            source: "fallback",
            schemaSource: "fallback"
          });
        }
      }
    }

    const fallbackTemplates = deleteInFallback(target);
    return Response.json({
      ok: true,
      data: applyFilters(fallbackTemplates, requestUrl),
      source: "fallback",
      schemaSource: "fallback"
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
