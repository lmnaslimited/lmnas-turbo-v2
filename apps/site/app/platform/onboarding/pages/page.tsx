"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PreviewPane } from "../_components/PreviewPane";
import { StudioActionMenu, StudioDetailContainer, StudioListContainer } from "../_components/workflow";
import { requestClientJson } from "../_lib/client-request";
import type { StudioBlockTemplate, StudioPageDocument, StudioShell } from "../_lib/studio-types";

type PreviewMode = "draft" | "production";
type PageFocusMode = "default" | "page-focus" | "full-screen";

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
    shellKey: undefined,
    lifecycle: "draft",
    status: "draft",
    blockOrder: [],
    fieldValues: {},
    actionOverrides: {},
    productMapping: "",
    industryMapping: [],
    primaryCta: {
      text: "",
      url: ""
    },
    conversionConfig: {
      trackConversions: true,
      strategy: "Track Conversions",
      valuePoints: 0
    },
    campaignUtmStrategy: {
      source: "",
      medium: "",
      campaign: ""
    },
    taxonomyState: {
      valid: false,
      tags: []
    },
    seoMetadata: {
      metaTitle: "",
      metaDescription: ""
    },
    seoJsonLdValid: false,
    blockSchemaValid: true,
    previewValid: false,
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
  const [focusMode, setFocusMode] = useState<PageFocusMode>("default");
  const [showPanelsInFocus, setShowPanelsInFocus] = useState(true);
  const [focusSwatch, setFocusSwatch] = useState<"blue" | "emerald" | "amber" | "violet">("blue");
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
      // Keep implementation diagnostics out of operator copy.
      console.info("pages.import-blocks.result", response.data);
      setStatusMessage(`Imported ${response.data.blockCount ?? 0} reusable section(s) from the page source.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setIsImporting(false);
    }
  }

  const shellOptions = shells.filter((shell) => shell.role === "full" || shell.role === "navbar");
  const industryOptions = ["fintech", "healthcare", "saas", "ecommerce", "enterprise"] as const;

  function togglePageFocusMode(): void {
    setFocusMode((current) => {
      if (current === "page-focus") {
        return "default";
      }
      setShowPanelsInFocus(false);
      return "page-focus";
    });
  }

  function toggleFullScreenFocusMode(): void {
    setFocusMode((current) => (current === "full-screen" ? "default" : "full-screen"));
  }

  function toggleIndustry(industry: string): void {
    if (!selectedPage) {
      return;
    }
    patchSelectedPage((page) => {
      const exists = page.industryMapping.includes(industry);
      return {
        ...page,
        industryMapping: exists ? page.industryMapping.filter((item) => item !== industry) : [...page.industryMapping, industry],
        updatedAt: new Date().toISOString().slice(0, 10)
      };
    });
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
      description: "Apply the composed page through the standard page save path.",
      disabled: !selectedPage || isSaving,
      onSelect: () => {
        void persistSelectedPage("apply");
      }
    },
    {
      id: "pages-import-blocks",
      label: "Import Full HTML to Blocks",
      description: "Extract reusable sections from full-page markup.",
      disabled: isImporting || importHtml.trim().length === 0,
      onSelect: () => {
        void runBlocksOnlyImport();
      }
    },
    {
      id: "pages-focus-mode",
      label: focusMode === "page-focus" ? "Exit Page Focus Mode" : "Enter Page Focus Mode",
      description: "Reduce distraction and focus on page composition with optional panel toggle.",
      disabled: !selectedPage,
      onSelect: togglePageFocusMode
    },
    {
      id: "pages-fullscreen-focus",
      label: focusMode === "full-screen" ? "Exit Full-screen Focus Mode" : "Enter Full-screen Focus Mode",
      description: "Open immersive full-screen page editing with floating publish toolbar.",
      tone: "accent" as const,
      disabled: !selectedPage,
      onSelect: toggleFullScreenFocusMode
    }
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1420px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Page Composer</h1>
          <p className="mt-1 text-xs text-slate-500">
            Assemble governed pages from reusable blocks, then validate mapping and publish readiness.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {focusMode === "page-focus" ? (
            <button
              type="button"
              onClick={() => setShowPanelsInFocus((current) => !current)}
              className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
            >
              {showPanelsInFocus ? "Hide Panels" : "Show Panels"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={togglePageFocusMode}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              focusMode === "page-focus" ? "bg-blue-500/20 text-blue-200" : "bg-white/[0.04] text-slate-400"
            }`}
          >
            Page Focus Mode
          </button>
          <button
            type="button"
            onClick={toggleFullScreenFocusMode}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              focusMode === "full-screen" ? "bg-blue-500/20 text-blue-200" : "bg-white/[0.04] text-slate-400"
            }`}
          >
            Full-screen Focus
          </button>
        </div>
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

      {focusMode === "page-focus" && selectedPage ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#071226]">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-3">
            <div>
              <p className="text-base font-bold text-slate-100">Page Composer</p>
              <p className="text-[11px] text-slate-500">Focused page editing mode</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPanelsInFocus((current) => !current)}
                className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
              >
                {showPanelsInFocus ? "Hide Panels" : "Show Panels"}
              </button>
              <button
                type="button"
                onClick={() => void persistSelectedPage("save")}
                className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
              >
                Save Draft
              </button>
              <div className="mx-1 flex items-center gap-1">
                {(["blue", "emerald", "amber", "violet"] as const).map((swatch) => (
                  <button
                    key={`focus-${swatch}`}
                    type="button"
                    onClick={() => setFocusSwatch(swatch)}
                    className={`h-5 w-5 rounded-full border ${
                      focusSwatch === swatch ? "border-slate-100 ring-2 ring-blue-500/40" : "border-white/20"
                    } ${
                      swatch === "blue"
                        ? "bg-blue-500"
                        : swatch === "emerald"
                          ? "bg-emerald-500"
                          : swatch === "amber"
                            ? "bg-amber-500"
                            : "bg-violet-500"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={toggleFullScreenFocusMode}
                className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Full-screen Focus
              </button>
              <button
                type="button"
                onClick={() => setFocusMode("default")}
                className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
              >
                Exit
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            {showPanelsInFocus ? (
              <aside className="flex w-72 flex-col border-r border-white/[0.08] bg-[#09152a]">
                <div className="border-b border-white/[0.08] px-3 py-3">
                  <input
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500"
                    placeholder="Search pages…"
                  />
                </div>
                <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
                  {pages.map((page) => {
                    const active = selectedId === page.id;
                    return (
                      <button
                        key={`focus-page-${page.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedId(page.id);
                          setPreviewMode("draft");
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left ${
                          active ? "bg-blue-500/15 text-blue-200" : "text-slate-300 hover:bg-white/[0.04]"
                        }`}
                      >
                        <span className="text-sm font-medium">{page.name}</span>
                        <span className="text-[10px] uppercase text-slate-500">{page.status ?? "draft"}</span>
                      </button>
                    );
                  })}
                </div>
              </aside>
            ) : null}

            <main className="flex-1 overflow-auto bg-[radial-gradient(#233348_1px,transparent_1px)] [background-size:24px_24px] p-6">
              <div className="mx-auto max-w-[980px] space-y-4">
                <div className="rounded-xl border border-white/[0.1] bg-[#10203c]/70 p-3">
                  <p className="text-xs font-semibold text-slate-200">Focused Composition · {selectedPage.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={candidateBlockId}
                      onChange={(event) => setCandidateBlockId(event.target.value)}
                      className="min-w-[240px] rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200"
                    >
                      {blocks.map((block) => (
                        <option key={`focus-candidate-${block.id}`} value={block.id}>
                          {block.name} ({block.family})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => addBlockToPage(candidateBlockId)}
                      className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Add Block
                    </button>
                  </div>
                </div>

                <PreviewPane
                  title="Focused Canvas"
                  badge="focus"
                  srcDoc={visiblePreviewHtml}
                  minHeight="760px"
                  testId="pages-focus-preview"
                />
              </div>
            </main>
          </div>
        </div>
      ) : null}

      {focusMode === "full-screen" && selectedPage ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#020a19]">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-100">LMNAs Studio</p>
                <p className="text-[11px] text-slate-500">Full-screen Focus · {selectedPage.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFocusMode("page-focus");
                  setShowPanelsInFocus(true);
                }}
                className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
              >
                Show Panels
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void persistSelectedPage("save")}
                className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => void persistSelectedPage("apply")}
                className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Preview Page
              </button>
              <button
                type="button"
                onClick={() => setFocusMode("default")}
                className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
              >
                Exit
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-[radial-gradient(#233348_1px,transparent_1px)] [background-size:24px_24px] p-6">
            <div className="mx-auto max-w-[1100px]">
              <PreviewPane title="Full-screen Page Canvas" badge="focus" srcDoc={visiblePreviewHtml} minHeight="920px" />
            </div>
          </div>
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/[0.12] bg-[#0f1d36]/95 px-4 py-3">
            <span className="material-symbols-outlined text-slate-300">add</span>
            <span className="material-symbols-outlined text-slate-300">layers</span>
            <span className="material-symbols-outlined text-slate-300">title</span>
            <span className="material-symbols-outlined text-slate-300">image</span>
            <button
              type="button"
              onClick={() => void persistSelectedPage("apply")}
              className="rounded-lg bg-blue-500 px-3 py-1.5 text-[11px] font-bold text-white"
            >
              Publish
            </button>
          </div>
          <div className="absolute bottom-6 right-6 flex items-center gap-1 rounded-xl border border-white/[0.12] bg-[#0f1d36]/95 px-2 py-1">
            <span className="material-symbols-outlined text-slate-400">remove</span>
            <span className="px-2 text-xs font-semibold text-slate-300">100%</span>
            <span className="material-symbols-outlined text-slate-400">add</span>
          </div>
        </div>
      ) : null}

      <div
        className={`grid gap-5 ${
          focusMode === "page-focus" && !showPanelsInFocus ? "grid-cols-1" : "lg:grid-cols-[320px_1fr]"
        }`}
      >
        {(focusMode !== "page-focus" || showPanelsInFocus) ? (
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
        ) : null}

        <div className="flex flex-col gap-5">
          <StudioDetailContainer
            testId="pages-detail-container"
            title={selectedPage ? selectedPage.name : "Page Detail"}
            description={selectedPage ? "Compose blocks and govern page metadata before publish." : "Select a page to edit composition."}
            isEmpty={!selectedPage}
            emptyTitle="No page selected"
            emptyDescription="Pick a page from the list or create a new draft page from actions."
          >
            {selectedPage ? (
              <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
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
                          className={`rounded px-2 py-1 text-[11px] ${
                            previewMode === "production" ? "bg-emerald-500/20 text-emerald-200" : "text-slate-400"
                          }`}
                        >
                          Production
                        </button>
                      </div>
                    </div>

                    <PreviewPane
                      title="Page Preview"
                      badge={previewMode === "draft" ? "draft" : "production"}
                      srcDoc={visiblePreviewHtml}
                      minHeight={focusMode === "page-focus" ? "620px" : "420px"}
                      testId="pages-preview-frame"
                    />
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-xs font-semibold text-slate-300">Governed Full-Page HTML Import</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Paste full-page HTML (for example from docs/testing-artifacts/code.html) to extract reusable sections.
                    </p>
                    <textarea
                      data-testid="pages-import-html-input"
                      value={importHtml}
                      onChange={(event) => setImportHtml(event.target.value)}
                      className="mt-3 min-h-[150px] w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-slate-200"
                      placeholder="Paste full-page HTML here"
                    />
                  </div>
                </div>

                {(focusMode !== "page-focus" || showPanelsInFocus) ? (
                  <aside className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Update Strategy</p>
                      <div className="mt-2 grid gap-2">
                        <button type="button" className="rounded border border-blue-500/35 bg-blue-500/[0.12] px-2 py-1 text-left text-[11px] text-blue-200">
                          Page Only
                        </button>
                        <button type="button" className="rounded border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-left text-[11px] text-slate-400">
                          Global Sync
                        </button>
                      </div>
                    </div>

                    <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                      Product Mapping
                      <input
                        value={selectedPage.productMapping}
                        onChange={(event) =>
                          patchSelectedPage((page) => ({
                            ...page,
                            productMapping: event.target.value,
                            updatedAt: new Date().toISOString().slice(0, 10)
                          }))
                        }
                        className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                        placeholder="Product key"
                      />
                    </label>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Industry Mapping</p>
                      <div className="flex flex-wrap gap-1.5">
                        {industryOptions.map((industry) => {
                          const active = selectedPage.industryMapping.includes(industry);
                          return (
                            <button
                              key={industry}
                              type="button"
                              onClick={() => toggleIndustry(industry)}
                              className={`rounded px-2 py-1 text-[10px] font-semibold uppercase ${
                                active ? "bg-blue-500/20 text-blue-200" : "bg-white/[0.04] text-slate-400"
                              }`}
                            >
                              {industry}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                        Primary CTA Text
                        <input
                          value={selectedPage.primaryCta.text}
                          onChange={(event) =>
                            patchSelectedPage((page) => ({
                              ...page,
                              primaryCta: {
                                ...page.primaryCta,
                                text: event.target.value
                              },
                              updatedAt: new Date().toISOString().slice(0, 10)
                            }))
                          }
                          className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                        Primary CTA URL
                        <input
                          value={selectedPage.primaryCta.url}
                          onChange={(event) =>
                            patchSelectedPage((page) => ({
                              ...page,
                              primaryCta: {
                                ...page.primaryCta,
                                url: event.target.value
                              },
                              updatedAt: new Date().toISOString().slice(0, 10)
                            }))
                          }
                          className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                        />
                      </label>
                    </div>

                    <div className="grid gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Conversion Configuration</p>
                      <label className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-[11px] text-slate-300">
                        <span>Track conversions</span>
                        <input
                          type="checkbox"
                          checked={selectedPage.conversionConfig.trackConversions}
                          onChange={(event) =>
                            patchSelectedPage((page) => ({
                              ...page,
                              conversionConfig: {
                                ...page.conversionConfig,
                                trackConversions: event.target.checked
                              },
                              updatedAt: new Date().toISOString().slice(0, 10)
                            }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                        Strategy
                        <input
                          value={selectedPage.conversionConfig.strategy}
                          onChange={(event) =>
                            patchSelectedPage((page) => ({
                              ...page,
                              conversionConfig: {
                                ...page.conversionConfig,
                                strategy: event.target.value
                              },
                              updatedAt: new Date().toISOString().slice(0, 10)
                            }))
                          }
                          className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                        Value Points
                        <input
                          type="number"
                          value={selectedPage.conversionConfig.valuePoints}
                          onChange={(event) =>
                            patchSelectedPage((page) => ({
                              ...page,
                              conversionConfig: {
                                ...page.conversionConfig,
                                valuePoints: Number(event.target.value) || 0
                              },
                              updatedAt: new Date().toISOString().slice(0, 10)
                            }))
                          }
                          className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                        />
                      </label>
                    </div>

                    <div className="grid gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Campaign / UTM Strategy</p>
                      <input
                        value={selectedPage.campaignUtmStrategy.source}
                        onChange={(event) =>
                          patchSelectedPage((page) => ({
                            ...page,
                            campaignUtmStrategy: {
                              ...page.campaignUtmStrategy,
                              source: event.target.value
                            },
                            updatedAt: new Date().toISOString().slice(0, 10)
                          }))
                        }
                        className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                        placeholder="utm_source"
                      />
                      <input
                        value={selectedPage.campaignUtmStrategy.medium}
                        onChange={(event) =>
                          patchSelectedPage((page) => ({
                            ...page,
                            campaignUtmStrategy: {
                              ...page.campaignUtmStrategy,
                              medium: event.target.value
                            },
                            updatedAt: new Date().toISOString().slice(0, 10)
                          }))
                        }
                        className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                        placeholder="utm_medium"
                      />
                      <input
                        value={selectedPage.campaignUtmStrategy.campaign}
                        onChange={(event) =>
                          patchSelectedPage((page) => ({
                            ...page,
                            campaignUtmStrategy: {
                              ...page.campaignUtmStrategy,
                              campaign: event.target.value
                            },
                            updatedAt: new Date().toISOString().slice(0, 10)
                          }))
                        }
                        className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                        placeholder="utm_campaign"
                      />
                    </div>

                    <div className="grid gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Taxonomy</p>
                      <label className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-[11px] text-slate-300">
                        <span>Taxonomy valid</span>
                        <input
                          type="checkbox"
                          checked={selectedPage.taxonomyState.valid}
                          onChange={(event) =>
                            patchSelectedPage((page) => ({
                              ...page,
                              taxonomyState: {
                                ...page.taxonomyState,
                                valid: event.target.checked
                              },
                              updatedAt: new Date().toISOString().slice(0, 10)
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="grid gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SEO / Metadata</p>
                      <input
                        value={selectedPage.seoMetadata.metaTitle}
                        onChange={(event) =>
                          patchSelectedPage((page) => ({
                            ...page,
                            seoMetadata: {
                              ...page.seoMetadata,
                              metaTitle: event.target.value
                            },
                            updatedAt: new Date().toISOString().slice(0, 10)
                          }))
                        }
                        className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                        placeholder="Meta title"
                      />
                      <textarea
                        value={selectedPage.seoMetadata.metaDescription}
                        onChange={(event) =>
                          patchSelectedPage((page) => ({
                            ...page,
                            seoMetadata: {
                              ...page.seoMetadata,
                              metaDescription: event.target.value
                            },
                            updatedAt: new Date().toISOString().slice(0, 10)
                          }))
                        }
                        className="min-h-[72px] rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                        placeholder="Meta description"
                      />
                    </div>

                    <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                      Shell Selection
                      <select
                        value={selectedPage.shellKey ?? ""}
                        onChange={(event) =>
                          patchSelectedPage((page) => ({
                            ...page,
                            shellKey: event.target.value || undefined,
                            activeShellId: event.target.value || undefined,
                            updatedAt: new Date().toISOString().slice(0, 10)
                          }))
                        }
                        className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                      >
                        <option value="">Select shell</option>
                        {shellOptions.map((shell) => (
                          <option key={shell.id} value={shell.key}>
                            {shell.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Readiness</p>
                      <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                        <p>Preview valid: {selectedPage.previewValid ? "yes" : "no"}</p>
                        <p>Block schema valid: {selectedPage.blockSchemaValid ? "yes" : "no"}</p>
                        <p>SEO / JSON-LD valid: {selectedPage.seoJsonLdValid ? "yes" : "no"}</p>
                      </div>
                    </div>
                  </aside>
                ) : null}
              </div>
            ) : null}
          </StudioDetailContainer>

          {focusMode !== "page-focus" ? (
            <StudioActionMenu
              testId="pages-action-container"
              title="Page Actions"
              description="Run draft save, compile, and section import operations from one shared workflow menu."
              items={pageActions}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
