import type { StudioWidgetRecord, StudioWidgetSurface, StudioWidgetType } from "../../../../platform/onboarding/_lib/studio-types";
import { getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured, requestStrapi, unwrapStrapiEntity } from "../_lib/strapi";
import { collectWidgetStrapiProbeSnapshot } from "./_lib/strapi-probe";
import {
  isRepoWidgetPathAllowed,
  listRepoWidgetAdapters,
  resolveRepoWidgetAdapter
} from "./_lib/repo-widget-registry";

type WidgetRoutePayload = {
  widget?: unknown;
  rawScript?: unknown;
  inlineScript?: unknown;
};

type StrapiLookupResponse = {
  data?: unknown[] | Record<string, unknown> | null;
};

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

class WidgetValidationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const WIDGET_TYPES: StudioWidgetType[] = [
  "modal",
  "drawer",
  "embedded_form",
  "subscription_popup",
  "booking_popup",
  "download_gate",
  "chat_launcher",
  "inline_expand_collapse",
  "below_fold_widget"
];

const WIDGET_SURFACES: StudioWidgetSurface[] = ["modal", "drawer", "inline", "popup", "below_fold"];

function isStudioWidgetType(value: unknown): value is StudioWidgetType {
  return typeof value === "string" && WIDGET_TYPES.includes(value as StudioWidgetType);
}

function isStudioWidgetSurface(value: unknown): value is StudioWidgetSurface {
  return typeof value === "string" && WIDGET_SURFACES.includes(value as StudioWidgetSurface);
}

function containsExecutableScript(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("<script") || normalized.includes("javascript:")) {
    return true;
  }
  if (/\bfunction\b/.test(normalized) || normalized.includes("=>") || /\beval\s*\(/.test(normalized)) {
    return true;
  }
  return false;
}

function assertScriptFree(payload: WidgetRoutePayload): void {
  const widget = payload.widget;
  const widgetRow = widget && typeof widget === "object" && !Array.isArray(widget) ? (widget as Record<string, unknown>) : null;

  const dangerousValues = [
    payload.rawScript,
    payload.inlineScript,
    widgetRow?.rawScript,
    widgetRow?.inlineScript,
    widgetRow?.sourceValue,
    widgetRow?.visualMockHtml
  ];

  if (dangerousValues.some((entry) => containsExecutableScript(entry))) {
    throw new WidgetValidationError(
      "widgets.raw_script_forbidden",
      "Raw executable script uploads are forbidden. Widgets must map to approved repo paths."
    );
  }
}

function normalizePlacement(value: unknown): StudioWidgetRecord["placement"] {
  const row = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const mode = row.mode === "embed" ? "embed" : "reference";
  const pageId = typeof row.pageId === "string" && row.pageId.trim().length > 0 ? row.pageId.trim() : undefined;
  const blockId = typeof row.blockId === "string" && row.blockId.trim().length > 0 ? row.blockId.trim() : undefined;

  if (mode === "embed" && (!pageId || !blockId)) {
    throw new WidgetValidationError(
      "widgets.placement_embed_requires_page_block",
      "Embed placement requires both pageId and blockId."
    );
  }

  return {
    mode,
    ...(pageId ? { pageId } : {}),
    ...(blockId ? { blockId } : {})
  };
}

