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
    `/api/studio-pages/${encoded}`
  ]);
}

async function hasStrapiBlockReference(reference: string): Promise<boolean> {
  const encoded = encodeURIComponent(reference);
  return hasStrapiEntityReference([
    `/api/studio-blocks?filters[documentId][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/studio-blocks?filters[id][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/studio-blocks?filters[blockKey][$eq]=${encoded}&pagination[pageSize]=1`,
    `/api/studio-blocks/${encoded}`
  ]);
}

async function assertPlacementReferences(widget: StudioWidgetRecord): Promise<void> {
  const pageId = widget.placement.pageId;
  const blockId = widget.placement.blockId;

  if (pageId) {
    const pageExists = isStrapiConfigured()
      ? await hasStrapiPageReference(pageId)
      : getStudioStore().pages.some((page) => page.id === pageId || page.slug === pageId);
    if (!pageExists) {
      throw new WidgetValidationError("widgets.page_not_found", `Page reference not found for id "${pageId}".`);
    }
  }

  if (blockId) {
    const blockExists = isStrapiConfigured()
      ? await hasStrapiBlockReference(blockId)
      : getStudioStore().blocks.some((block) => block.id === blockId || block.key === blockId);
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

async function upsertWidgetInStrapi(widget: StudioWidgetRecord): Promise<void> {
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
    return;
  }

  await requestStrapi("/api/studio-widgets", {
    method: "POST",
    body: payload
  });
}

async function deleteWidgetInStrapi(widgetIdOrKey: string): Promise<void> {
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
    return;
  }

  await requestStrapi(`/api/studio-widgets/${encodeURIComponent(existingId)}`, {
    method: "DELETE"
  });
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

  if (isStrapiConfigured()) {
    try {
      const widgets = await listWidgetsFromStrapi();
      return Response.json({
        ok: true,
        data: widgets,
        catalog: listRepoWidgetAdapters().map((entry) => ({
          repoPath: entry.repoPath,
          displayName: entry.displayName,
          widgetType: entry.widgetType,
          surface: entry.surface
        })),
        source: "strapi",
        strapiProbe
      });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error: "Canonical studio widgets could not be read from Strapi.",
          developerError: error instanceof Error ? error.message : String(error),
          strapiProbe
        },
        { status: 502 }
      );
    }
  }

  return Response.json({
    ok: true,
    data: getStudioStore().widgets,
    catalog: listRepoWidgetAdapters().map((entry) => ({
      repoPath: entry.repoPath,
      displayName: entry.displayName,
      widgetType: entry.widgetType,
      surface: entry.surface
    })),
    source: "fallback",
    strapiProbe
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as WidgetRoutePayload;
    assertScriptFree(payload);
    const widget = normalizeWidget(payload.widget);
    await assertPlacementReferences(widget);

    const beforeProbe = await collectWidgetStrapiProbeSnapshot();

    if (isStrapiConfigured()) {
      await upsertWidgetInStrapi(widget);
      const widgets = await listWidgetsFromStrapi();
      const afterProbe = await collectWidgetStrapiProbeSnapshot();

      return Response.json({
        ok: true,
        data: widgets,
        source: "strapi",
        persistence: {
          entity: "studio.widgets",
          widgetId: widget.id,
          canonicalCollection: "studio-widgets",
          persistedInStrapi: true
        },
        strapiAudit: {
          before: beforeProbe,
          after: afterProbe,
          unchangedCoreEntities: unchangedCoreEntities({ before: beforeProbe, after: afterProbe })
        }
      });
    }

    const widgets = upsertWidget(widget);
    const afterProbe = await collectWidgetStrapiProbeSnapshot();

    return Response.json({
      ok: true,
      data: widgets,
      source: "fallback",
      persistence: {
        entity: "studio.widgets",
        widgetId: widget.id,
        canonicalCollection: "studio-widgets",
        persistedInStrapi: false
      },
      strapiAudit: {
        before: beforeProbe,
        after: afterProbe,
        unchangedCoreEntities: unchangedCoreEntities({ before: beforeProbe, after: afterProbe })
      }
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

    if (isStrapiConfigured()) {
      return Response.json(
        {
          ok: false,
          error: "Canonical studio widgets could not be persisted to Strapi.",
          developerError: error instanceof Error ? error.message : String(error)
        },
        { status: 502 }
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

  if (isStrapiConfigured()) {
    try {
      await deleteWidgetInStrapi(id);
      const widgets = await listWidgetsFromStrapi();
      const afterProbe = await collectWidgetStrapiProbeSnapshot();

      return Response.json({
        ok: true,
        data: widgets,
        source: "strapi",
        persistence: {
          entity: "studio.widgets",
          removedWidgetId: id,
          canonicalCollection: "studio-widgets",
          removedFromStrapi: true
        },
        strapiAudit: {
          before: beforeProbe,
          after: afterProbe,
          unchangedCoreEntities: unchangedCoreEntities({ before: beforeProbe, after: afterProbe })
        }
      });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error: "Canonical studio widgets could not be deleted from Strapi.",
          developerError: error instanceof Error ? error.message : String(error)
        },
        { status: 502 }
      );
    }
  }

  const widgets = removeWidget(id);
  const afterProbe = await collectWidgetStrapiProbeSnapshot();

  return Response.json({
    ok: true,
    data: widgets,
    source: "fallback",
    persistence: {
      entity: "studio.widgets",
      removedWidgetId: id,
      canonicalCollection: "studio-widgets",
      removedFromStrapi: false
    },
    strapiAudit: {
      before: beforeProbe,
      after: afterProbe,
      unchangedCoreEntities: unchangedCoreEntities({ before: beforeProbe, after: afterProbe })
    }
  });
}
