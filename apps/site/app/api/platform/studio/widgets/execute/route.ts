import type { StudioWidgetRecord } from "../../../../../platform/onboarding/_lib/studio-types";
import { getStudioStore, replaceStore } from "../../_lib/store";
import { isStrapiConfigured, requestStrapi, unwrapStrapiEntity } from "../../_lib/strapi";
import { collectWidgetStrapiProbeSnapshot } from "../_lib/strapi-probe";
import { resolveRepoWidgetAdapter } from "../_lib/repo-widget-registry";

type ExecuteWidgetPayload = {
  widgetId?: unknown;
  event?: unknown;
  payload?: unknown;
};

type StrapiLookupResponse = {
  data?: unknown[] | Record<string, unknown> | null;
};

class WidgetExecutionError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizePlacement(value: unknown): StudioWidgetRecord["placement"] {
  const row = asObject(value);
  const mode = row.mode === "embed" ? "embed" : "reference";
  const pageId = asString(row.pageId).trim();
  const blockId = asString(row.blockId).trim();

  return {
    mode,
    ...(pageId ? { pageId } : {}),
    ...(blockId ? { blockId } : {})
  };
}

function mapStrapiWidget(value: unknown): StudioWidgetRecord | null {
  const row = unwrapStrapiEntity(asObject(value));
  const widgetKey = asString(row.widgetKey).trim();
  const repoPath = asString(row.repoPath).trim();
  if (!widgetKey || !repoPath) {
    return null;
  }

  return {
    id: asString(row.documentId ?? row.id).trim() || widgetKey,
    key: widgetKey,
    name: asString(row.name).trim() || widgetKey,
    widgetType: row.widgetType === "download_gate" ? "download_gate" : "booking_popup",
    surface: row.surface === "inline" ? "inline" : "modal",
    status: row.status === "inactive" ? "inactive" : "active",
    lifecycle: row.lifecycle === "published" || row.lifecycle === "archived" ? row.lifecycle : "draft",
    readiness: row.readiness === "warning" || row.readiness === "blocked" ? row.readiness : "ready",
    repoPath,
    ...(asString(row.description).trim() ? { description: asString(row.description).trim() } : {}),
    editableFields: Array.isArray(row.editableFields)
      ? row.editableFields.filter((entry): entry is string => typeof entry === "string")
      : [],
    ...(asString(row.defaultExitId).trim() ? { defaultExitId: asString(row.defaultExitId).trim() } : {}),
    ...(asString(row.visualMockHtml).trim() ? { visualMockHtml: asString(row.visualMockHtml).trim() } : {}),
    placement: normalizePlacement(row.placement),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
  };
}

