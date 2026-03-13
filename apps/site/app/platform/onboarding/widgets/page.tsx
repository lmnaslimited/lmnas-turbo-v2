"use client";

import React, { useEffect, useMemo, useState } from "react";
import { StudioActionMenu, StudioDetailContainer, StudioListContainer } from "../_components/workflow";
import { requestClientJson } from "../_lib/client-request";
import type { StudioBlockTemplate, StudioPageDocument, StudioWidgetRecord } from "../_lib/studio-types";

type RepoWidgetCatalogItem = {
  repoPath: string;
  displayName: string;
  widgetType: StudioWidgetRecord["widgetType"];
  surface: StudioWidgetRecord["surface"];
};

type WidgetsGetPayload = {
  ok: boolean;
  data?: StudioWidgetRecord[];
  catalog?: RepoWidgetCatalogItem[];
  error?: string;
};

function buildDraftWidget(seed: number, catalog: RepoWidgetCatalogItem[]): StudioWidgetRecord {
  const fallbackCatalog = catalog[0] ?? {
    repoPath: "/components/widgets/calendar-widget.ts",
    displayName: "Calendar Booking Widget",
    widgetType: "booking_popup" as const,
    surface: "modal" as const
  };

  return {
    id: `widget-${Date.now()}-${seed}`,
    key: `widget-${Date.now()}-${seed}`,
    name: `${fallbackCatalog.displayName} Draft ${seed}`,
    widgetType: fallbackCatalog.widgetType,
    surface: fallbackCatalog.surface,
    status: "active",
    repoPath: fallbackCatalog.repoPath,
    description: "Repo-first widget mapping draft.",
    editableFields: [],
    placement: {
      mode: "reference"
    },
    updatedAt: new Date().toISOString().slice(0, 10)
  };
}