function normalizeWidget(value: unknown): StudioWidgetRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WidgetValidationError("widgets.payload_invalid", "Widget payload is required.");
  }

  const row = value as Record<string, unknown>;
  const repoPath = typeof row.repoPath === "string" ? row.repoPath.trim() : "";
  if (!repoPath.startsWith("/components/widgets/")) {
    throw new WidgetValidationError(
      "widgets.repo_path_required",
      "Widget repoPath must start with /components/widgets/."
    );
  }

  if (!isRepoWidgetPathAllowed(repoPath)) {
    throw new WidgetValidationError(
      "widgets.repo_path_not_allowed",
      "Widget repoPath is not an approved adapter path."
    );
  }

  const adapter = resolveRepoWidgetAdapter(repoPath);
  if (!adapter) {
    throw new WidgetValidationError("widgets.repo_path_not_found", "Unable to resolve widget adapter from repoPath.");
  }

  const id = typeof row.id === "string" && row.id.trim().length > 0 ? row.id.trim() : `widget-${Date.now()}`;
  const key = typeof row.key === "string" && row.key.trim().length > 0 ? row.key.trim() : id;
  const name = typeof row.name === "string" && row.name.trim().length > 0 ? row.name.trim() : adapter.displayName;
  const widgetType = isStudioWidgetType(row.widgetType) ? row.widgetType : adapter.widgetType;
  const surface = isStudioWidgetSurface(row.surface) ? row.surface : adapter.surface;
  const status = row.status === "inactive" ? "inactive" : "active";
  const lifecycle = row.lifecycle === "published" || row.lifecycle === "archived" ? row.lifecycle : "draft";
  const readiness = row.readiness === "warning" || row.readiness === "blocked" ? row.readiness : "ready";
  const description = typeof row.description === "string" && row.description.trim().length > 0 ? row.description.trim() : undefined;
  const defaultExitId = typeof row.defaultExitId === "string" && row.defaultExitId.trim().length > 0 ? row.defaultExitId.trim() : undefined;
  const editableFields = Array.isArray(row.editableFields)
    ? row.editableFields.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const visualMockHtml =
    typeof row.visualMockHtml === "string" && row.visualMockHtml.trim().length > 0 ? row.visualMockHtml.trim() : undefined;

  return {
    id,
    key,
    name,
    widgetType,
    surface,
    status,
    lifecycle,
    readiness,
    repoPath,
    ...(description ? { description } : {}),
    editableFields,
    ...(defaultExitId ? { defaultExitId } : {}),
    ...(visualMockHtml ? { visualMockHtml } : {}),
    placement: normalizePlacement(row.placement),
    updatedAt: new Date().toISOString().slice(0, 10)
  };
}

async function hasStrapiEntityReference(paths: string[]): Promise<boolean> {
  for (const path of paths) {
    try {
      const response = await requestStrapi<StrapiLookupResponse>(path);
      if (Array.isArray(response.data) && response.data.length > 0) {
        return true;
      }
      if (response.data && typeof response.data === "object" && !Array.isArray(response.data)) {
        return true;
      }
    } catch {
      // continue
    }
  }
  return false;
}

async function hasStrapiPageReference(reference: string): Promise<boolean> {
  const encoded = encodeURIComponent(reference);
  return hasStrapiEntityReference([
    `/api/studio-pages?filters[documentId][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/studio-pages?filters[id][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/studio-pages?filters[slug][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/studio-pages/${encoded}`,
    `/api/pages?filters[documentId][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/pages?filters[id][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/pages?filters[slug][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/pages/${encoded}`
  ]);
}

async function hasStrapiBlockReference(reference: string): Promise<boolean> {
  const encoded = encodeURIComponent(reference);
  return hasStrapiEntityReference([
    `/api/studio-blocks?filters[documentId][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/studio-blocks?filters[id][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/studio-blocks?filters[blockKey][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/studio-blocks/${encoded}`,
    `/api/block-templates?filters[documentId][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/block-templates?filters[id][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/block-templates?filters[templateKey][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/block-templates/${encoded}`
  ]);
}

async function assertPlacementReferences(widget: StudioWidgetRecord): Promise<void> {
  const store = getStudioStore();
  const pageId = widget.placement.pageId;
  const blockId = widget.placement.blockId;

  if (pageId) {
    let pageExists = store.pages.some((page) => page.id === pageId || page.slug === pageId);
    if (!pageExists && isStrapiConfigured()) {
      pageExists = await hasStrapiPageReference(pageId);
    }
    if (!pageExists) {
      throw new WidgetValidationError("widgets.page_not_found", `Page reference not found for id "${pageId}".`);
    }
  }

  if (blockId) {
    let blockExists = store.blocks.some((block) => block.id === blockId || block.key === blockId);
    if (!blockExists && isStrapiConfigured()) {
      blockExists = await hasStrapiBlockReference(blockId);
    }
    if (!blockExists) {
      throw new WidgetValidationError("widgets.block_not_found", `Block reference not found for id "${blockId}".`);
    }
  }
}

function mapStrapiWidgetToStudio(value: unknown): StudioWidgetRecord {
  const row = (value ?? {}) as Record<string, unknown>;
  const idCandidate = row.documentId ?? row.id;
  return normalizeWidget({
    id: typeof idCandidate === "string" || typeof idCandidate === "number" ? String(idCandidate) : undefined,
    key: typeof row.widgetKey === "string" ? row.widgetKey : row.key,
    name: row.name,
    widgetType: row.widgetType,
    surface: row.surface,
    status: row.status,
    repoPath: row.repoPath,
    description: row.description,
    editableFields: row.editableFields,
    defaultExitId: row.defaultExitId,
    visualMockHtml: row.visualMockHtml,
    placement: row.placement,
    lifecycle: row.lifecycle,
    readiness: row.readiness
  });
}