function normalizeExecutionPayload(value: unknown): { widgetId: string; event: string; payload?: Record<string, unknown> } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WidgetExecutionError("widgets.execution_payload_invalid", "Widget execution payload is required.");
  }

  const row = value as ExecuteWidgetPayload;
  const widgetId = typeof row.widgetId === "string" && row.widgetId.trim().length > 0 ? row.widgetId.trim() : "";
  if (widgetId.length === 0) {
    throw new WidgetExecutionError("widgets.execution_widget_id_required", "widgetId is required for execution.");
  }

  const event = typeof row.event === "string" && row.event.trim().length > 0 ? row.event.trim() : "run";
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? (row.payload as Record<string, unknown>) : undefined;

  return {
    widgetId,
    event,
    ...(payload ? { payload } : {})
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

async function assertExecutionPlacement(widget: StudioWidgetRecord): Promise<{
  pageId?: string;
  blockId?: string;
}> {
  const pageId = widget.placement.pageId;
  const blockId = widget.placement.blockId;

  if (pageId) {
    const pageExists = isStrapiConfigured()
      ? await hasStrapiPageReference(pageId)
      : getStudioStore().pages.some((page) => page.id === pageId || page.slug === pageId);
    if (!pageExists) {
      throw new WidgetExecutionError("widgets.execution_page_not_found", `Bound page "${pageId}" was not found.`);
    }
  }

  if (blockId) {
    const blockExists = isStrapiConfigured()
      ? await hasStrapiBlockReference(blockId)
      : getStudioStore().blocks.some((block) => block.id === blockId || block.key === blockId);
    if (!blockExists) {
      throw new WidgetExecutionError("widgets.execution_block_not_found", `Bound block "${blockId}" was not found.`);
    }
  }

  return {
    ...(pageId ? { pageId } : {}),
    ...(blockId ? { blockId } : {})
  };
}

function markWidgetExecuted(widgetId: string): void {
  const store = getStudioStore();
  const widgets = store.widgets.map((widget) =>
    widget.id === widgetId || widget.key === widgetId
      ? {
          ...widget,
          lastExecutedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString().slice(0, 10)
        }
      : widget
  );

  replaceStore({
    ...store,
    widgets
  });
}

function unchangedCoreEntities(params: {
  before: Awaited<ReturnType<typeof collectWidgetStrapiProbeSnapshot>>;
  after: Awaited<ReturnType<typeof collectWidgetStrapiProbeSnapshot>>;
}): boolean {
  return params.before.pages === params.after.pages && params.before.blocks === params.after.blocks && params.before.shells === params.after.shells;
}

async function findWidgetInStrapi(widgetIdOrKey: string): Promise<StudioWidgetRecord | null> {
  const lookup = await requestStrapi<StrapiLookupResponse>(
    `/api/studio-widgets?filters[$or][0][documentId][$eq]=${encodeURIComponent(
      widgetIdOrKey
    )}&filters[$or][1][id][$eq]=${encodeURIComponent(widgetIdOrKey)}&filters[$or][2][widgetKey][$eq]=${encodeURIComponent(
      widgetIdOrKey
    )}&pagination[pageSize]=1`
  );
  const row = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  return row ? mapStrapiWidget(row) : null;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = normalizeExecutionPayload(await request.json());
    const widget = isStrapiConfigured()
      ? await findWidgetInStrapi(payload.widgetId)
      : getStudioStore().widgets.find((entry) => entry.id === payload.widgetId || entry.key === payload.widgetId);
    if (!widget) {
      throw new WidgetExecutionError("widgets.execution_not_found", `Widget "${payload.widgetId}" was not found.`, 404);
    }

    const adapter = resolveRepoWidgetAdapter(widget.repoPath);
    if (!adapter) {
      throw new WidgetExecutionError("widgets.execution_adapter_missing", "No adapter is registered for this repoPath.", 409);
    }

    const placement = await assertExecutionPlacement(widget);
    const beforeProbe = await collectWidgetStrapiProbeSnapshot();
    const result = adapter.execute({
      widgetId: widget.id,
      ...(placement.pageId ? { pageId: placement.pageId } : {}),
      ...(placement.blockId ? { blockId: placement.blockId } : {}),
      payload: payload.payload
    });
    if (!isStrapiConfigured()) {
      markWidgetExecuted(widget.id);
    }
    const afterProbe = await collectWidgetStrapiProbeSnapshot();

    return Response.json({
      ok: true,
      data: {
        event: payload.event,
        widget: {
          id: widget.id,
          name: widget.name,
          repoPath: widget.repoPath,
          placement: widget.placement
        },
        adapter: {
          repoPath: adapter.repoPath,
          widgetType: adapter.widgetType,
          surface: adapter.surface
        },
        result
      },
      source: isStrapiConfigured() ? "strapi" : "fallback",
      strapiAudit: {
        before: beforeProbe,
        after: afterProbe,
        unchangedCoreEntities: unchangedCoreEntities({ before: beforeProbe, after: afterProbe })
      }
    });
  } catch (error) {
    if (error instanceof WidgetExecutionError) {
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
