"use client";

import type { OnboardingAnalysis, OnboardingSourceType } from "@lmnas/contracts";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { PreviewPane } from "../_components/PreviewPane";
import { requestClientJson } from "../_lib/client-request";
import { setPreviewSwatchThemeId as setGlobalPreviewSwatchThemeId } from "../_lib/preview-swatch-state";
import type { StudioShell, StudioTheme } from "../_lib/studio-types";

type SourceTab = "figma" | "url" | "html";

type AnalyzeResponse = {
  ok: boolean;
  analysis?: OnboardingAnalysis;
  error?: string;
};

function resolveSourceType(tab: SourceTab): OnboardingSourceType {
  if (tab === "url") {
    return "url";
  }
  if (tab === "figma") {
    return "figma_full_page";
  }
  return "raw_html";
}

export default function ImportWorkflowPage(): React.ReactElement {
  const [themes, setThemes] = useState<StudioTheme[]>([]);
  const [shells, setShells] = useState<StudioShell[]>([]);
  const [sourceTab, setSourceTab] = useState<SourceTab>("html");
  const [sourceValue, setSourceValue] = useState("");
  const [figmaToken, setFigmaToken] = useState("");
  const [selectedThemeKey, setSelectedThemeKey] = useState("default");
  const [selectedShellKey, setSelectedShellKey] = useState("");
  const [importMode, setImportMode] = useState<"page" | "blocks">("blocks");
  const [deepScanning, setDeepScanning] = useState(true);
  const [extractAssets, setExtractAssets] = useState(true);
  const [smartNaming, setSmartNaming] = useState(true);
  const [previewSwatchThemeId, setPreviewSwatchThemeId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null);
  const [selectedBlocks, setSelectedBlocks] = useState<Record<string, boolean>>({});
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const blockProposals = analysis?.blockProposals ?? [];
  const selectedCount = useMemo(
    () => blockProposals.filter((block) => selectedBlocks[block.id] !== false).length,
    [blockProposals, selectedBlocks]
  );

  useEffect(() => {
    void (async () => {
      setIsLoadingContext(true);
      setError(null);
      try {
        const [themesPayload, shellsPayload] = await Promise.all([
          requestClientJson<{ ok: boolean; data?: StudioTheme[]; error?: string }>(
            "/api/platform/studio/themes",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading themes timed out. Please retry.",
              fallbackErrorMessage: "Unable to load theme presets."
            }
          ),
          requestClientJson<{ ok: boolean; data?: StudioShell[]; error?: string }>(
            "/api/platform/studio/shells",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading shells timed out. Please retry.",
              fallbackErrorMessage: "Unable to load shell presets."
            }
          )
        ]);

        if (!themesPayload.ok || !Array.isArray(themesPayload.data)) {
          throw new Error(themesPayload.error ?? "Unable to load theme presets.");
        }
        if (!shellsPayload.ok || !Array.isArray(shellsPayload.data)) {
          throw new Error(shellsPayload.error ?? "Unable to load shell presets.");
        }

        const loadedThemes = themesPayload.data;
        const loadedShells = shellsPayload.data;
        setThemes(loadedThemes);
        setShells(loadedShells);

        const activeTheme = loadedThemes.find((theme) => theme.status === "active") ?? loadedThemes[0] ?? null;
        const activeShell = loadedShells.find((shell) => shell.status === "active") ?? loadedShells[0] ?? null;
        if (activeTheme) {
          setSelectedThemeKey(activeTheme.themeKey);
          setPreviewSwatchThemeId(activeTheme.id);
        }
        if (activeShell) {
          setSelectedShellKey(activeShell.key);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        setIsLoadingContext(false);
      }
    })();
  }, []);

  useEffect(() => {
    setGlobalPreviewSwatchThemeId(previewSwatchThemeId);
  }, [previewSwatchThemeId]);

  async function processSource(): Promise<void> {
    if (sourceValue.trim().length === 0) {
      setError("Provide source input before processing.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStatusMessage(null);

    try {
      const payload = await requestClientJson<AnalyzeResponse>(
        "/api/platform/onboarding/analyze",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceType: resolveSourceType(sourceTab),
            sourceValue,
            slug: "import-source",
            locale: "en",
            themeKey: selectedThemeKey,
            shellKey: selectedShellKey,
            importMode,
            extractionSettings: {
              deepScanning,
              extractAssets,
              smartNaming,
              figmaToken: sourceTab === "figma" ? figmaToken : undefined
            }
          })
        },
        {
          timeoutMessage: "Import analysis timed out. Please retry.",
          fallbackErrorMessage: "Unable to analyze source import."
        }
      );

      if (!payload.ok || !payload.analysis) {
        throw new Error(payload.error ?? "Unable to analyze source import.");
      }

      setAnalysis(payload.analysis);
      const nextSelection: Record<string, boolean> = {};
      payload.analysis.blockProposals.forEach((block) => {
        nextSelection[block.id] = true;
      });
      setSelectedBlocks(nextSelection);
      setStatusMessage(`Detected ${payload.analysis.blockProposals.length} block candidate(s). Review and import governed blocks.`);
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : String(analyzeError));
    } finally {
      setIsProcessing(false);
    }
  }

  async function importSelectedAsGovernedBlocks(): Promise<void> {
    if (!analysis) {
      setError("Run source processing before importing blocks.");
      return;
    }

    setIsImporting(true);
    setError(null);
    setStatusMessage(null);

    try {
      const payload = await requestClientJson<{
        ok: boolean;
        result?: {
          applied: boolean;
          summary: { blocksToCreate: number };
          warnings: Array<{ message: string; severity: string }>;
        };
        error?: string;
      }>(
        "/api/platform/studio/blocks/publish",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            analysis,
            mode: "apply",
            overrides: {
              itemImportState: selectedBlocks
            }
          })
        },
        {
          timeoutMessage: "Governed block import timed out. Please retry.",
          fallbackErrorMessage: "Unable to import governed blocks."
        }
      );

      if (!payload.ok || !payload.result) {
        throw new Error(payload.error ?? "Unable to import governed blocks.");
      }

      let pageImportMessage = "";
      if (importMode === "page") {
        const importHtml = analysis.source.referencePreviewHtml || sourceValue;
        const blocksOnlyPayload = await requestClientJson<{
          ok: boolean;
          data?: {
            importedBlocks?: Array<{ key: string }>;
            blockCount?: number;
          };
          error?: string;
        }>(
          "/api/platform/studio/pages",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              mode: "import-blocks",
              html: importHtml,
              sourceRef: `studio-import-${sourceTab}`
            })
          },
          {
            timeoutMessage: "Page import stage timed out. Please retry.",
            fallbackErrorMessage: "Unable to import page blocks."
          }
        );

        if (!blocksOnlyPayload.ok || !blocksOnlyPayload.data) {
          throw new Error(blocksOnlyPayload.error ?? "Unable to import page blocks.");
        }

        const importedBlockKeys = Array.isArray(blocksOnlyPayload.data.importedBlocks)
          ? blocksOnlyPayload.data.importedBlocks.map((block) => block.key).filter((key) => key.length > 0)
          : [];

        const pageSeed = Date.now();
        const pageId = `import-page-${pageSeed}`;
        const pageSlug = `import-${pageSeed}`;
        const pageSavePayload = await requestClientJson<{
          ok: boolean;
          data?: {
            page?: { id: string; slug: string };
          };
          error?: string;
        }>(
          "/api/platform/studio/pages",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              mode: "save",
              page: {
                id: pageId,
                name: "Imported Source Page",
                slug: pageSlug,
                locale: "en",
                activeShellId: selectedShellKey || undefined,
                shellKey: selectedShellKey || undefined,
                lifecycle: "draft",
                status: "draft",
                blockOrder: importedBlockKeys,
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
              }
            })
          },
          {
            timeoutMessage: "Creating imported page timed out. Please retry.",
            fallbackErrorMessage: "Unable to create imported page."
          }
        );

        if (!pageSavePayload.ok || !pageSavePayload.data?.page) {
          throw new Error(pageSavePayload.error ?? "Unable to create imported page.");
        }

        pageImportMessage = ` Draft page created: ${pageSavePayload.data.page.slug}.`;
      }

      const warningCount = payload.result.warnings.length;
      setStatusMessage(
        payload.result.applied
          ? `Imported ${selectedCount} governed block(s). Warnings: ${warningCount}.${pageImportMessage}`
          : `Import completed with no apply. Warnings: ${warningCount}.${pageImportMessage}`
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setIsImporting(false);
    }
  }

  function toggleAll(nextValue: boolean): void {
    const next: Record<string, boolean> = {};
    blockProposals.forEach((block) => {
      next[block.id] = nextValue;
    });
    setSelectedBlocks(next);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1420px] flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Import Content</h1>
          <p className="mt-1 text-xs text-slate-500">
            Step 1: identify or create Theme/Shell. Step 2: detect, compare, and persist governed blocks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/[0.12] px-3 py-1 text-[11px] font-semibold text-emerald-300">
            Ready to process
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-2 py-1">
            {themes.slice(0, 4).map((theme) => {
              const activeSwatch = previewSwatchThemeId === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setPreviewSwatchThemeId(activeSwatch ? null : theme.id)}
                  className={`h-5 w-5 rounded-full border ${
                    activeSwatch ? "border-blue-300 ring-2 ring-blue-500/40" : "border-white/25"
                  }`}
                  style={{ backgroundColor: theme.darkMode ? "#1162d4" : "#64748b" }}
                  title={`Preview swatch: ${theme.name}`}
                />
              );
            })}
          </div>
          <button
            data-testid="import-process-source"
            type="button"
            onClick={() => {
              void processSource();
            }}
            disabled={isProcessing || isLoadingContext}
            className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {isProcessing ? "Processing…" : "Process Source"}
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

      <div className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
              {([
                ["figma", "Figma"],
                ["url", "URL"],
                ["html", "HTML"]
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSourceTab(key)}
                  className={`flex-1 rounded px-2 py-1.5 text-[11px] font-semibold ${
                    sourceTab === key ? "bg-blue-500/20 text-blue-200" : "text-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {sourceTab === "figma" ? (
                <>
                  <input
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-100"
                    placeholder="https://figma.com/file/..."
                    value={sourceValue}
                    onChange={(event) => setSourceValue(event.target.value)}
                  />
                  <input
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-100"
                    type="password"
                    placeholder="Personal access token"
                    value={figmaToken}
                    onChange={(event) => setFigmaToken(event.target.value)}
                  />
                </>
              ) : sourceTab === "url" ? (
                <input
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-100"
                  placeholder="https://example.com/landing"
                  value={sourceValue}
                  onChange={(event) => setSourceValue(event.target.value)}
                />
              ) : (
                <textarea
                  data-testid="import-source-input"
                  className="min-h-[180px] w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-[11px] text-slate-100"
                  placeholder="<section>...</section>"
                  value={sourceValue}
                  onChange={(event) => setSourceValue(event.target.value)}
                />
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="text-xs font-semibold text-slate-300">Extraction Settings</p>
            <div className="mt-2 grid gap-2">
              <label className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-[11px] text-slate-300">
                <span>Deep scanning</span>
                <input type="checkbox" checked={deepScanning} onChange={(event) => setDeepScanning(event.target.checked)} />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-[11px] text-slate-300">
                <span>Extract assets</span>
                <input type="checkbox" checked={extractAssets} onChange={(event) => setExtractAssets(event.target.checked)} />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-[11px] text-slate-300">
                <span>Smart naming</span>
                <input type="checkbox" checked={smartNaming} onChange={(event) => setSmartNaming(event.target.checked)} />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="text-xs font-semibold text-slate-300">Step 1 · Theme &amp; Shell Identification</p>
            <div className="mt-2 grid gap-2">
              <label className="text-[11px] text-slate-400">
                Target Theme
                <select
                  className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-100"
                  value={selectedThemeKey}
                  onChange={(event) => {
                    const nextThemeKey = event.target.value;
                    setSelectedThemeKey(nextThemeKey);
                    const matchedTheme = themes.find((theme) => theme.themeKey === nextThemeKey);
                    setPreviewSwatchThemeId(matchedTheme?.id ?? null);
                  }}
                >
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.themeKey}>
                      {theme.name} ({theme.themeKey})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[11px] text-slate-400">
                Target Shell
                <select
                  className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-100"
                  value={selectedShellKey}
                  onChange={(event) => setSelectedShellKey(event.target.value)}
                >
                  {shells.map((shell) => (
                    <option key={shell.id} value={shell.key}>
                      {shell.name} ({shell.role})
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <p className="text-[11px] text-slate-400">Import Mode</p>
                <div className="mt-1 flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
                  <button
                    type="button"
                    onClick={() => setImportMode("page")}
                    className={`flex-1 rounded px-2 py-1 text-[11px] ${importMode === "page" ? "bg-white/[0.08] text-slate-200" : "text-slate-500"}`}
                  >
                    As Page
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode("blocks")}
                    className={`flex-1 rounded px-2 py-1 text-[11px] ${importMode === "blocks" ? "bg-blue-500/20 text-blue-200" : "text-slate-500"}`}
                  >
                    As Blocks
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-2">
              <p className="text-[11px] text-slate-500">Need a new preset before import?</p>
              <Link href="/platform/onboarding/theme" className="text-[11px] font-semibold text-blue-300 hover:text-blue-200">
                Open Theme &amp; Shell Studio
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-3">
            <p className="text-xs font-semibold text-blue-200">Import Summary</p>
            <div className="mt-2 space-y-1 text-[11px] text-slate-300">
              <p>Blocks detected: {blockProposals.length}</p>
              <p>Selected for import: {selectedCount}</p>
              <p>Target theme: {selectedThemeKey || "n/a"}</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-100">Step 2 · Proposed Blocks</h2>
                <p className="text-[11px] text-slate-500">Detect, review, compare, and import governed reusable blocks.</p>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button type="button" onClick={() => toggleAll(true)} className="text-slate-400 hover:text-slate-200">
                  Accept All
                </button>
                <span className="text-slate-600">|</span>
                <button type="button" onClick={() => toggleAll(false)} className="text-slate-400 hover:text-slate-200">
                  Discard All
                </button>
              </div>
            </div>

            {blockProposals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.12] px-4 py-8 text-center text-xs text-slate-500">
                Process source to detect block candidates.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {blockProposals.map((block) => {
                  const included = selectedBlocks[block.id] !== false;
                  return (
                    <article
                      key={block.id}
                      className={`rounded-lg border p-2 ${included ? "border-blue-500/30 bg-blue-500/[0.06]" : "border-white/[0.08] bg-white/[0.02]"}`}
                    >
                      <div className="mb-2 h-24 overflow-hidden rounded border border-white/[0.08] bg-[#020617]">
                        <div className="line-clamp-4 px-2 py-2 text-[10px] text-slate-400">{block.rawHtmlSnippet}</div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-200">{block.displayName ?? block.family}</p>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">{block.family}</p>
                        <p className="text-[10px] text-slate-400">Fidelity {Math.round(block.confidence * 100)}%</p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedBlocks((prev) => ({ ...prev, [block.id]: !included }))}
                          className={`flex-1 rounded px-2 py-1 text-[11px] font-semibold ${
                            included ? "bg-blue-500 text-white" : "border border-white/[0.12] text-slate-400"
                          }`}
                        >
                          {included ? "Accepted" : "Accept"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex items-center justify-end">
              <button
                data-testid="import-publish-selected"
                type="button"
                onClick={() => {
                  void importSelectedAsGovernedBlocks();
                }}
                disabled={!analysis || selectedCount === 0 || isImporting}
                className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {isImporting ? "Importing…" : importMode === "page" ? "Import Blocks + Create Page" : "Import Selected Blocks"}
              </button>
            </div>
          </div>

          {analysis ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                <p className="text-xs font-semibold text-slate-300">Source vs Target Comparison</p>
                <div className="flex items-center gap-1">
                  {themes.slice(0, 4).map((theme) => {
                    const selected = previewSwatchThemeId === theme.id;
                    return (
                      <button
                        key={`compare-${theme.id}`}
                        type="button"
                        onClick={() => setPreviewSwatchThemeId(selected ? null : theme.id)}
                        className={`h-5 w-5 rounded-full border ${selected ? "border-blue-300 ring-2 ring-blue-500/40" : "border-white/25"}`}
                        style={{ backgroundColor: theme.darkMode ? "#1162d4" : "#64748b" }}
                        title={`Compare using ${theme.name}`}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <PreviewPane
                  title="Source (Reference Theme)"
                  badge="source"
                  srcDoc={analysis.source.referencePreviewHtml}
                  minHeight="360px"
                  testId="import-source-preview"
                />
                <PreviewPane
                  title="Target (Selected Theme)"
                  badge="target"
                  srcDoc={analysis.source.productionPreviewHtml}
                  minHeight="360px"
                  testId="import-target-preview"
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