function mapStudioWidgetToStrapi(widget: StudioWidgetRecord): Record<string, unknown> {
  return {
    widgetKey: widget.key,
    name: widget.name,
    widgetType: widget.widgetType,
    surface: widget.surface,
    status: widget.status,
    lifecycle: widget.lifecycle ?? "draft",
    readiness: widget.readiness ?? "ready",
    repoPath: widget.repoPath,
    description: widget.description ?? "",
    editableFields: widget.editableFields,
    defaultExitId: widget.defaultExitId ?? "",
    visualMockHtml: widget.visualMockHtml ?? "",
    placement: widget.placement
  };
}

async function listWidgetsFromStrapi(): Promise<StudioWidgetRecord[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(
    "/api/studio-widgets?pagination[pageSize]=200&sort=updatedAt:desc"
  );
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => mapStrapiWidgetToStudio(unwrapStrapiEntity(row)));
}

async function upsertWidgetInStrapi(widget: StudioWidgetRecord): Promise<boolean> {
  try {
    const lookup = await requestStrapi<StrapiCollectionResponse>(
      `/api/studio-widgets?filters[widgetKey][$eq]=${encodeURIComponent(widget.key)}&pagination[pageSize]=1`
    );
    const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
    const existingId =
      existing && typeof existing.documentId === "string"
        ? existing.documentId
        : existing && (typeof existing.id === "number" || typeof existing.id === "string")
          ? String(existing.id)
          : undefined;
    const payload = mapStudioWidgetToStrapi(widget);

    if (existingId) {
      await requestStrapi(`/api/studio-widgets/${encodeURIComponent(existingId)}`, {
        method: "PUT",
        body: payload
      });
    } else {
      await requestStrapi("/api/studio-widgets", {
        method: "POST",
        body: payload
      });
    }
    return true;
  } catch {
    return false;
  }
}

async function deleteWidgetInStrapi(widgetIdOrKey: string): Promise<boolean> {
  try {
    const lookup = await requestStrapi<StrapiCollectionResponse>(
      `/api/studio-widgets?filters[$or][0][documentId][$eq]=${encodeURIComponent(
        widgetIdOrKey
      )}&filters[$or][1][id][$eq]=${encodeURIComponent(widgetIdOrKey)}&filters[$or][2][widgetKey][$eq]=${encodeURIComponent(
        widgetIdOrKey
      )}&pagination[pageSize]=1`
    );
    const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
    const existingId =
      existing && typeof existing.documentId === "string"
        ? existing.documentId
        : existing && (typeof existing.id === "number" || typeof existing.id === "string")
          ? String(existing.id)
          : undefined;
    if (!existingId) {
      return true;
    }
    await requestStrapi(`/api/studio-widgets/${encodeURIComponent(existingId)}`, {
      method: "DELETE"
    });
    return true;
  } catch {
    return false;
  }
}

function upsertWidget(widget: StudioWidgetRecord): StudioWidgetRecord[] {
  const store = getStudioStore();
  const widgets = [...store.widgets];
  const index = widgets.findIndex((entry) => entry.id === widget.id || entry.key === widget.key);

  if (index >= 0) {
    widgets[index] = {
      ...widgets[index],
      ...widget,
      updatedAt: new Date().toISOString().slice(0, 10)
    };
  } else {
    widgets.unshift(widget);
  }

  replaceStore({
    ...store,
    widgets
  });

  return widgets;
}

function removeWidget(widgetId: string): StudioWidgetRecord[] {
  const store = getStudioStore();
  const widgets = store.widgets.filter((widget) => widget.id !== widgetId && widget.key !== widgetId);
  replaceStore({
    ...store,
    widgets
  });
  return widgets;
}

function unchangedCoreEntities(params: {
  before: Awaited<ReturnType<typeof collectWidgetStrapiProbeSnapshot>>;
  after: Awaited<ReturnType<typeof collectWidgetStrapiProbeSnapshot>>;
}): boolean {
  return params.before.pages === params.after.pages && params.before.blocks === params.after.blocks && params.before.shells === params.after.shells;
}

