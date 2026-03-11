"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PreviewPane } from "../_components/PreviewPane";
import { StudioActionMenu, StudioDetailContainer, StudioListContainer } from "../_components/workflow";
import { requestClientJson } from "../_lib/client-request";
import type { StudioBlockTemplate, StudioPageDocument, StudioShell } from "../_lib/studio-types";

type PreviewMode = "draft" | "production";

type PagesPostResponse = {
  ok: boolean;
  data?: {
    page?: StudioPageDocument;
    applied?: boolean;
    warnings?: string[];
    previewRoute?: string;
    importedBlocks?: Array<{ key: string; family: string }>;
    blockCount?: number;
    routeSlugEntitiesCreated?: number;
    pageCountBefore?: number | null;
    pageCountAfter?: number | null;
  };
  source?: "strapi" | "fallback";
  error?: string;
  code?: string;
};

const DEFAULT_NAVBAR_HTML =
  "<nav style=\"display:flex;justify-content:space-between;align-items:center;padding:14px 28px;background:#0f172a;color:#f8fafc;font-family:system-ui;border-bottom:1px solid #1e293b\"><strong style=\"font-size:16px\">LMNAs</strong><span style=\"font-size:12px;color:#94a3b8\">Studio Shell</span></nav>";
const DEFAULT_FOOTER_HTML =
  "<footer style=\"padding:18px 28px;background:#0b1120;color:#64748b;font-family:system-ui;text-align:center;font-size:12px;border-top:1px solid #1e293b\">LMNAs Studio Footer</footer>";

function sanitizeSlug(value: string): string {
  const next = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return next.length > 0 ? next : "draft-page";
}

function createDraftPage(seed: number): StudioPageDocument {
  const slug = `draft-page-${seed}`;
  return {
    id: `page-${Date.now()}-${seed}`,
    name: `Draft Page ${seed}`,
    slug,
    locale: "en",
    activeShellId: undefined,
    blockOrder: [],
    fieldValues: {},
    actionOverrides: {},
    previewHtml: "",
    updatedAt: new Date().toISOString().slice(0, 10)
  };
}

function resolveShellPreview(shells: StudioShell[]): { headerHtml: string; footerHtml: string } {
  const activeFull = shells.find((shell) => shell.status === "active" && shell.role === "full");
  const activeNavbar = shells.find((shell) => shell.status === "active" && shell.role === "navbar");
  const activeFooter = shells.find((shell) => shell.status === "active" && shell.role === "footer");

  return {
    headerHtml: activeFull?.previewHtml ?? activeNavbar?.previewHtml ?? DEFAULT_NAVBAR_HTML,
    footerHtml: activeFull ? "" : activeFooter?.previewHtml ?? DEFAULT_FOOTER_HTML
  };
}

function buildPreviewHtml(params: {
  page: StudioPageDocument;
  blocks: StudioBlockTemplate[];
  shells: StudioShell[];
}): string {
  const blockMap = new Map<string, StudioBlockTemplate>();
  params.blocks.forEach((block) => {
    blockMap.set(block.id, block);
    blockMap.set(block.key, block);
  });

  const sectionHtml = params.page.blockOrder
    .map((blockId) => blockMap.get(blockId)?.previewHtml ?? "")
    .filter((value) => value.trim().length > 0)
    .join("\n");

  const shell = resolveShellPreview(params.shells);
  const body = sectionHtml.length > 0 ? sectionHtml : "<section style='padding:48px;font-family:system-ui'><h2>No blocks composed yet.</h2></section>";

  return `<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><style>html,body{margin:0;padding:0}body{background:#0b1120}</style></head><body>${shell.headerHtml}${body}${shell.footerHtml}</body></html>`;
}

