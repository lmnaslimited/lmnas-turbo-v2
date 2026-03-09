"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildDetectionThumbnailDocument,
  buildFinalAssemblyPreviewDocument
} from "@lmnas/integrations/onboarding/preview-renderer";
import type {
  ActionType,
  CanonicalBlockFamily,
  OnboardingActionProposal,
  OnboardingAnalysis,
  OnboardingBlockProposal,
  OnboardingItemType,
  OnboardingPublishResult,
  OnboardingShellCandidate,
  OnboardingSourceType,
  OnboardingWidgetProposal,
  SegmentationMode
} from "@lmnas/contracts";

/* ─── Project Styles: inject the host page's compiled Tailwind CSS into preview iframes ─── */

function useProjectStyles(): string {
  const [styles, setStyles] = useState("");

  useEffect(() => {
    const parts: string[] = [];
    const origin = window.location.origin;

    // Collect <link rel="stylesheet"> tags (production builds)
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((link) => {
      const href = link.getAttribute("href");
      if (href) {
        const abs = href.startsWith("/") ? `${origin}${href}` : href;
        parts.push(`<link rel="stylesheet" href="${abs}">`);
      }
    });

    // Collect <style> tags injected by Next.js HMR (dev mode)
    document.querySelectorAll<HTMLStyleElement>("style").forEach((el) => {
      const text = el.textContent;
      if (text && text.length > 50) {
        parts.push(`<style>${text}</style>`);
      }
    });

    setStyles(parts.join("\n"));
  }, []);

  return styles;
}

