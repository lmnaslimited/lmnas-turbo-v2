import { getStudioStore, replaceStore } from "../../_lib/store";
import { isStrapiConfigured, requestStrapi } from "../../_lib/strapi";
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

async function assertExecutionPlacement(widget: ReturnType<typeof getStudioStore>["widgets"][number]): Promise<{
  pageId?: string;
  blockId?: string;
}> {
  const store = getStudioStore();
  const pageId = widget.placement.pageId;
  const blockId = widget.placement.blockId;

  if (pageId) {
    let pageExists = store.pages.some((page) => page.id === pageId || page.slug === pageId);
    if (!pageExists && isStrapiConfigured()) {
      pageExists = await hasStrapiPageReference(pageId);
    }
    if (!pageExists) {
      throw new WidgetExecutionError("widgets.execution_page_not_found", `Bound page "${pageId}" was not found.`);
    }
  }

  if (blockId) {
    let blockExists = store.blocks.some((block) => block.id === blockId || block.key === blockId);
    if (!blockExists && isStrapiConfigured()) {
      blockExists = await hasStrapiBlockReference(blockId);
    }
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

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = normalizeExecutionPayload(await request.json());
    const store = getStudioStore();
    const widget = store.widgets.find((entry) => entry.id === payload.widgetId || entry.key === payload.widgetId);
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
    markWidgetExecuted(widget.id);
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
      source: "fallback",
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