export default function PagesWorkflowPage(): React.ReactElement {
  const [pages, setPages] = useState<StudioPageDocument[]>([]);
  const [blocks, setBlocks] = useState<StudioBlockTemplate[]>([]);
  const [shells, setShells] = useState<StudioShell[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("draft");
  const [productionPreviewByPageId, setProductionPreviewByPageId] = useState<Record<string, string>>({});
  const [candidateBlockId, setCandidateBlockId] = useState<string>("");
  const [importHtml, setImportHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPage = pages.find((page) => page.id === selectedId) ?? null;
  const draftPreviewHtml = useMemo(() => {
    if (!selectedPage) {
      return "<html><body><section style='padding:40px;font-family:system-ui'><h2>Select a page to preview.</h2></section></body></html>";
    }
    return buildPreviewHtml({
      page: selectedPage,
      blocks,
      shells
    });
  }, [selectedPage, blocks, shells]);

  const productionPreviewHtml =
    selectedPage && productionPreviewByPageId[selectedPage.id]
      ? productionPreviewByPageId[selectedPage.id]
      : selectedPage?.previewHtml && selectedPage.previewHtml.trim().length > 0
        ? selectedPage.previewHtml
        : draftPreviewHtml;

  const visiblePreviewHtml = previewMode === "production" ? productionPreviewHtml : draftPreviewHtml;

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [pagesPayload, blocksPayload, shellsPayload] = await Promise.all([
          requestClientJson<{
            ok: boolean;
            data?: StudioPageDocument[];
            error?: string;
          }>(
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
          requestClientJson<{
            ok: boolean;
            data?: StudioBlockTemplate[];
            error?: string;
          }>(
            "/api/platform/studio/blocks",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading block library timed out. Please retry.",
              fallbackErrorMessage: "Unable to load blocks."
            }
          ),
          requestClientJson<{
            ok: boolean;
            data?: StudioShell[];
            error?: string;
          }>(
            "/api/platform/studio/shells",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading shells timed out. Please retry.",
              fallbackErrorMessage: "Unable to load shells."
            }
          )
        ]);

        if (!pagesPayload.ok || !Array.isArray(pagesPayload.data)) {
          throw new Error(pagesPayload.error ?? "Unable to load pages.");
        }
        if (!blocksPayload.ok || !Array.isArray(blocksPayload.data)) {
          throw new Error(blocksPayload.error ?? "Unable to load blocks.");
        }
        if (!shellsPayload.ok || !Array.isArray(shellsPayload.data)) {
          throw new Error(shellsPayload.error ?? "Unable to load shells.");
        }

        const loadedPages = pagesPayload.data;
        const loadedBlocks = blocksPayload.data;
        const loadedShells = shellsPayload.data;

        setPages(loadedPages);
        setBlocks(loadedBlocks);
        setShells(loadedShells);
        setCandidateBlockId(loadedBlocks[0]?.id ?? "");

        const initialPreviewMap: Record<string, string> = {};
        loadedPages.forEach((page) => {
          if (page.previewHtml.trim().length > 0) {
            initialPreviewMap[page.id] = page.previewHtml;
          }
        });
        setProductionPreviewByPageId(initialPreviewMap);

        if (loadedPages.length > 0) {
          setSelectedId((previous) => previous ?? loadedPages[0].id);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  function patchSelectedPage(mutator: (page: StudioPageDocument) => StudioPageDocument): void {
    if (!selectedPage) {
      return;
    }
    setPages((current) => current.map((page) => (page.id === selectedPage.id ? mutator(page) : page)));
  }

  function addDraftPage(): void {
    const draftIndex = pages.length + 1;
    const next = createDraftPage(draftIndex);
    setPages((current) => [next, ...current]);
    setSelectedId(next.id);
    setPreviewMode("draft");
    setStatusMessage("Created a new draft page. Compose it from existing blocks.");
    setError(null);
  }

  function addBlockToPage(blockId: string): void {
    if (!selectedPage || !blockId) {
      return;
    }
    patchSelectedPage((page) => ({
      ...page,
      blockOrder: [...page.blockOrder, blockId],
      updatedAt: new Date().toISOString().slice(0, 10)
    }));
    setStatusMessage("Block added to draft composition.");
  }

  function moveBlock(index: number, direction: -1 | 1): void {
    if (!selectedPage) {
      return;
    }
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedPage.blockOrder.length) {
      return;
    }

    patchSelectedPage((page) => {
      const next = [...page.blockOrder];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return {
        ...page,
        blockOrder: next,
        updatedAt: new Date().toISOString().slice(0, 10)
      };
    });
  }

  function removeBlock(index: number): void {
    if (!selectedPage) {
      return;
    }
    patchSelectedPage((page) => ({
      ...page,
      blockOrder: page.blockOrder.filter((_, currentIndex) => currentIndex !== index),
      updatedAt: new Date().toISOString().slice(0, 10)
    }));
  }

  async function refreshBlocks(): Promise<void> {
    const payload = await requestClientJson<{
      ok: boolean;
      data?: StudioBlockTemplate[];
      error?: string;
    }>(
      "/api/platform/studio/blocks",
      {
        method: "GET",
        headers: { "content-type": "application/json" }
      },
      {
        timeoutMessage: "Refreshing block library timed out. Please retry.",
        fallbackErrorMessage: "Unable to refresh block library."
      }
    );

    if (!payload.ok || !payload.data) {
      throw new Error(payload.error ?? "Unable to refresh block library.");
    }

    setBlocks(payload.data);
    if (!candidateBlockId && payload.data[0]) {
      setCandidateBlockId(payload.data[0].id);
    }
  }

  async function persistSelectedPage(mode: "save" | "apply"): Promise<void> {
    if (!selectedPage) {
      setError("Create or select a page before saving.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const pagePayload: StudioPageDocument = {
        ...selectedPage,
        slug: sanitizeSlug(selectedPage.slug),
        previewHtml: draftPreviewHtml,
        updatedAt: new Date().toISOString().slice(0, 10)
      };

      const response = await requestClientJson<PagesPostResponse>(
        "/api/platform/studio/pages",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            page: pagePayload,
            mode
          })
        },
        {
          timeoutMessage: mode === "apply" ? "Publishing page timed out. Please retry." : "Saving draft timed out. Please retry.",
          fallbackErrorMessage: mode === "apply" ? "Unable to publish page." : "Unable to save page draft."
        }
      );

      if (!response.ok || !response.data) {
        throw new Error(response.error ?? "Unable to save page.");
      }

      const persistedPage = response.data.page ?? pagePayload;
      setPages((current) => current.map((page) => (page.id === selectedPage.id ? persistedPage : page)));

      if (mode === "apply" && response.data.applied) {
        setProductionPreviewByPageId((current) => ({
          ...current,
          [persistedPage.id]: pagePayload.previewHtml
        }));
        setPreviewMode("production");
        setStatusMessage(`Page published. Preview route: ${response.data.previewRoute ?? "n/a"}`);
      } else if (mode === "apply") {
        setStatusMessage(`Page saved locally. ${(response.data.warnings ?? ["No publish warnings."])[0]}`);
      } else {
        setStatusMessage("Draft saved successfully.");
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function runBlocksOnlyImport(): Promise<void> {
    if (importHtml.trim().length === 0) {
      setError("Paste full-page HTML before running import.");
      return;
    }

    setIsImporting(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await requestClientJson<PagesPostResponse>(
        "/api/platform/studio/pages",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "import-blocks",
            html: importHtml,
            sourceRef: "docs/testing-artifacts/code.html"
          })
        },
        {
          timeoutMessage: "Full-page import timed out. Please retry.",
          fallbackErrorMessage: "Unable to run full-page import."
        }
      );

      if (!response.ok || !response.data) {
        throw new Error(response.error ?? "Import failed.");
      }

      await refreshBlocks();
      setStatusMessage(
        `Imported ${response.data.blockCount ?? 0} blocks. Route-slug entities created: ${response.data.routeSlugEntitiesCreated ?? 0}.`
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setIsImporting(false);
    }
  }

  const pageActions = [
    {
      id: "pages-create-draft",
      label: "Create Draft Page",
      description: "Create a page document and compose it using existing approved blocks.",
      tone: "accent" as const,
      onSelect: addDraftPage
    },
    {
      id: "pages-save-draft",
      label: "Save Draft",
      description: "Persist page block-array composition in draft state.",
      disabled: !selectedPage || isSaving,
      onSelect: () => {
        void persistSelectedPage("save");
      }
    },
    {
      id: "pages-publish-template",
      label: "Compile Page Template",
      description: "Apply the composed page through the governed page persistence path.",
      disabled: !selectedPage || isSaving,
      onSelect: () => {
        void persistSelectedPage("apply");
      }
    },
    {
      id: "pages-import-blocks",
      label: "Import Full HTML to Blocks",
      description: "Extract full-page markup into block rows only. Route slug generation is forbidden.",
      disabled: isImporting || importHtml.trim().length === 0,
      onSelect: () => {
        void runBlocksOnlyImport();
      }
    }
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1340px] flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-slate-100">Page Workflow</h1>
        <p className="mt-1 text-xs text-slate-500">
          Assemble pages from approved blocks only. Full-page import extracts blocks and never auto-generates active route slugs.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-2">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      ) : null}
      {statusMessage ? (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2">
          <p className="text-xs text-emerald-300">{statusMessage}</p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <StudioListContainer
          testId="pages-list-container"
          title="Page Documents"
          description={isLoading ? "Loading pages…" : "Browse existing pages and select one for composition editing."}
          items={pages}
          selectedId={selectedId}
          onSelectItem={(page) => {
            setSelectedId(page.id);
            setPreviewMode("draft");
          }}
          getItemTestId={(page) => `pages-card-${page.id}`}
          getItemTitle={(page) => page.name}
          getItemSubtitle={(page) => `${page.locale}/${page.slug}`}
          getItemMeta={(page) => `blocks ${page.blockOrder.length} • updated ${page.updatedAt}`}
          emptyTitle="No pages composed"
          emptyDescription="Create a draft page from the action menu and compose it using approved blocks."
        />

        <div className="flex flex-col gap-5">
          <StudioDetailContainer
            testId="pages-detail-container"
            title={selectedPage ? selectedPage.name : "Page Detail"}
            description={selectedPage ? "Edit by reordering, adding, or removing approved blocks." : "Select a page to edit composition."}
            isEmpty={!selectedPage}
            emptyTitle="No page selected"
            emptyDescription="Pick a page from the list or create a new draft page from actions."
          >
            {selectedPage ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span className="text-[11px] text-slate-500">Name</span>
                    <input
                      data-testid="pages-name-input"
                      value={selectedPage.name}
                      onChange={(event) => {
                        const value = event.target.value;
                        patchSelectedPage((page) => ({
                          ...page,
                          name: value,
                          updatedAt: new Date().toISOString().slice(0, 10)
                        }));
                      }}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    <span className="text-[11px] text-slate-500">Slug</span>
                    <input
                      data-testid="pages-slug-input"
                      value={selectedPage.slug}
                      onChange={(event) => {
                        const value = event.target.value;
                        patchSelectedPage((page) => ({
                          ...page,
                          slug: value,
                          updatedAt: new Date().toISOString().slice(0, 10)
                        }));
                      }}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    />
                  </label>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <p className="text-xs font-semibold text-slate-300">Block Composition</p>
                  <p className="mt-1 text-[11px] text-slate-500">Pages are assembled strictly from approved block templates.</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      data-testid="pages-add-block-select"
                      value={candidateBlockId}
                      onChange={(event) => setCandidateBlockId(event.target.value)}
                      className="min-w-[240px] rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    >
                      {blocks.map((block) => (
                        <option key={block.id} value={block.id}>
                          {block.name} ({block.family})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      data-testid="pages-add-block-button"
                      onClick={() => addBlockToPage(candidateBlockId)}
                      className="rounded-lg border border-blue-500/30 bg-blue-500/[0.12] px-3 py-2 text-xs font-semibold text-blue-200"
                    >
                      Add Block
                    </button>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {selectedPage.blockOrder.map((blockId, index) => {
                      const block = blocks.find((entry) => entry.id === blockId || entry.key === blockId);
                      return (
                        <li
                          key={`${blockId}-${index}`}
                          data-testid={`pages-composed-block-${index}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.015] px-3 py-2"
                        >
                          <div>
                            <p className="text-xs font-semibold text-slate-200">{block?.name ?? blockId}</p>
                            <p className="text-[11px] text-slate-500">{block?.family ?? "unknown"}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              data-testid={`pages-block-up-${index}`}
                              onClick={() => moveBlock(index, -1)}
                              disabled={index === 0}
                              className="rounded border border-white/[0.1] px-2 py-1 text-[11px] text-slate-300 disabled:opacity-40"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              data-testid={`pages-block-down-${index}`}
                              onClick={() => moveBlock(index, 1)}
                              disabled={index === selectedPage.blockOrder.length - 1}
                              className="rounded border border-white/[0.1] px-2 py-1 text-[11px] text-slate-300 disabled:opacity-40"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              data-testid={`pages-block-remove-${index}`}
                              onClick={() => removeBlock(index)}
                              className="rounded border border-red-500/30 bg-red-500/[0.12] px-2 py-1 text-[11px] text-red-200"
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      );
                    })}
                    {selectedPage.blockOrder.length === 0 ? (
                      <li className="rounded-lg border border-dashed border-white/[0.12] px-3 py-4 text-center text-xs text-slate-500">
                        No blocks composed yet.
                      </li>
                    ) : null}
                  </ul>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-300">Draft / Production Preview</p>
                    <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
                      <button
                        type="button"
                        data-testid="pages-preview-mode-draft"
                        onClick={() => setPreviewMode("draft")}
                        className={`rounded px-2 py-1 text-[11px] ${previewMode === "draft" ? "bg-blue-500/20 text-blue-200" : "text-slate-400"}`}
                      >
                        Draft
                      </button>
                      <button
                        type="button"
                        data-testid="pages-preview-mode-production"
                        onClick={() => setPreviewMode("production")}
                        className={`rounded px-2 py-1 text-[11px] ${previewMode === "production" ? "bg-emerald-500/20 text-emerald-200" : "text-slate-400"}`}
                      >
                        Production
                      </button>
                    </div>
                  </div>

                  <PreviewPane
                    title="Page Preview"
                    badge={previewMode === "draft" ? "draft" : "production"}
                    srcDoc={visiblePreviewHtml}
                    minHeight="420px"
                    testId="pages-preview-frame"
                  />
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                  <p className="text-xs font-semibold text-slate-300">Governed Full-Page HTML Import</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Paste full-page HTML (for example from docs/testing-artifacts/code.html) to extract block rows only. Route slug creation is blocked.
                  </p>
                  <textarea
                    data-testid="pages-import-html-input"
                    value={importHtml}
                    onChange={(event) => setImportHtml(event.target.value)}
                    className="mt-3 min-h-[150px] w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-slate-200"
                    placeholder="Paste governed full-page HTML here"
                  />
                </div>
              </div>
            ) : null}
          </StudioDetailContainer>

          <StudioActionMenu
            testId="pages-action-container"
            title="Page Actions"
            description="Run draft save, compile, and governed block-only import operations from one shared workflow menu."
            items={pageActions}
          />
        </div>
      </div>
    </div>
  );
}