export default function WidgetWorkflowPage(): React.ReactElement {
  const [widgets, setWidgets] = useState<StudioWidgetRecord[]>([]);
  const [catalog, setCatalog] = useState<RepoWidgetCatalogItem[]>([]);
  const [pages, setPages] = useState<StudioPageDocument[]>([]);
  const [blocks, setBlocks] = useState<StudioBlockTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rawScriptInput, setRawScriptInput] = useState("");
  const [executionPayload, setExecutionPayload] = useState('{"preferredSlot":"2026-03-20T10:30"}');
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedWidget = widgets.find((widget) => widget.id === selectedId) ?? null;

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [widgetsPayload, pagesPayload, blocksPayload] = await Promise.all([
          requestClientJson<WidgetsGetPayload>(
            "/api/platform/studio/widgets",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading widgets timed out. Please retry.",
              fallbackErrorMessage: "Unable to load widgets."
            }
          ),
          requestClientJson<{ ok: boolean; data?: StudioPageDocument[]; error?: string }>(
            "/api/platform/studio/pages",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading pages timed out. Please retry.",
              fallbackErrorMessage: "Unable to load pages."
            }
          ),
          requestClientJson<{ ok: boolean; data?: StudioBlockTemplate[]; error?: string }>(
            "/api/platform/studio/blocks",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading blocks timed out. Please retry.",
              fallbackErrorMessage: "Unable to load blocks."
            }
          )
        ]);

        if (!widgetsPayload.ok || !Array.isArray(widgetsPayload.data)) {
          throw new Error(widgetsPayload.error ?? "Unable to load widgets.");
        }
        if (!pagesPayload.ok || !pagesPayload.data) {
          throw new Error(pagesPayload.error ?? "Unable to load pages.");
        }
        if (!blocksPayload.ok || !blocksPayload.data) {
          throw new Error(blocksPayload.error ?? "Unable to load blocks.");
        }

        const loadedWidgets = widgetsPayload.data;
        setWidgets(loadedWidgets);
        setCatalog(Array.isArray(widgetsPayload.catalog) ? widgetsPayload.catalog : []);
        setPages(pagesPayload.data);
        setBlocks(blocksPayload.data);
        if (loadedWidgets.length > 0) {
          setSelectedId((prev) => prev ?? loadedWidgets[0].id);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const pageOptions = useMemo(() => pages.map((page) => ({ value: page.id, label: `${page.name} (${page.slug})` })), [pages]);
  const blockOptions = useMemo(() => blocks.map((block) => ({ value: block.id, label: `${block.name} (${block.family})` })), [blocks]);

  function patchSelectedWidget(mutator: (widget: StudioWidgetRecord) => StudioWidgetRecord): void {
    if (!selectedWidget) {
      return;
    }

    setWidgets((current) =>
      current.map((widget) =>
        widget.id === selectedWidget.id
          ? {
              ...mutator(widget),
              updatedAt: new Date().toISOString().slice(0, 10)
            }
          : widget
      )
    );
  }

  function createWidgetDraft(): void {
    const draft = buildDraftWidget(widgets.length + 1, catalog);
    if (pages[0]) {
      draft.placement = {
        mode: "reference",
        pageId: pages[0].id
      };
    }

    setWidgets((current) => [draft, ...current]);
    setSelectedId(draft.id);
    setRawScriptInput("");
    setExecutionResult(null);
    setStatusMessage("Draft widget created. Configure repo path and placement.");
    setError(null);
  }

  async function saveWidget(): Promise<void> {
    if (!selectedWidget) {
      setError("Create or select a widget before saving.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const payload = await requestClientJson<{ ok: boolean; data?: StudioWidgetRecord[]; error?: string }>(
        "/api/platform/studio/widgets",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            widget: selectedWidget,
            rawScript: rawScriptInput
          })
        },
        {
          timeoutMessage: "Saving widget mapping timed out. Please retry.",
          fallbackErrorMessage: "Unable to save widget mapping."
        }
      );

      if (!payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to save widget mapping.");
      }

      setWidgets(payload.data);
      setStatusMessage("Widget mapping saved via repo-first contract.");
      setRawScriptInput("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function executeWidget(): Promise<void> {
    if (!selectedWidget) {
      setError("Select a widget before execution.");
      return;
    }

    setIsExecuting(true);
    setError(null);
    setStatusMessage(null);

    try {
      const parsedPayload = executionPayload.trim().length > 0 ? (JSON.parse(executionPayload) as Record<string, unknown>) : {};
      const response = await requestClientJson<{ ok: boolean; data?: unknown; error?: string }>(
        "/api/platform/studio/widgets/execute",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            widgetId: selectedWidget.id,
            event: "manual-run",
            payload: parsedPayload
          })
        },
        {
          timeoutMessage: "Widget execution timed out. Please retry.",
          fallbackErrorMessage: "Widget execution failed."
        }
      );

      if (!response.ok || !response.data) {
        throw new Error(response.error ?? "Widget execution failed.");
      }

      setExecutionResult(JSON.stringify(response.data, null, 2));
      setStatusMessage("Widget logic executed through approved repo-path adapter.");
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : String(executeError));
    } finally {
      setIsExecuting(false);
    }
  }

  async function deleteWidget(): Promise<void> {
    if (!selectedWidget) {
      setError("Select a widget before deletion.");
      return;
    }

    setError(null);
    setStatusMessage(null);
    const response = await fetch(`/api/platform/studio/widgets?id=${encodeURIComponent(selectedWidget.id)}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" }
    });

    const payload = (await response.json()) as { ok: boolean; data?: StudioWidgetRecord[]; error?: string };
    if (!response.ok || !payload.ok || !payload.data) {
      setError(payload.error ?? "Unable to delete widget.");
      return;
    }

    setWidgets(payload.data);
    setSelectedId(payload.data[0]?.id ?? null);
    setStatusMessage("Widget mapping removed.");
  }

  const widgetActions = [
    {
      id: "widgets-create",
      label: "Create Widget Draft",
      description: "Create a repo-first widget mapping draft.",
      tone: "accent" as const,
      onSelect: createWidgetDraft
    },
    {
      id: "widgets-save",
      label: "Save Widget Mapping",
      description: "Persist non-executable widget metadata and repo-path reference.",
      disabled: !selectedWidget || isSaving,
      onSelect: () => {
        void saveWidget();
      }
    },
    {
      id: "widgets-execute",
      label: "Run Widget Logic",
      description: "Execute widget through approved repo adapter path.",
      disabled: !selectedWidget || isExecuting,
      onSelect: () => {
        void executeWidget();
      }
    },
    {
      id: "widgets-delete",
      label: "Delete Widget Mapping",
      description: "Remove selected widget mapping record.",
      tone: "danger" as const,
      disabled: !selectedWidget,
      onSelect: () => {
        void deleteWidget();
      }
    }
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1340px] flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-slate-100">Widget Workflow</h1>
        <p className="mt-1 text-xs text-slate-500">
          Widgets execute only from approved repo paths. HTML/URL payloads are visual mocks and cannot execute script logic.
        </p>
      </header>

      {error ? (
        <div data-testid="widgets-error-banner" className="rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-2">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      ) : null}
      {statusMessage ? (
        <div data-testid="widgets-success-banner" className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2">
          <p className="text-xs text-emerald-300">{statusMessage}</p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <StudioListContainer
          testId="widgets-list-container"
          title="Widget Mappings"
          description={isLoading ? "Loading widgets…" : "Browse repo-first widget mappings and placement targets."}
          items={widgets}
          selectedId={selectedId}
          onSelectItem={(widget) => {
            setSelectedId(widget.id);
            setExecutionResult(null);
            setRawScriptInput("");
          }}
          getItemTestId={(widget) => `widgets-card-${widget.id}`}
          getItemTitle={(widget) => widget.name}
          getItemSubtitle={(widget) => `${widget.widgetType} • ${widget.status}`}
          getItemMeta={(widget) => `${widget.placement.mode}${widget.placement.pageId ? ` • page ${widget.placement.pageId}` : ""}`}
          emptyTitle="No widgets mapped"
          emptyDescription="Create a draft and map it to an approved repo path."
        />

        <div className="flex flex-col gap-5">
          <StudioDetailContainer
            testId="widgets-detail-container"
            title={selectedWidget ? selectedWidget.name : "Widget Detail"}
            description={selectedWidget ? "Configure repo path, placement, and visual mock metadata." : "Select a widget mapping to edit."}
            isEmpty={!selectedWidget}
            emptyTitle="No widget selected"
            emptyDescription="Choose a widget row or create a draft widget mapping."
          >
            {selectedWidget ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span className="text-[11px] text-slate-500">Widget Name</span>
                    <input
                      data-testid="widgets-name-input"
                      value={selectedWidget.name}
                      onChange={(event) => {
                        const value = event.target.value;
                        patchSelectedWidget((widget) => ({ ...widget, name: value }));
                      }}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span className="text-[11px] text-slate-500">Repo Path</span>
                    <select
                      data-testid="widgets-repo-path-select"
                      value={selectedWidget.repoPath}
                      onChange={(event) => {
                        const selectedRepo = catalog.find((entry) => entry.repoPath === event.target.value);
                        patchSelectedWidget((widget) => ({
                          ...widget,
                          repoPath: event.target.value,
                          widgetType: selectedRepo?.widgetType ?? widget.widgetType,
                          surface: selectedRepo?.surface ?? widget.surface
                        }));
                      }}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    >
                      {catalog.map((entry) => (
                        <option key={entry.repoPath} value={entry.repoPath}>
                          {entry.repoPath}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span className="text-[11px] text-slate-500">Placement Mode</span>
                    <select
                      data-testid="widgets-placement-mode-select"
                      value={selectedWidget.placement.mode}
                      onChange={(event) => {
                        const mode = event.target.value === "embed" ? "embed" : "reference";
                        patchSelectedWidget((widget) => ({
                          ...widget,
                          placement: {
                            ...widget.placement,
                            mode,
                            ...(mode === "reference" ? { blockId: undefined } : {})
                          }
                        }));
                      }}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="embed">embed (inside block)</option>
                      <option value="reference">reference (standalone)</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span className="text-[11px] text-slate-500">Widget Status</span>
                    <select
                      value={selectedWidget.status}
                      onChange={(event) => {
                        const status = event.target.value === "inactive" ? "inactive" : "active";
                        patchSelectedWidget((widget) => ({ ...widget, status }));
                      }}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span className="text-[11px] text-slate-500">Placement Page</span>
                    <select
                      data-testid="widgets-placement-page-select"
                      value={selectedWidget.placement.pageId ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        patchSelectedWidget((widget) => ({
                          ...widget,
                          placement: {
                            ...widget.placement,
                            pageId: value.length > 0 ? value : undefined
                          }
                        }));
                      }}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="">Select page</option>
                      {pageOptions.map((entry) => (
                        <option key={entry.value} value={entry.value}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span className="text-[11px] text-slate-500">Placement Block</span>
                    <select
                      data-testid="widgets-placement-block-select"
                      value={selectedWidget.placement.blockId ?? ""}
                      disabled={selectedWidget.placement.mode !== "embed"}
                      onChange={(event) => {
                        const value = event.target.value;
                        patchSelectedWidget((widget) => ({
                          ...widget,
                          placement: {
                            ...widget.placement,
                            blockId: value.length > 0 ? value : undefined
                          }
                        }));
                      }}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200 disabled:opacity-60"
                    >
                      <option value="">Select block</option>
                      {blockOptions.map((entry) => (
                        <option key={entry.value} value={entry.value}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  <span className="text-[11px] text-slate-500">Visual Mock HTML (non-executable)</span>
                  <textarea
                    data-testid="widgets-visual-mock-input"
                    value={selectedWidget.visualMockHtml ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      patchSelectedWidget((widget) => ({
                        ...widget,
                        visualMockHtml: value.length > 0 ? value : undefined
                      }));
                    }}
                    className="min-h-[110px] rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-slate-200"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  <span className="text-[11px] text-slate-500">Raw Script Upload (must fail)</span>
                  <textarea
                    data-testid="widgets-raw-script-input"
                    value={rawScriptInput}
                    onChange={(event) => setRawScriptInput(event.target.value)}
                    className="min-h-[90px] rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-slate-200"
                    placeholder="function bad(){alert('blocked')}"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  <span className="text-[11px] text-slate-500">Execution Payload JSON</span>
                  <textarea
                    data-testid="widgets-execution-payload-input"
                    value={executionPayload}
                    onChange={(event) => setExecutionPayload(event.target.value)}
                    className="min-h-[80px] rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-slate-200"
                  />
                </label>

                {selectedWidget.visualMockHtml ? (
                  <iframe
                    data-testid="widgets-visual-mock-preview"
                    className="w-full rounded-lg border border-white/[0.08] bg-white"
                    style={{ minHeight: "140px" }}
                    srcDoc={`<!DOCTYPE html><html><body style="font-family:system-ui;padding:16px">${selectedWidget.visualMockHtml}</body></html>`}
                    sandbox="allow-same-origin"
                    title="Widget visual mock"
                  />
                ) : null}

                {executionResult ? (
                  <pre
                    data-testid="widgets-execution-result"
                    className="overflow-x-auto rounded-lg border border-white/[0.08] bg-black/30 p-3 text-[11px] leading-relaxed text-slate-300"
                  >
                    {executionResult}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </StudioDetailContainer>

          <StudioActionMenu
            testId="widgets-action-container"
            title="Widget Actions"
            description="Create, save, execute, and remove repo-first widget mappings within the shared Studio action rail."
            items={widgetActions}
          />
        </div>
      </div>
    </div>
  );
}