function injectProjectStyles(html: string, projectStyles: string): string {
  if (!html || !projectStyles) return html;

  let result = html;

  // Strip Tailwind CDN <script> tags
  result = result.replace(/<script\b[^>]*src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>\s*<\/script>/gi, "");

  // Strip inline tailwind.config scripts
  result = result.replace(/<script\b[^>]*id=["']tailwind-config["'][^>]*>[\s\S]*?<\/script>/gi, "");
  result = result.replace(/<script\b[^>]*>[\s\S]*?tailwind\.config\s*=[\s\S]*?<\/script>/gi, "");

  // Inject project styles into <head>
  if (/<head[^>]*>/i.test(result)) {
    result = result.replace(/<head([^>]*)>/i, `<head$1>${projectStyles}`);
  } else if (/<html[^>]*>/i.test(result)) {
    result = result.replace(/<html([^>]*)>/i, `<html$1><head>${projectStyles}</head>`);
  } else {
    result = `<html><head>${projectStyles}</head><body>${result}</body></html>`;
  }

  return result;
}

const SOURCE_TYPES: Array<{ value: OnboardingSourceType; label: string; hint: string }> = [
  { value: "url", label: "Website URL", hint: "Paste a live page URL" },
  { value: "raw_html", label: "Raw HTML", hint: "Paste section or full-page HTML" },
  { value: "figma_section", label: "Figma Section", hint: "Paste Figma handoff snippet" },
  { value: "figma_full_page", label: "Figma Full Page", hint: "Paste full-page handoff artifact" },
  { value: "stitch_section", label: "Stitch Section", hint: "Paste Stitch export for one section" },
  { value: "stitch_full_page", label: "Stitch Full Page", hint: "Paste Stitch full-page export" }
];

const BLOCK_FAMILIES: CanonicalBlockFamily[] = [
  "hero",
  "logo_wall",
  "problem_grid",
  "feature_grid",
  "testimonial_list",
  "stats_band",
  "process_steps",
  "cta_banner",
  "faq",
  "rich_text_section",
  "comparison_table",
  "pricing_teaser",
  "contact_strip",
  "authority_section",
  "case_highlight",
  "timeline",
  "split_content_media",
  "form_section",
  "embedded_asset_section"
];

const ACTION_TYPE_OPTIONS: Array<{ value: ActionType; label: string }> = [
  { value: "link_url", label: "Link to page / URL" },
  { value: "scroll_to_section", label: "Scroll to section" },
  { value: "open_modal", label: "Open modal" },
  { value: "open_drawer", label: "Open drawer" },
  { value: "open_widget", label: "Open widget" },
  { value: "submit_form", label: "Submit form" },
  { value: "download_asset", label: "Download asset" },
  { value: "external_booking", label: "Open external booking" },
  { value: "workflow", label: "Trigger backend workflow" }
];

const ITEM_TYPE_OPTIONS: OnboardingItemType[] = ["shell", "block", "widget", "action", "exit"];
const SEGMENTATION_OPTIONS: SegmentationMode[] = ["keep", "split", "merge"];
const VIEWPORT_OPTIONS = [
  { key: "desktop", label: "Desktop", width: 1220 },
  { key: "tablet", label: "Tablet", width: 820 },
  { key: "mobile", label: "Mobile", width: 430 }
] as const;

const STEPS = [
  "Source Intake",
  "Source Preview",
  "Detection Review",
  "Selection & Mapping",
  "Action Mapping",
  "Publish Summary"
] as const;

type IntakeFormState = {
  sourceType: OnboardingSourceType;
  sourceValue: string;
  slug: string;
  locale: string;
  themeKey: string;
};

type ActionTargetOverride = {
  url?: string;
  sectionId?: string;
  widgetId?: string;
  exitId?: string;
};

type DetectableItem = {
  id: string;
  type: "shell" | "block" | "widget" | "action";
  label: string;
  previewHtml?: string;
  previewSelector?: string;
  confidence: number;
};

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function parseFieldCsv(input: string): string[] {
  return dedupeStrings(
    input
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  );
}

function chipStyleForType(type: string): string {
  const base = "inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 border";
  if (type === "shell") return `${base} bg-lmnas-shell-bg border-lmnas-accent/20 text-lmnas-accent-bright`;
  if (type === "block") return `${base} bg-lmnas-block-bg border-lmnas-purple/20 text-lmnas-purple`;
  if (type === "widget") return `${base} bg-lmnas-widget-bg border-lmnas-emerald/20 text-lmnas-emerald`;
  if (type === "action") return `${base} bg-lmnas-action-bg border-lmnas-amber/20 text-lmnas-amber`;
  return `${base} bg-lmnas-accent-soft border-lmnas-border text-lmnas-text-secondary`;
}

function buildDetectableItems(analysis: OnboardingAnalysis | null): DetectableItem[] {
  if (!analysis) {
    return [];
  }

  const shells = analysis.shellCandidates.map((item) => ({
    id: item.id,
    type: "shell" as const,
    label: item.displayName ?? item.id,
    previewHtml: item.previewHtml,
    previewSelector: item.previewSelector,
    confidence: item.confidence
  }));

  const blocks = analysis.blockProposals.map((item) => ({
    id: item.id,
    type: "block" as const,
    label: item.displayName ?? item.id,
    previewHtml: item.previewHtml,
    previewSelector: item.previewSelector,
    confidence: item.confidence
  }));

  const widgets = analysis.widgetProposals.map((item) => ({
    id: item.id,
    type: "widget" as const,
    label: item.displayName ?? item.name,
    previewHtml: item.previewHtml,
    previewSelector: item.previewSelector,
    confidence: item.confidence
  }));

  const actions = analysis.actionProposals.map((item) => ({
    id: item.id,
    type: "action" as const,
    label: item.displayName ?? item.label,
    previewHtml: item.previewHtml,
    previewSelector: item.previewSelector,
    confidence: item.confidence
  }));

  return [...shells, ...blocks, ...widgets, ...actions];
}

function mergeDisplayName<T extends { id: string; displayName?: string }>(item: T, overrides: Record<string, string>): T {
  return {
    ...item,
    displayName: overrides[item.id] ?? item.displayName
  };
}

function buildFinalAssemblyPreview(params: {
  analysis: OnboardingAnalysis | null;
  itemImportState: Record<string, boolean>;
  displayNameOverrides: Record<string, string>;
}): string {
  if (!params.analysis) {
    return "";
  }

  const shells = params.analysis.shellCandidates
    .filter((item) => params.itemImportState[item.id] !== false)
    .map((item) => mergeDisplayName(item, params.displayNameOverrides));
  const blocks = params.analysis.blockProposals
    .filter((item) => params.itemImportState[item.id] !== false)
    .map((item) => mergeDisplayName(item, params.displayNameOverrides));
  const widgets = params.analysis.widgetProposals
    .filter((item) => params.itemImportState[item.id] !== false)
    .map((item) => mergeDisplayName(item, params.displayNameOverrides));
  const actions = params.analysis.actionProposals
    .filter((item) => params.itemImportState[item.id] !== false)
    .map((item) => mergeDisplayName(item, params.displayNameOverrides));

  return buildFinalAssemblyPreviewDocument({
    sourcePreviewHtml: params.analysis.source.productionPreviewHtml,
    baseUrl: params.analysis.source.baseUrl,
    themeScopeClass: params.analysis.source.themeScopeClass,
    shellCandidates: shells,
    blockProposals: blocks,
    widgetProposals: widgets,
    actionProposals: actions
  });
}

export function OnboardingConsole() {
  const projectStyles = useProjectStyles();
  const [step, setStep] = useState(0);
  const [intake, setIntake] = useState<IntakeFormState>({
    sourceType: "raw_html",
    sourceValue:
      "<style>.hero{padding:48px 32px;background:#0f172a;color:#f8fafc;border-radius:18px}.hero a{display:inline-block;margin-top:10px;background:#0b66ff;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none}.faq{margin-top:16px;padding:18px;border:1px solid #d1dbe8;border-radius:14px}</style><header><nav><a href='/products'>Products</a><a href='/contact'>Contact</a></nav></header><section class='hero'><h1>Build faster with LMNAs</h1><p>Launch governed pages in minutes.</p><a href='/book'>Book Appointment</a></section><section class='faq'><h2>FAQ</h2><button>Send me the full report</button></section><footer><a href='/privacy'>Privacy</a></footer>",
    slug: "home",
    locale: "en",
    themeKey: "default"
  });

  const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null);
  const [publishResult, setPublishResult] = useState<OnboardingPublishResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceViewport, setSourceViewport] = useState<(typeof VIEWPORT_OPTIONS)[number]["key"]>("desktop");
  const [sourceZoom, setSourceZoom] = useState(100);
  const [previewMode, setPreviewMode] = useState<"reference" | "production" | "difference">("production");
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  const [itemImportState, setItemImportState] = useState<Record<string, boolean>>({});
  const [itemTypeOverrides, setItemTypeOverrides] = useState<Record<string, OnboardingItemType>>({});
  const [displayNameOverrides, setDisplayNameOverrides] = useState<Record<string, string>>({});
  const [mapToExisting, setMapToExisting] = useState<Record<string, string>>({});
  const [blockFamilyOverrides, setBlockFamilyOverrides] = useState<Record<string, CanonicalBlockFamily>>({});
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string[]>>({});
  const [segmentationOverrides, setSegmentationOverrides] = useState<Record<string, SegmentationMode>>({});
  const [actionTypeOverrides, setActionTypeOverrides] = useState<Record<string, ActionType>>({});
  const [actionLabelOverrides, setActionLabelOverrides] = useState<Record<string, string>>({});
  const [actionTargetOverrides, setActionTargetOverrides] = useState<Record<string, ActionTargetOverride>>({});
  const [exitStateOverrides, setExitStateOverrides] = useState<Record<string, "active" | "inactive">>({});

  const sourceFrameRef = useRef<HTMLIFrameElement | null>(null);
  const canAnalyze =
    intake.sourceValue.trim().length > 0 &&
    intake.slug.trim().length > 0 &&
    intake.locale.trim().length > 0;

  const selectedWidgets = useMemo(
    () => analysis?.widgetProposals.filter((widget) => itemImportState[widget.id] !== false) ?? [],
    [analysis, itemImportState]
  );

  const selectedWidgetIds = useMemo(
    () => new Set(selectedWidgets.map((widget) => mapToExisting[widget.id] ?? widget.id)),
    [selectedWidgets, mapToExisting]
  );

  const selectedCounts = useMemo(() => {
    if (!analysis) {
      return {
        shells: 0,
        blocks: 0,
        widgets: 0,
        actions: 0,
        exits: 0
      };
    }

    return {
      shells: analysis.shellCandidates.filter((item) => itemImportState[item.id] !== false).length,
      blocks: analysis.blockProposals.filter((item) => itemImportState[item.id] !== false).length,
      widgets: analysis.widgetProposals.filter((item) => itemImportState[item.id] !== false).length,
      actions: analysis.actionProposals.filter((item) => itemImportState[item.id] !== false).length,
      exits: analysis.exitProposals.filter((item) => itemImportState[item.id] !== false).length
    };
  }, [analysis, itemImportState]);

  const detectableItems = useMemo(() => buildDetectableItems(analysis), [analysis]);
  const assemblyPreviewFromSelection = useMemo(
    () => buildFinalAssemblyPreview({ analysis, itemImportState, displayNameOverrides }),
    [analysis, itemImportState, displayNameOverrides]
  );

  const activeSourceWidth = VIEWPORT_OPTIONS.find((option) => option.key === sourceViewport)?.width ?? VIEWPORT_OPTIONS[0].width;

  function updateIntake<K extends keyof IntakeFormState>(key: K, value: IntakeFormState[K]) {
    setIntake((previous) => ({
      ...previous,
      [key]: value
    }));
  }

  function displayNameFor(item: { id: string; displayName?: string }, fallbackLabel: string): string {
    return displayNameOverrides[item.id] ?? item.displayName ?? fallbackLabel;
  }

  async function importSourceFile(file: File) {
    const text = await file.text();
    setIntake((previous) => ({
      ...previous,
      sourceValue: text
    }));
  }

  function initializeImportToggles(nextAnalysis: OnboardingAnalysis) {
    const toggles: Record<string, boolean> = {};
    [...nextAnalysis.shellCandidates, ...nextAnalysis.blockProposals, ...nextAnalysis.widgetProposals, ...nextAnalysis.actionProposals, ...nextAnalysis.exitProposals].forEach(
      (item) => {
        toggles[item.id] = true;
      }
    );

    setItemImportState(toggles);
  }

  async function runAnalysis() {
    setIsAnalyzing(true);
    setError(null);
    setPublishResult(null);

    try {
      const response = await fetch("/api/platform/onboarding/analyze", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(intake)
      });

      const payload = (await response.json()) as {
        ok: boolean;
        analysis?: OnboardingAnalysis;
        error?: string;
      };

      if (!payload.ok || !payload.analysis) {
        throw new Error(payload.error ?? "Analysis failed");
      }

      setAnalysis(payload.analysis);
      initializeImportToggles(payload.analysis);
      setBlockFamilyOverrides({});
      setDisplayNameOverrides({});
      setFieldOverrides({});
      setSegmentationOverrides({});
      setMapToExisting({});
      setItemTypeOverrides({});
      setActionTypeOverrides({});
      setActionLabelOverrides({});
      setActionTargetOverrides({});
      setExitStateOverrides({});
      setFocusedItemId(null);
      setStep(1);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : String(analysisError));
    } finally {
      setIsAnalyzing(false);
    }
  }

  function setImportState(id: string, importState: boolean) {
    setItemImportState((previous) => ({
      ...previous,
      [id]: importState
    }));
  }

  function setFieldOverrideFromText(id: string, value: string) {
    setFieldOverrides((previous) => ({
      ...previous,
      [id]: parseFieldCsv(value)
    }));
  }

  function setActionTarget(actionId: string, partial: ActionTargetOverride) {
    setActionTargetOverrides((previous) => ({
      ...previous,
      [actionId]: {
        ...previous[actionId],
        ...partial
      }
    }));
  }

  function focusItem(id: string) {
    setFocusedItemId(id);
  }

  async function publish(mode: "dry-run" | "apply") {
    if (!analysis) {
      return;
    }

    setIsPublishing(true);
    setError(null);

    try {
      const response = await fetch("/api/platform/onboarding/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          analysis,
          mode,
          overrides: {
            displayNameOverrides,
            blockFamilyOverrides,
            exitStateOverrides,
            itemImportState,
            itemTypeOverrides,
            fieldOverrides,
            mapToExisting,
            segmentationOverrides,
            actionTypeOverrides,
            actionLabelOverrides,
            actionTargetOverrides
          }
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        result?: OnboardingPublishResult;
        error?: string;
      };

      if (!payload.ok || !payload.result) {
        throw new Error(payload.error ?? "Publish failed");
      }

      setPublishResult(payload.result);
      setStep(5);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : String(publishError));
    } finally {
      setIsPublishing(false);
    }
  }

  function renderCardControls(id: string) {
    const isImporting = itemImportState[id] !== false;
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setImportState(id, true)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${isImporting
            ? "bg-lmnas-accent/15 border border-lmnas-accent/30 text-lmnas-accent-bright"
            : "bg-lmnas-bg-elevated border border-lmnas-border text-lmnas-muted hover:bg-lmnas-panel-hover"
            }`}
        >
          Import
        </button>
        <button
          type="button"
          onClick={() => setImportState(id, false)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${!isImporting
            ? "bg-lmnas-danger-soft border border-lmnas-danger/30 text-lmnas-danger"
            : "bg-lmnas-bg-elevated border border-lmnas-border text-lmnas-muted hover:bg-lmnas-panel-hover"
            }`}
        >
          Skip
        </button>
      </div>
    );
  }

  function buildCardPreview(snippet: string | undefined): string {
    if (!analysis) {
      return "";
    }

    return buildDetectionThumbnailDocument({
      snippetHtml: snippet ?? "<div>No preview</div>",
      sourcePreviewHtml: analysis.source.productionPreviewHtml,
      baseUrl: analysis.source.baseUrl,
      themeScopeClass: analysis.source.themeScopeClass
    });
  }

  function renderSourcePane(title: string) {
    return (
      <article className="rounded-2xl border border-lmnas-border bg-lmnas-bg-elevated overflow-hidden">
        <header className="flex items-center justify-between gap-4 border-b border-lmnas-border px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-lmnas-text">{title}</h3>
            {analysis ? (
              <p className="mt-0.5 text-xs text-lmnas-muted">
                {analysis.source.sourceRef} &middot; Theme: {analysis.source.themeScopeClass}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-lg border border-lmnas-border bg-lmnas-panel p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewMode("reference")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold tracking-wide transition-all ${previewMode === "reference" ? "bg-lmnas-panel-hover text-white shadow-sm" : "text-lmnas-muted hover:text-lmnas-text"
                    }`}
                >
                  Reference Design
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("production")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold tracking-wide transition-all ${previewMode === "production" ? "bg-lmnas-accent text-white shadow-sm" : "text-lmnas-muted hover:text-lmnas-text"
                    }`}
                >
                  Production Render
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("difference")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold tracking-wide transition-all ${previewMode === "difference" ? "bg-lmnas-purple text-white shadow-sm" : "text-lmnas-muted hover:text-lmnas-text"
                    }`}
                >
                  Difference Overlay
                </button>
              </div>
              <div className="inline-flex rounded-lg border border-lmnas-border bg-lmnas-panel overflow-hidden">
                {VIEWPORT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${sourceViewport === option.key
                      ? "bg-lmnas-accent text-white"
                      : "text-lmnas-muted hover:text-lmnas-text hover:bg-lmnas-panel-hover"
                      }`}
                    onClick={() => setSourceViewport(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-lmnas-muted">
              Zoom
              <input
                data-testid="source-zoom-input"
                type="range"
                min={60}
                max={140}
                step={5}
                value={sourceZoom}
                onChange={(event) => setSourceZoom(Number(event.target.value))}
                className="w-24 accent-lmnas-accent"
              />
              <span className="text-lmnas-text-secondary w-8 text-right">{sourceZoom}%</span>
            </label>
          </div>
        </header>
        <div className="overflow-auto bg-lmnas-bg p-3 relative" style={{ maxHeight: "760px" }}>
          <div
            className="relative"
            style={{
              width: `${activeSourceWidth}px`,
              transform: `scale(${sourceZoom / 100})`,
              transformOrigin: "top left"
            }}
          >
            {previewMode === "difference" ? (
              <>
                <iframe
                  ref={sourceFrameRef}
                  className="w-full rounded-xl border border-lmnas-border bg-white relative z-10"
                  style={{ minHeight: "720px", height: "720px" }}
                  srcDoc={analysis?.source.referencePreviewHtml ?? ""}
                  sandbox="allow-scripts allow-same-origin"
                  title="Source preview (Reference)"
                />
                <iframe
                  className="w-full rounded-xl border border-lmnas-border bg-white absolute top-0 left-0 z-20 pointer-events-none mix-blend-difference opacity-70 filter invert"
                  style={{ minHeight: "720px", height: "720px" }}
                  srcDoc={injectProjectStyles(analysis?.source.productionPreviewHtml ?? "", projectStyles)}
                  sandbox="allow-scripts allow-same-origin"
                  title="Source preview (Production)"
                />
              </>
            ) : (
              <iframe
                ref={sourceFrameRef}
                className="w-full rounded-xl border border-lmnas-border bg-white"
                style={{ minHeight: "720px", height: "720px" }}
                srcDoc={
                  previewMode === "reference"
                    ? (analysis?.source.referencePreviewHtml ?? "")
                    : injectProjectStyles(analysis?.source.productionPreviewHtml ?? "", projectStyles)
                }
                sandbox="allow-scripts allow-same-origin"
                title="Source preview"
                data-testid="source-preview-frame"
              />
            )}
          </div>
        </div>
      </article>
    );
  }

  useEffect(() => {
    if (!analysis || !sourceFrameRef.current) {
      return;
    }

    const frame = sourceFrameRef.current;
    let cleanupClick: (() => void) | undefined;

    const annotate = () => {
      const doc = frame.contentDocument;
      if (!doc) {
        return;
      }

      const previous = Array.from(doc.querySelectorAll<HTMLElement>("[data-lmnas-item-id]"));
      previous.forEach((element) => {
        element.classList.remove("lmnas-source-item", "lmnas-source-item-active");
        element.removeAttribute("data-lmnas-item-id");
      });

      detectableItems.forEach((item) => {
        if (!item.previewSelector) {
          return;
        }

        try {
          const element = doc.querySelector<HTMLElement>(item.previewSelector);
          if (!element) {
            return;
          }
          element.dataset.lmnasItemId = item.id;
          element.classList.add("lmnas-source-item");
        } catch {
          // Ignore invalid selectors from imperfect detection.
        }
      });

      const onClick = (event: Event) => {
        const target = event.target as Element | null;
        const matched = target?.closest<HTMLElement>("[data-lmnas-item-id]");
        if (!matched?.dataset.lmnasItemId) {
          return;
        }
        event.preventDefault();
        setFocusedItemId(matched.dataset.lmnasItemId);
      };

      doc.addEventListener("click", onClick);
      cleanupClick = () => doc.removeEventListener("click", onClick);
    };

    annotate();
    frame.addEventListener("load", annotate);

    return () => {
      frame.removeEventListener("load", annotate);
      cleanupClick?.();
    };
  }, [analysis, detectableItems]);

  useEffect(() => {
    const doc = sourceFrameRef.current?.contentDocument;
    if (!doc) {
      return;
    }

    const allItems = Array.from(doc.querySelectorAll<HTMLElement>("[data-lmnas-item-id]"));
    allItems.forEach((element) => element.classList.remove("lmnas-source-item-active"));

    if (!focusedItemId) {
      return;
    }

    const target = allItems.find((element) => element.dataset.lmnasItemId === focusedItemId);
    if (!target) {
      return;
    }

    target.classList.add("lmnas-source-item-active");
    target.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }, [focusedItemId, analysis, sourceViewport, sourceZoom]);

  return (
    <>
      <section className="rounded-2xl border border-lmnas-border bg-lmnas-panel p-4 shadow-lg shadow-black/10">
        <div className="grid grid-cols-6 gap-2">
          {STEPS.map((stepName, index) => {
            const isActive = index === step;
            const isDone = index < step;
            return (
              <button
                key={stepName}
                type="button"
                className={`relative flex flex-col items-start gap-1.5 rounded-xl px-3 py-3 text-left transition-all duration-200 cursor-pointer min-h-[66px] ${isActive
                  ? "bg-lmnas-accent/10 border border-lmnas-accent/40 text-lmnas-text shadow-md shadow-lmnas-accent/10"
                  : isDone
                    ? "bg-lmnas-success-soft border border-lmnas-success/20 text-lmnas-success"
                    : "bg-lmnas-bg-elevated border border-lmnas-border text-lmnas-muted hover:bg-lmnas-panel-hover"
                  }`}
                onClick={() => {
                  if (!analysis && index > 0) return;
                  setStep(index);
                }}
              >
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${isActive
                  ? "bg-lmnas-accent text-white"
                  : isDone
                    ? "bg-lmnas-success/20 text-lmnas-success"
                    : "bg-lmnas-border-subtle text-lmnas-muted"
                  }`}>
                  {isDone ? "✓" : index + 1}
                </span>
                <small className="text-[11px] leading-tight font-medium">{stepName}</small>
              </button>
            );
          })}
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-lmnas-danger/30 bg-lmnas-danger-soft p-4">
          <p className="text-sm font-medium text-lmnas-danger">{error}</p>
        </section>
      ) : null}

      {step === 0 ? (
        <section className="rounded-2xl border border-lmnas-border bg-lmnas-panel p-6 shadow-lg shadow-black/10">
          <h2 className="text-xl font-bold text-lmnas-text mb-1">1. Source Intake</h2>
          <p className="text-sm text-lmnas-muted mb-5">Paste URL/HTML or upload a design artifact. Operator flow stays visual by default.</p>

          <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-3 lg:grid-cols-6">
            {SOURCE_TYPES.map((sourceType) => (
              <button
                key={sourceType.value}
                type="button"
                className={`flex flex-col items-start gap-1 rounded-xl p-3 text-left transition-all cursor-pointer border ${intake.sourceType === sourceType.value
                  ? "bg-lmnas-accent/10 border-lmnas-accent/40 shadow-md shadow-lmnas-accent/10"
                  : "bg-lmnas-bg-elevated border-lmnas-border hover:bg-lmnas-panel-hover hover:border-lmnas-border-subtle"
                  }`}
                onClick={() => updateIntake("sourceType", sourceType.value)}
              >
                <strong className="text-xs font-bold text-lmnas-text">{sourceType.label}</strong>
                <small className="text-[11px] text-lmnas-muted leading-tight">{sourceType.hint}</small>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Page slug</span>
              <input className="rounded-lg border border-lmnas-border bg-lmnas-bg-elevated px-3 py-2.5 text-sm text-lmnas-text placeholder:text-lmnas-muted focus:border-lmnas-accent focus:outline-none focus:ring-1 focus:ring-lmnas-accent/30" value={intake.slug} onChange={(event) => updateIntake("slug", event.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Locale</span>
              <input className="rounded-lg border border-lmnas-border bg-lmnas-bg-elevated px-3 py-2.5 text-sm text-lmnas-text placeholder:text-lmnas-muted focus:border-lmnas-accent focus:outline-none focus:ring-1 focus:ring-lmnas-accent/30" value={intake.locale} onChange={(event) => updateIntake("locale", event.target.value)} />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 mb-4">
            <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Source content</span>
            <textarea
              rows={10}
              className="rounded-lg border border-lmnas-border bg-lmnas-bg-elevated px-3 py-2.5 text-sm text-lmnas-text font-mono placeholder:text-lmnas-muted focus:border-lmnas-accent focus:outline-none focus:ring-1 focus:ring-lmnas-accent/30 resize-y"
              value={intake.sourceValue}
              onChange={(event) => updateIntake("sourceValue", event.target.value)}
              data-testid="source-content-input"
            />
          </label>

          <label className="flex flex-col gap-1.5 mb-4">
            <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Upload handoff file (optional)</span>
            <input
              type="file"
              accept=".html,.txt,.json"
              className="text-sm text-lmnas-muted file:mr-3 file:rounded-lg file:border-0 file:bg-lmnas-accent/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-lmnas-accent-bright file:cursor-pointer hover:file:bg-lmnas-accent/20"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importSourceFile(file);
              }}
            />
          </label>

          <details className="mb-5 group">
            <summary className="cursor-pointer text-xs font-semibold text-lmnas-muted hover:text-lmnas-text-secondary transition-colors">Advanced import options</summary>
            <label className="flex flex-col gap-1.5 mt-3">
              <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Theme key</span>
              <input className="rounded-lg border border-lmnas-border bg-lmnas-bg-elevated px-3 py-2.5 text-sm text-lmnas-text focus:border-lmnas-accent focus:outline-none focus:ring-1 focus:ring-lmnas-accent/30" value={intake.themeKey} onChange={(event) => updateIntake("themeKey", event.target.value)} />
            </label>
          </details>

          <div className="flex gap-3">
            <button
              className="rounded-xl bg-lmnas-accent px-6 py-3 text-sm font-bold text-white shadow-lg shadow-lmnas-accent/20 transition-all hover:brightness-110 hover:shadow-xl hover:shadow-lmnas-accent/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              onClick={runAnalysis}
              disabled={!canAnalyze || isAnalyzing}
              data-testid="analyze-source-button"
            >
              {isAnalyzing ? "Analyzing\u2026" : "Analyze Source"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="rounded-2xl border border-lmnas-border bg-lmnas-panel p-6 shadow-lg shadow-black/10">
          <h2 className="text-xl font-bold text-lmnas-text mb-1">2. Source Preview</h2>
          {analysis ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(320px,1fr)" }}>
              {renderSourcePane("Styled Source Preview")}
              <article className="rounded-2xl border border-lmnas-border bg-lmnas-bg-elevated p-4">
                <h3 className="text-sm font-bold text-lmnas-text mb-3">Detection Readiness</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 border bg-lmnas-accent-soft border-lmnas-border text-lmnas-text-secondary">Stylesheets {analysis.source.styleProfile.linkedStylesheetCount}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 border bg-lmnas-accent-soft border-lmnas-border text-lmnas-text-secondary">Style tags {analysis.source.styleProfile.inlineStyleTagCount}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 border bg-lmnas-accent-soft border-lmnas-border text-lmnas-text-secondary">Applied {analysis.source.styleProfile.appliedStrategy}</span>
                </div>
                {analysis.source.styleProfile.fidelityNotes.length > 0 ? (
                  <div className="mb-3">
                    <h4 className="text-xs font-bold text-lmnas-warning mb-2">Fidelity Notes</h4>
                    {analysis.source.styleProfile.fidelityNotes.map((note) => (
                      <p key={note} className="text-xs text-lmnas-warning/80 mb-1 leading-relaxed">{note}</p>
                    ))}
                  </div>
                ) : null}
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-lmnas-muted hover:text-lmnas-text-secondary transition-colors">Advanced markup view</summary>
                  <pre className="mt-2 max-h-[420px] overflow-auto rounded-xl border border-lmnas-border bg-lmnas-bg p-3 text-xs text-lmnas-text-secondary font-mono">{analysis.source.rawMarkupPreview ?? analysis.source.productionPreviewHtml.slice(0, 9000)}</pre>
                </details>
              </article>
            </div>
          ) : (
            <p className="text-sm text-lmnas-warning">Run analysis first.</p>
          )}
        </section>
      ) : null}

      {step === 2 && analysis ? (
        <section className="rounded-2xl border border-lmnas-border bg-lmnas-panel p-6 shadow-lg shadow-black/10">
          <h2 className="text-xl font-bold text-lmnas-text mb-1">3. Detection Review</h2>
          <p className="text-sm text-lmnas-muted mb-4">Click any card to highlight source. Click highlighted source to focus the matching card.</p>

          <div className="flex flex-wrap gap-2 mb-5">
            <span className={chipStyleForType("shell")}>Shells {selectedCounts.shells}</span>
            <span className={chipStyleForType("block")}>Blocks {selectedCounts.blocks}</span>
            <span className={chipStyleForType("widget")}>Widgets {selectedCounts.widgets}</span>
            <span className={chipStyleForType("action")}>Actions {selectedCounts.actions}</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 border bg-lmnas-accent-soft border-lmnas-border text-lmnas-text-secondary">Exits {selectedCounts.exits}</span>
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(340px,1fr)" }}>
            {renderSourcePane("Source With Detection Highlights")}
            <article className="rounded-2xl border border-lmnas-border bg-lmnas-bg-elevated p-4 overflow-y-auto" style={{ maxHeight: "900px" }}>
              <h3 className="text-sm font-bold text-lmnas-text mb-3">Detected Items</h3>
              <div className="flex flex-col gap-3 mb-6">
                {detectableItems.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-xl border p-3 flex flex-col gap-2 cursor-pointer transition-all ${focusedItemId === item.id
                      ? "border-lmnas-accent bg-lmnas-accent/5 shadow-md shadow-lmnas-accent/10"
                      : itemImportState[item.id] === false
                        ? "border-lmnas-border bg-lmnas-bg opacity-50"
                        : "border-lmnas-border bg-lmnas-panel hover:border-lmnas-border-subtle hover:bg-lmnas-panel-hover"
                      }`}
                    data-testid={`detection-card-${item.id}`}
                    onClick={() => focusItem(item.id)}
                  >
                    <header className="flex items-center justify-between gap-2">
                      <span className={chipStyleForType(item.type)}>{item.type}</span>
                      <span className="text-xs font-bold text-lmnas-text-secondary">{Math.round(item.confidence * 100)}%</span>
                    </header>
                    <iframe
                      className="w-full rounded-lg border border-lmnas-border bg-white"
                      style={{ minHeight: "100px", height: "100px" }}
                      srcDoc={injectProjectStyles(buildCardPreview(item.previewHtml), projectStyles)}
                      sandbox="allow-scripts allow-same-origin"
                      title={`${item.id} preview`}
                    />
                    <p className="text-sm font-semibold text-lmnas-text">{displayNameOverrides[item.id] ?? item.label}</p>
                    <p className="text-xs text-lmnas-muted font-mono">{item.previewSelector ?? "No selector"}</p>
                    {renderCardControls(item.id)}
                    <button
                      type="button"
                      className="text-xs text-lmnas-accent-bright hover:underline text-left cursor-pointer"
                      onClick={() => focusItem(item.id)}
                    >
                      Jump to source &rarr;
                    </button>
                  </article>
                ))}
              </div>

              <h3 className="text-sm font-bold text-lmnas-text mb-3 pt-3 border-t border-lmnas-border">Action Traceability</h3>
              {analysis.actionProposals
                .filter((action) => itemImportState[action.id] !== false)
                .map((action: OnboardingActionProposal) => (
                  <div key={action.id} className="rounded-xl border border-lmnas-border bg-lmnas-panel p-3 mb-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-semibold text-lmnas-text">{displayNameFor(action, action.label)}</span>
                      <span className={chipStyleForType("action")}>{action.actionType}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs text-lmnas-muted">Parent:</span>
                      <span className="inline-flex items-center rounded-md bg-lmnas-purple-soft px-2 py-0.5 text-xs font-semibold text-lmnas-purple border border-lmnas-purple/20">
                        {action.sourceItemLabel ?? action.sourceItemId ?? "Not mapped"}
                      </span>
                    </div>
                    <p className="text-xs text-lmnas-muted mb-2">
                      CTA: <span className="text-lmnas-text-secondary">{action.ctaKind}</span>
                      {action.ctaHref ? <span className="text-lmnas-accent-bright ml-1">{action.ctaHref}</span> : null}
                      <span className="ml-1 font-mono">{action.selectorHint}</span>
                    </p>
                    <button
                      type="button"
                      className="text-xs text-lmnas-accent-bright hover:underline cursor-pointer"
                      onClick={() => focusItem(action.id)}
                    >
                      Highlight CTA &rarr;
                    </button>
                  </div>
                ))}
            </article>
          </div>
        </section>
      ) : null}

      {step === 3 && analysis ? (
        <section className="rounded-2xl border border-lmnas-border bg-lmnas-panel p-6 shadow-lg shadow-black/10">
          <h2 className="text-xl font-bold text-lmnas-text mb-1">4. Selection &amp; Mapping</h2>
          <p className="text-sm text-lmnas-muted mb-5">Choose what to import, rename items, and confirm editable Strapi fields.</p>

          {analysis.blockProposals
            .filter((block) => itemImportState[block.id] !== false)
            .map((block: OnboardingBlockProposal) => (
              <div key={block.id} className="rounded-xl border border-lmnas-border bg-lmnas-bg-elevated p-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className={chipStyleForType("block")}>block</span>
                  <span className="text-sm font-bold text-lmnas-text">{displayNameFor(block, block.id)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {[
                    { label: "Display name", el: <input className="rounded-lg border border-lmnas-border bg-lmnas-panel px-3 py-2 text-sm text-lmnas-text focus:border-lmnas-accent focus:outline-none" value={displayNameFor(block, block.id)} onChange={(e) => setDisplayNameOverrides((p) => ({ ...p, [block.id]: e.target.value }))} /> },
                    { label: "Block family", el: <select className="rounded-lg border border-lmnas-border bg-lmnas-panel px-3 py-2 text-sm text-lmnas-text focus:border-lmnas-accent focus:outline-none" value={blockFamilyOverrides[block.id] ?? block.family} onChange={(e) => setBlockFamilyOverrides((p) => ({ ...p, [block.id]: e.target.value as CanonicalBlockFamily }))}>{BLOCK_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}</select> },
                    { label: "Classify as", el: <select className="rounded-lg border border-lmnas-border bg-lmnas-panel px-3 py-2 text-sm text-lmnas-text focus:border-lmnas-accent focus:outline-none" value={itemTypeOverrides[block.id] ?? "block"} onChange={(e) => setItemTypeOverrides((p) => ({ ...p, [block.id]: e.target.value as OnboardingItemType }))}>{ITEM_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}</select> },
                    { label: "Editable fields", el: <input className="rounded-lg border border-lmnas-border bg-lmnas-panel px-3 py-2 text-sm text-lmnas-text focus:border-lmnas-accent focus:outline-none" value={(fieldOverrides[block.id] ?? block.editableFields).join(", ")} onChange={(e) => setFieldOverrideFromText(block.id, e.target.value)} /> },
                    { label: "Split / Merge", el: <select className="rounded-lg border border-lmnas-border bg-lmnas-panel px-3 py-2 text-sm text-lmnas-text focus:border-lmnas-accent focus:outline-none" value={segmentationOverrides[block.id] ?? block.segmentation} onChange={(e) => setSegmentationOverrides((p) => ({ ...p, [block.id]: e.target.value as SegmentationMode }))}>{SEGMENTATION_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}</select> },
                    { label: "Map to existing", el: <input className="rounded-lg border border-lmnas-border bg-lmnas-panel px-3 py-2 text-sm text-lmnas-text focus:border-lmnas-accent focus:outline-none" value={mapToExisting[block.id] ?? ""} onChange={(e) => setMapToExisting((p) => ({ ...p, [block.id]: e.target.value }))} placeholder="Existing Block Template ID" /> }
                  ].map(({ label, el }) => (
                    <label key={label} className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">{label}</span>
                      {el}
                    </label>
                  ))}
                </div>
              </div>
            ))}

          {analysis.widgetProposals
            .filter((widget) => itemImportState[widget.id] !== false)
            .map((widget: OnboardingWidgetProposal) => (
              <div key={widget.id} className="rounded-xl border border-lmnas-border bg-lmnas-bg-elevated p-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className={chipStyleForType("widget")}>widget</span>
                  <span className="text-sm font-bold text-lmnas-text">{displayNameFor(widget, widget.name)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Display name</span>
                    <input className="rounded-lg border border-lmnas-border bg-lmnas-panel px-3 py-2 text-sm text-lmnas-text focus:border-lmnas-accent focus:outline-none" value={displayNameFor(widget, widget.name)} onChange={(e) => setDisplayNameOverrides((p) => ({ ...p, [widget.id]: e.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Editable fields</span>
                    <input className="rounded-lg border border-lmnas-border bg-lmnas-panel px-3 py-2 text-sm text-lmnas-text focus:border-lmnas-accent focus:outline-none" value={(fieldOverrides[widget.id] ?? widget.editableFields).join(", ")} onChange={(e) => setFieldOverrideFromText(widget.id, e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Map to existing</span>
                    <input className="rounded-lg border border-lmnas-border bg-lmnas-panel px-3 py-2 text-sm text-lmnas-text focus:border-lmnas-accent focus:outline-none" value={mapToExisting[widget.id] ?? ""} onChange={(e) => setMapToExisting((p) => ({ ...p, [widget.id]: e.target.value }))} placeholder="Existing Widget ID" />
                  </label>
                </div>
              </div>
            ))}
        </section>
      ) : null}

      {step === 4 && analysis ? (
        <section className="rounded-2xl border border-lmnas-border bg-lmnas-panel p-6 shadow-lg shadow-black/10">
          <h2 className="text-xl font-bold text-lmnas-text mb-1">5. Action Mapping</h2>
          <p className="text-sm text-lmnas-muted mb-5">Map CTA behavior in human language first. Advanced exit internals stay collapsed.</p>

          {analysis.actionProposals
            .filter((action) => itemImportState[action.id] !== false)
            .map((action) => {
              const type = actionTypeOverrides[action.id] ?? action.actionType;
              const target = actionTargetOverrides[action.id] ?? {};
              const defaultExitId = target.exitId ?? action.suggestedExitId ?? action.destination.value ?? `${action.id}_exit`;
              const inputCls = "rounded-lg border border-lmnas-border bg-lmnas-bg-elevated px-3 py-2 text-sm text-lmnas-text focus:border-lmnas-accent focus:outline-none";

              return (
                <article key={action.id} className="rounded-xl border border-lmnas-border bg-lmnas-bg-elevated p-4 mb-3">
                  <header className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-lmnas-text">{displayNameFor(action, action.label)}</span>
                      <span className={chipStyleForType("action")}>{action.summary}</span>
                    </div>
                  </header>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs text-lmnas-muted">Parent:</span>
                    <span className="inline-flex items-center rounded-md bg-lmnas-purple-soft px-2 py-0.5 text-xs font-semibold text-lmnas-purple border border-lmnas-purple/20">
                      {action.sourceItemLabel ?? action.sourceItemId ?? "Not mapped"}
                    </span>
                  </div>
                  <p className="text-xs text-lmnas-muted mb-2">
                    CTA: <span className="text-lmnas-text-secondary">{action.ctaKind}</span>
                    <span className="ml-1 font-mono text-lmnas-muted">{action.selectorHint}</span>
                  </p>
                  <button type="button" className="text-xs text-lmnas-accent-bright hover:underline cursor-pointer mb-3" onClick={() => focusItem(action.id)}>
                    Jump to source &rarr;
                  </button>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Display label</span>
                      <input className={inputCls} value={actionLabelOverrides[action.id] ?? action.label} onChange={(e) => setActionLabelOverrides((p) => ({ ...p, [action.id]: e.target.value }))} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Action</span>
                      <select className={inputCls} value={type} onChange={(e) => setActionTypeOverrides((p) => ({ ...p, [action.id]: e.target.value as ActionType }))}>
                        {ACTION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                  </div>

                  {["link_url", "download_asset", "external_booking"].includes(type) ? (
                    <label className="flex flex-col gap-1 mb-2">
                      <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Target URL</span>
                      <input className={inputCls} value={target.url ?? action.destination.value ?? ""} onChange={(e) => setActionTarget(action.id, { url: e.target.value })} placeholder="https://... or /page" />
                    </label>
                  ) : null}

                  {type === "scroll_to_section" ? (
                    <label className="flex flex-col gap-1 mb-2">
                      <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Target section ID</span>
                      <input className={inputCls} value={target.sectionId ?? action.destination.value ?? ""} onChange={(e) => setActionTarget(action.id, { sectionId: e.target.value })} placeholder="hero-section" />
                    </label>
                  ) : null}

                  {["open_modal", "open_drawer", "open_widget"].includes(type) ? (
                    <label className="flex flex-col gap-1 mb-2">
                      <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Widget to open</span>
                      <select className={inputCls} value={target.widgetId ?? action.destination.value ?? ""} onChange={(e) => setActionTarget(action.id, { widgetId: e.target.value })}>
                        <option value="">Select widget</option>
                        {[...selectedWidgetIds].map((wId) => <option key={wId} value={wId}>{wId}</option>)}
                      </select>
                    </label>
                  ) : null}

                  {["workflow", "submit_form"].includes(type) ? (
                    <>
                      <label className="flex flex-col gap-1 mb-2">
                        <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Workflow exit ID</span>
                        <input className={inputCls} value={defaultExitId} onChange={(e) => setActionTarget(action.id, { exitId: e.target.value })} />
                      </label>
                      <details className="group">
                        <summary className="cursor-pointer text-xs font-semibold text-lmnas-muted hover:text-lmnas-text-secondary transition-colors">Advanced exit details</summary>
                        <label className="flex flex-col gap-1 mt-2">
                          <span className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Exit state</span>
                          <select className={inputCls} value={exitStateOverrides[defaultExitId] ?? "active"} onChange={(e) => setExitStateOverrides((p) => ({ ...p, [defaultExitId]: e.target.value as "active" | "inactive" }))}>
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                          </select>
                        </label>
                      </details>
                    </>
                  ) : null}
                </article>
              );
            })}
        </section>
      ) : null}

      {step === 5 && analysis ? (
        <section className="rounded-2xl border border-lmnas-border bg-lmnas-panel p-6 shadow-lg shadow-black/10">
          <h2 className="text-xl font-bold text-lmnas-text mb-1">6. Publish Summary</h2>
          <p className="text-sm text-lmnas-muted mb-5">Preview what will be created, review warnings, then publish to Strapi.</p>

          <div className="flex gap-3 mb-6">
            <button
              className="rounded-xl bg-lmnas-accent px-6 py-3 text-sm font-bold text-white shadow-lg shadow-lmnas-accent/20 transition-all hover:brightness-110 hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              onClick={() => publish("dry-run")}
              disabled={isPublishing}
              data-testid="preview-create-button"
            >
              {isPublishing ? "Building preview\u2026" : "Preview What Will Be Created"}
            </button>
            <button
              className="rounded-xl bg-lmnas-success/15 border border-lmnas-success/30 px-6 py-3 text-sm font-bold text-lmnas-success shadow-lg shadow-lmnas-success/10 transition-all hover:bg-lmnas-success/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              onClick={() => publish("apply")}
              disabled={isPublishing}
              data-testid="publish-apply-button"
            >
              Publish to Strapi
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6 lg:grid-cols-6">
            {[
              { label: "Shells", count: publishResult?.summary.shellsToCreate ?? selectedCounts.shells, color: "lmnas-accent" },
              { label: "Blocks", count: publishResult?.summary.blocksToCreate ?? selectedCounts.blocks, color: "lmnas-purple" },
              { label: "Widgets", count: publishResult?.summary.widgetsToCreate ?? selectedCounts.widgets, color: "lmnas-emerald" },
              { label: "Actions", count: publishResult?.summary.actionsToCreate ?? selectedCounts.actions, color: "lmnas-amber" },
              { label: "Exits", count: publishResult?.summary.exitsRequired ?? selectedCounts.exits, color: "lmnas-accent-bright" },
              { label: "Fields", count: publishResult?.summary.editableFieldsCreated ?? 0, color: "lmnas-text-secondary" }
            ].map(({ label, count, color }) => (
              <article key={label} className="rounded-xl border border-lmnas-border bg-lmnas-bg-elevated p-4 text-center">
                <h3 className={`text-2xl font-extrabold text-${color}`}>{count}</h3>
                <p className="text-xs text-lmnas-muted mt-1">{label}</p>
              </article>
            ))}
          </div>

          <article className="rounded-2xl border border-lmnas-border bg-lmnas-bg-elevated p-5 mb-5 shadow-inner">
            <h3 className="text-sm font-bold text-lmnas-text mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-lmnas-accent-bright">verified</span>
              Fidelity & Theme Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl bg-lmnas-panel border border-lmnas-border p-4 text-center">
                <h4 className="text-3xl font-black text-lmnas-accent mb-1">{Math.round(analysis.theme.tokenFirstMatchRatio * 100)}%</h4>
                <p className="text-xs font-semibold text-lmnas-text-secondary uppercase tracking-wider">Fidelity Score</p>
                <div className="mt-2 text-[10px] text-lmnas-muted uppercase">{analysis.theme.tokenFirstMatchRatio > 0.8 ? "Excellent Match" : "Needs Review"}</div>
              </div>
              <div className="rounded-xl bg-lmnas-panel border border-lmnas-border p-4 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="text-lmnas-text font-medium">Arbitrary Values</span>
                  <span className="font-mono text-lmnas-warning font-bold">{analysis.theme.arbitraryValueCount}</span>
                </div>
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="text-lmnas-text font-medium">Dark Mode Target</span>
                  <span className={`font-bold ${analysis.theme.hasDarkModeTrigger ? 'text-lmnas-success' : 'text-lmnas-muted'}`}>{analysis.theme.hasDarkModeTrigger ? "Detected" : "None"}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-lmnas-text font-medium">Unique Fonts</span>
                  <span className="font-mono text-lmnas-purple font-bold">{analysis.theme.extractedFonts.length}</span>
                </div>
              </div>
              <div className="rounded-xl bg-lmnas-warning-soft border border-lmnas-warning/30 p-4">
                <p className="text-xs text-lmnas-warning leading-relaxed font-medium">
                  <strong>Theme Debt:</strong> {analysis.theme.themeDebtSummary}
                </p>
              </div>
            </div>
          </article>

          {publishResult ? (
            <div className={`rounded-xl border p-3 mb-5 ${publishResult.applied ? "border-lmnas-success/30 bg-lmnas-success-soft" : "border-lmnas-warning/30 bg-lmnas-warning-soft"}`}>
              <p className={`text-sm font-semibold ${publishResult.applied ? "text-lmnas-success" : "text-lmnas-warning"}`}>
                {publishResult.applied
                  ? "Publish apply succeeded against Strapi."
                  : publishResult.applyReadiness.operatorMessage}
              </p>
            </div>
          ) : (
            <p className="text-sm text-lmnas-muted mb-5">Run preview to validate creation plan and environment readiness.</p>
          )}

          <article className="rounded-2xl border border-lmnas-border bg-lmnas-bg-elevated overflow-hidden mb-5">
            <header className="flex items-center gap-2 border-b border-lmnas-border px-4 py-3 bg-lmnas-panel">
              <h3 className="text-sm font-bold text-lmnas-text">Side-By-Side Fidelity Comparison</h3>
            </header>
            <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-lmnas-border">
              <div className="p-3 bg-lmnas-bg flex flex-col">
                <p className="text-xs font-semibold text-lmnas-muted uppercase tracking-wider mb-2 text-center">Reference Design (Original)</p>
                <iframe
                  className="w-full rounded-xl border border-lmnas-border bg-white flex-1"
                  style={{ minHeight: "600px", height: "600px" }}
                  srcDoc={analysis.source.referencePreviewHtml}
                  sandbox="allow-scripts allow-same-origin"
                  title="Reference preview"
                />
              </div>
              <div className="p-3 bg-lmnas-bg flex flex-col">
                <p className="text-xs font-semibold text-lmnas-text-secondary/80 uppercase tracking-wider mb-2 text-center">Authoritative Production Render</p>
                <iframe
                  className="w-full rounded-xl border border-lmnas-border bg-white flex-1"
                  style={{ minHeight: "600px", height: "600px" }}
                  srcDoc={injectProjectStyles(publishResult?.assemblyPreviewHtml ?? assemblyPreviewFromSelection, projectStyles)}
                  sandbox="allow-scripts allow-same-origin"
                  title="Assembly preview"
                  data-testid="assembly-preview-frame"
                />
              </div>
            </div>
          </article>

          {publishResult?.warnings.length ? (
            <article className="mb-5">
              <h3 className="text-sm font-bold text-lmnas-text mb-2">Warnings Requiring Review</h3>
              {publishResult.warnings.map((warning) => (
                <div
                  key={warning.code}
                  className={`rounded-lg border p-3 mb-2 ${warning.severity === "error"
                    ? "border-lmnas-danger/30 bg-lmnas-danger-soft"
                    : warning.severity === "warning"
                      ? "border-lmnas-warning/30 bg-lmnas-warning-soft"
                      : "border-lmnas-border bg-lmnas-bg-elevated"
                    }`}
                >
                  <p className={`text-sm ${warning.severity === "error" ? "text-lmnas-danger" : warning.severity === "warning" ? "text-lmnas-warning" : "text-lmnas-muted"}`}>
                    <strong className="font-bold">{warning.code}</strong>: {warning.message}
                  </p>
                </div>
              ))}
            </article>
          ) : null}

          {publishResult?.previewLinks.length ? (
            <article className="mb-5">
              <h3 className="text-sm font-bold text-lmnas-text mb-2">Preview Links</h3>
              {publishResult.previewLinks.map((link) => (
                <p key={link} className="text-sm mb-1">
                  <a href={link} target="_blank" rel="noreferrer" className="text-lmnas-accent-bright hover:underline">
                    {link}
                  </a>
                </p>
              ))}
            </article>
          ) : null}

          {publishResult ? (
            <details className="group">
              <summary className="cursor-pointer text-xs font-semibold text-lmnas-muted hover:text-lmnas-text-secondary transition-colors">Developer details (JSON)</summary>
              <pre className="mt-2 max-h-[500px] overflow-auto rounded-xl border border-lmnas-border bg-lmnas-bg p-3 text-xs text-lmnas-text-secondary font-mono">{JSON.stringify(publishResult, null, 2)}</pre>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-lmnas-border bg-lmnas-panel p-4 shadow-lg shadow-black/10">
        <div className="flex justify-between gap-3">
          <button
            type="button"
            className="rounded-xl bg-lmnas-bg-elevated border border-lmnas-border px-6 py-2.5 text-sm font-semibold text-lmnas-text-secondary transition-all hover:bg-lmnas-panel-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            onClick={() => setStep((previous) => Math.max(0, previous - 1))}
            disabled={step === 0}
          >
            &larr; Back
          </button>
          <button
            type="button"
            className="rounded-xl bg-lmnas-accent px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-lmnas-accent/20 transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            onClick={() => setStep((previous) => Math.min(STEPS.length - 1, previous + 1))}
            disabled={step >= STEPS.length - 1 || (!analysis && step >= 0)}
          >
            Next &rarr;
          </button>
        </div>
      </section>
    </>
  );
}