export async function GET(): Promise<Response> {
  const strapiProbe = await collectWidgetStrapiProbeSnapshot();
  let widgets = getStudioStore().widgets;
  let source: "strapi" | "fallback" = "fallback";
  const warnings: string[] = [];

  if (isStrapiConfigured()) {
    try {
      const fromStrapi = await listWidgetsFromStrapi();
      if (fromStrapi.length > 0) {
        widgets = fromStrapi;
        source = "strapi";
        replaceStore({
          ...getStudioStore(),
          widgets: fromStrapi
        });
      } else {
        warnings.push("No records found in canonical studio-widgets. Falling back to local store.");
      }
    } catch (error) {
      warnings.push(`Unable to read canonical studio-widgets. Falling back to local store: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return Response.json({
    ok: true,
    data: widgets,
    catalog: listRepoWidgetAdapters().map((entry) => ({
      repoPath: entry.repoPath,
      displayName: entry.displayName,
      widgetType: entry.widgetType,
      surface: entry.surface
    })),
    source,
    strapiProbe,
    ...(warnings.length > 0 ? { warnings } : {})
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as WidgetRoutePayload;
    assertScriptFree(payload);
    const widget = normalizeWidget(payload.widget);
    await assertPlacementReferences(widget);

    const beforeProbe = await collectWidgetStrapiProbeSnapshot();
    const fallbackWidgets = upsertWidget(widget);
    let widgets = fallbackWidgets;
    let source: "strapi" | "fallback" = "fallback";
    const warnings: string[] = [];
    let persistedInStrapi = false;

    if (isStrapiConfigured()) {
      persistedInStrapi = await upsertWidgetInStrapi(widget);
      if (!persistedInStrapi) {
        warnings.push("Widget mapping could not be written to canonical Strapi studio-widgets.");
      } else {
        try {
          const fromStrapi = await listWidgetsFromStrapi();
          if (fromStrapi.length > 0) {
            widgets = fromStrapi;
            source = "strapi";
            replaceStore({
              ...getStudioStore(),
              widgets: fromStrapi
            });
          }
        } catch (error) {
          warnings.push(
            `Widget mapping saved in Strapi but refresh from canonical studio-widgets failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }

    const afterProbe = await collectWidgetStrapiProbeSnapshot();

    return Response.json({
      ok: true,
      data: widgets,
      source,
      persistence: {
        entity: "studio.widgets",
        widgetId: widget.id,
        canonicalCollection: "studio-widgets",
        persistedInStrapi
      },
      strapiAudit: {
        before: beforeProbe,
        after: afterProbe,
        unchangedCoreEntities: unchangedCoreEntities({ before: beforeProbe, after: afterProbe })
      },
      ...(warnings.length > 0 ? { warnings } : {})
    });
  } catch (error) {
    if (error instanceof WidgetValidationError) {
      return Response.json(
        {
          ok: false,
          code: error.code,
          error: error.message
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
  const requestUrl = new URL(request.url);
  const id = requestUrl.searchParams.get("id")?.trim();
  if (!id) {
    return Response.json(
      {
        ok: false,
        code: "widgets.id_required",
        error: "Widget id is required."
      },
      { status: 400 }
    );
  }

  const beforeProbe = await collectWidgetStrapiProbeSnapshot();
  const fallbackWidgets = removeWidget(id);
  let widgets = fallbackWidgets;
  let source: "strapi" | "fallback" = "fallback";
  let removedFromStrapi = false;
  const warnings: string[] = [];

  if (isStrapiConfigured()) {
    removedFromStrapi = await deleteWidgetInStrapi(id);
    if (!removedFromStrapi) {
      warnings.push("Widget removal could not be applied to canonical Strapi studio-widgets.");
    } else {
      try {
        const fromStrapi = await listWidgetsFromStrapi();
        widgets = fromStrapi;
        source = "strapi";
        replaceStore({
          ...getStudioStore(),
          widgets: fromStrapi
        });
      } catch (error) {
        warnings.push(
          `Widget removed in Strapi but canonical studio-widgets refresh failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  const afterProbe = await collectWidgetStrapiProbeSnapshot();

  return Response.json({
    ok: true,
    data: widgets,
    source,
    persistence: {
      entity: "studio.widgets",
      removedWidgetId: id,
      canonicalCollection: "studio-widgets",
      removedFromStrapi
    },
    strapiAudit: {
      before: beforeProbe,
      after: afterProbe,
      unchangedCoreEntities: unchangedCoreEntities({ before: beforeProbe, after: afterProbe })
    },
    ...(warnings.length > 0 ? { warnings } : {})
  });
}
