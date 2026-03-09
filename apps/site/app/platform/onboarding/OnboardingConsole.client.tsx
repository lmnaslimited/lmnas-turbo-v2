"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  if (type === "shell") {
    return "lmnas-chip lmnas-chip-shell";
  }

  if (type === "block") {
    return "lmnas-chip lmnas-chip-block";
  }

  if (type === "widget") {
    return "lmnas-chip lmnas-chip-widget";
  }

  if (type === "action") {
    return "lmnas-chip lmnas-chip-action";
  }

  return "lmnas-chip";
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
    sourcePreviewHtml: params.analysis.source.previewHtml,
    baseUrl: params.analysis.source.baseUrl,
    themeScopeClass: params.analysis.source.themeScopeClass,
    shellCandidates: shells,
    blockProposals: blocks,
    widgetProposals: widgets,
    actionProposals: actions
  });
}

export function OnboardingConsole() {
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
    return (
      <div className="lmnas-detect-controls">
        <button type="button" onClick={() => setImportState(id, true)} data-primary={itemImportState[id] !== false ? "true" : undefined}>
          Import
        </button>
        <button type="button" onClick={() => setImportState(id, false)} data-primary={itemImportState[id] === false ? "true" : undefined}>
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
      sourcePreviewHtml: analysis.source.previewHtml,
      baseUrl: analysis.source.baseUrl,
      themeScopeClass: analysis.source.themeScopeClass
    });
  }

  function renderSourcePane(title: string) {
    return (
      <article className="lmnas-source-pane">
        <header className="lmnas-source-pane-header">
          <div>
            <h3>{title}</h3>
            {analysis ? (
              <p className="lmnas-muted">
                {analysis.source.sourceRef} | Theme scope: {analysis.source.themeScopeClass}
              </p>
            ) : null}
          </div>
          <div className="lmnas-source-controls">
            {VIEWPORT_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                data-primary={sourceViewport === option.key ? "true" : undefined}
                onClick={() => setSourceViewport(option.key)}
              >
                {option.label}
              </button>
            ))}
            <label>
              Zoom
              <input
                data-testid="source-zoom-input"
                type="range"
                min={60}
                max={140}
                step={5}
                value={sourceZoom}
                onChange={(event) => setSourceZoom(Number(event.target.value))}
              />
            </label>
          </div>
        </header>
        <div className="lmnas-source-canvas-wrap">
          <div
            className="lmnas-source-canvas"
            style={{
              width: `${activeSourceWidth}px`,
              transform: `scale(${sourceZoom / 100})`,
              transformOrigin: "top left"
            }}
          >
            <iframe
              ref={sourceFrameRef}
              className="lmnas-preview-frame lmnas-preview-frame-source"
              srcDoc={analysis?.source.previewHtml}
              sandbox=""
              title="Source preview"
              data-testid="source-preview-frame"
            />
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
      <section className="lmnas-onboarding-card">
        <div className="lmnas-stepper">
          {STEPS.map((stepName, index) => (
            <button
              key={stepName}
              type="button"
              className={`lmnas-step ${index === step ? "lmnas-step-active" : ""} ${index < step ? "lmnas-step-done" : ""}`}
              onClick={() => {
                if (!analysis && index > 0) {
                  return;
                }
                setStep(index);
              }}
            >
              <span>{index + 1}</span>
              <small>{stepName}</small>
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <section className="lmnas-onboarding-card">
          <p className="lmnas-error">{error}</p>
        </section>
      ) : null}

      {step === 0 ? (
        <section className="lmnas-onboarding-card">
          <h2>1. Source Intake</h2>
          <p className="lmnas-muted">Paste URL/HTML or upload a design artifact. Operator flow stays visual by default.</p>

          <div className="lmnas-source-type-grid">
            {SOURCE_TYPES.map((sourceType) => (
              <button
                key={sourceType.value}
                type="button"
                className={`lmnas-source-type ${intake.sourceType === sourceType.value ? "lmnas-source-type-active" : ""}`}
                onClick={() => updateIntake("sourceType", sourceType.value)}
              >
                <strong>{sourceType.label}</strong>
                <small>{sourceType.hint}</small>
              </button>
            ))}
          </div>

          <div className="lmnas-onboarding-grid">
            <label className="lmnas-onboarding-field">
              <span>Page slug</span>
              <input value={intake.slug} onChange={(event) => updateIntake("slug", event.target.value)} />
            </label>
            <label className="lmnas-onboarding-field">
              <span>Locale</span>
              <input value={intake.locale} onChange={(event) => updateIntake("locale", event.target.value)} />
            </label>
          </div>

          <label className="lmnas-onboarding-field">
            <span>Source content</span>
            <textarea
              rows={10}
              value={intake.sourceValue}
              onChange={(event) => updateIntake("sourceValue", event.target.value)}
              data-testid="source-content-input"
            />
          </label>

          <label className="lmnas-onboarding-field">
            <span>Upload handoff file (optional)</span>
            <input
              type="file"
              accept=".html,.txt,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importSourceFile(file);
                }
              }}
            />
          </label>

          <details>
            <summary>Advanced import options</summary>
            <label className="lmnas-onboarding-field">
              <span>Theme key</span>
              <input value={intake.themeKey} onChange={(event) => updateIntake("themeKey", event.target.value)} />
            </label>
          </details>

          <div className="lmnas-onboarding-actions">
            <button data-primary="true" onClick={runAnalysis} disabled={!canAnalyze || isAnalyzing} data-testid="analyze-source-button">
              {isAnalyzing ? "Analyzing..." : "Analyze Source"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="lmnas-onboarding-card">
          <h2>2. Source Preview</h2>
          {analysis ? (
            <div className="lmnas-studio-layout">
              {renderSourcePane("Styled Source Preview")}
              <article className="lmnas-side-pane">
                <h3>Detection Readiness</h3>
                <div className="lmnas-chip-list">
                  <span className="lmnas-chip">Stylesheets {analysis.source.styleProfile.linkedStylesheetCount}</span>
                  <span className="lmnas-chip">Style tags {analysis.source.styleProfile.inlineStyleTagCount}</span>
                  <span className="lmnas-chip">Applied {analysis.source.styleProfile.appliedStrategy}</span>
                </div>
                {analysis.source.styleProfile.fidelityNotes.length > 0 ? (
                  <div>
                    <h4>Fidelity Notes</h4>
                    {analysis.source.styleProfile.fidelityNotes.map((note) => (
                      <p key={note} className="lmnas-warning">
                        {note}
                      </p>
                    ))}
                  </div>
                ) : null}
                <details>
                  <summary>Advanced markup view</summary>
                  <pre className="lmnas-code-preview">{analysis.source.rawMarkupPreview ?? analysis.source.previewHtml.slice(0, 9000)}</pre>
                </details>
              </article>
            </div>
          ) : (
            <p className="lmnas-warning">Run analysis first.</p>
          )}
        </section>
      ) : null}

      {step === 2 && analysis ? (
        <section className="lmnas-onboarding-card">
          <h2>3. Detection Review</h2>
          <p className="lmnas-muted">Click any card to highlight source. Click highlighted source to focus the matching card.</p>

          <div className="lmnas-count-strip">
            <span className="lmnas-chip">Shells {selectedCounts.shells}</span>
            <span className="lmnas-chip">Blocks {selectedCounts.blocks}</span>
            <span className="lmnas-chip">Widgets {selectedCounts.widgets}</span>
            <span className="lmnas-chip">Actions {selectedCounts.actions}</span>
            <span className="lmnas-chip">Exits {selectedCounts.exits}</span>
          </div>

          <div className="lmnas-studio-layout">
            {renderSourcePane("Source With Detection Highlights")}
            <article className="lmnas-side-pane">
              <h3>Detected Items</h3>
              <div className="lmnas-detect-grid">
                {detectableItems.map((item) => (
                  <article
                    key={item.id}
                    className={`lmnas-detect-card ${focusedItemId === item.id ? "lmnas-detect-card-focused" : ""} ${
                      itemImportState[item.id] === false ? "lmnas-detect-card-skipped" : ""
                    }`}
                    data-testid={`detection-card-${item.id}`}
                    onClick={() => focusItem(item.id)}
                  >
                    <header>
                      <span className={chipStyleForType(item.type)}>{item.type}</span>
                      <span className="lmnas-chip">{Math.round(item.confidence * 100)}%</span>
                    </header>
                    <iframe className="lmnas-detect-preview-frame" srcDoc={buildCardPreview(item.previewHtml)} sandbox="" title={`${item.id} preview`} />
                    <p>
                      <strong>{displayNameOverrides[item.id] ?? item.label}</strong>
                    </p>
                    <p className="lmnas-muted">{item.previewSelector ?? "No selector available"}</p>
                    {renderCardControls(item.id)}
                    <button type="button" onClick={() => focusItem(item.id)}>
                      Jump to source
                    </button>
                  </article>
                ))}
              </div>

              <h3>Action Traceability</h3>
              {analysis.actionProposals
                .filter((action) => itemImportState[action.id] !== false)
                .map((action: OnboardingActionProposal) => (
                  <div key={action.id} className="lmnas-map-row">
                    <p>
                      <strong>{displayNameFor(action, action.label)}</strong> ({action.actionType})
                    </p>
                    <p className="lmnas-muted">Parent: {action.sourceItemLabel ?? action.sourceItemId ?? "Not mapped"}</p>
                    <p className="lmnas-muted">
                      CTA: {action.ctaKind} {action.ctaHref ? `| ${action.ctaHref}` : ""} | {action.selectorHint}
                    </p>
                    <button type="button" onClick={() => focusItem(action.id)}>
                      Highlight CTA
                    </button>
                  </div>
                ))}
            </article>
          </div>
        </section>
      ) : null}

      {step === 3 && analysis ? (
        <section className="lmnas-onboarding-card">
          <h2>4. Selection & Mapping</h2>
          <p className="lmnas-muted">Choose what to import, rename items, and confirm editable Strapi fields.</p>

          {analysis.blockProposals
            .filter((block) => itemImportState[block.id] !== false)
            .map((block: OnboardingBlockProposal) => (
              <div key={block.id} className="lmnas-onboarding-grid lmnas-map-row">
                <label className="lmnas-onboarding-field">
                  <span>Display name</span>
                  <input
                    value={displayNameFor(block, block.id)}
                    onChange={(event) => setDisplayNameOverrides((previous) => ({ ...previous, [block.id]: event.target.value }))}
                  />
                </label>
                <label className="lmnas-onboarding-field">
                  <span>Block family</span>
                  <select
                    value={blockFamilyOverrides[block.id] ?? block.family}
                    onChange={(event) => setBlockFamilyOverrides((previous) => ({ ...previous, [block.id]: event.target.value as CanonicalBlockFamily }))}
                  >
                    {BLOCK_FAMILIES.map((family) => (
                      <option key={family} value={family}>
                        {family}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="lmnas-onboarding-field">
                  <span>Classify as</span>
                  <select
                    value={itemTypeOverrides[block.id] ?? "block"}
                    onChange={(event) => setItemTypeOverrides((previous) => ({ ...previous, [block.id]: event.target.value as OnboardingItemType }))}
                  >
                    {ITEM_TYPE_OPTIONS.map((itemType) => (
                      <option key={itemType} value={itemType}>
                        {itemType}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="lmnas-onboarding-field">
                  <span>Editable fields</span>
                  <input value={(fieldOverrides[block.id] ?? block.editableFields).join(", ")} onChange={(event) => setFieldOverrideFromText(block.id, event.target.value)} />
                </label>
                <label className="lmnas-onboarding-field">
                  <span>Split / Merge</span>
                  <select
                    value={segmentationOverrides[block.id] ?? block.segmentation}
                    onChange={(event) => setSegmentationOverrides((previous) => ({ ...previous, [block.id]: event.target.value as SegmentationMode }))}
                  >
                    {SEGMENTATION_OPTIONS.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="lmnas-onboarding-field">
                  <span>Map to existing block</span>
                  <input
                    value={mapToExisting[block.id] ?? ""}
                    onChange={(event) => setMapToExisting((previous) => ({ ...previous, [block.id]: event.target.value }))}
                    placeholder="Existing Block Template ID"
                  />
                </label>
              </div>
            ))}

          {analysis.widgetProposals
            .filter((widget) => itemImportState[widget.id] !== false)
            .map((widget: OnboardingWidgetProposal) => (
              <div key={widget.id} className="lmnas-onboarding-grid lmnas-map-row">
                <label className="lmnas-onboarding-field">
                  <span>Widget display name</span>
                  <input
                    value={displayNameFor(widget, widget.name)}
                    onChange={(event) => setDisplayNameOverrides((previous) => ({ ...previous, [widget.id]: event.target.value }))}
                  />
                </label>
                <label className="lmnas-onboarding-field">
                  <span>Editable fields</span>
                  <input
                    value={(fieldOverrides[widget.id] ?? widget.editableFields).join(", ")}
                    onChange={(event) => setFieldOverrideFromText(widget.id, event.target.value)}
                  />
                </label>
                <label className="lmnas-onboarding-field">
                  <span>Map to existing widget</span>
                  <input
                    value={mapToExisting[widget.id] ?? ""}
                    onChange={(event) => setMapToExisting((previous) => ({ ...previous, [widget.id]: event.target.value }))}
                    placeholder="Existing Widget Definition ID"
                  />
                </label>
              </div>
            ))}
        </section>
      ) : null}

      {step === 4 && analysis ? (
        <section className="lmnas-onboarding-card">
          <h2>5. Action Mapping</h2>
          <p className="lmnas-muted">Map CTA behavior in human language first. Advanced exit internals stay collapsed.</p>

          {analysis.actionProposals
            .filter((action) => itemImportState[action.id] !== false)
            .map((action) => {
              const type = actionTypeOverrides[action.id] ?? action.actionType;
              const target = actionTargetOverrides[action.id] ?? {};
              const defaultExitId = target.exitId ?? action.suggestedExitId ?? action.destination.value ?? `${action.id}_exit`;

              return (
                <article key={action.id} className="lmnas-action-card">
                  <header>
                    <strong>{displayNameFor(action, action.label)}</strong>
                    <span className="lmnas-chip">{action.summary}</span>
                  </header>
                  <p className="lmnas-muted">Parent: {action.sourceItemLabel ?? action.sourceItemId ?? "Not mapped"}</p>
                  <p className="lmnas-muted">
                    CTA trace: {action.ctaKind} | {action.selectorHint}
                  </p>
                  <button type="button" onClick={() => focusItem(action.id)}>
                    Jump to source
                  </button>

                  <div className="lmnas-onboarding-grid">
                    <label className="lmnas-onboarding-field">
                      <span>Display label</span>
                      <input
                        value={actionLabelOverrides[action.id] ?? action.label}
                        onChange={(event) => setActionLabelOverrides((previous) => ({ ...previous, [action.id]: event.target.value }))}
                      />
                    </label>
                    <label className="lmnas-onboarding-field">
                      <span>Action</span>
                      <select value={type} onChange={(event) => setActionTypeOverrides((previous) => ({ ...previous, [action.id]: event.target.value as ActionType }))}>
                        {ACTION_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {["link_url", "download_asset", "external_booking"].includes(type) ? (
                    <label className="lmnas-onboarding-field">
                      <span>Target URL</span>
                      <input
                        value={target.url ?? action.destination.value ?? ""}
                        onChange={(event) => setActionTarget(action.id, { url: event.target.value })}
                        placeholder="https://... or /page"
                      />
                    </label>
                  ) : null}

                  {type === "scroll_to_section" ? (
                    <label className="lmnas-onboarding-field">
                      <span>Target section ID</span>
                      <input
                        value={target.sectionId ?? action.destination.value ?? ""}
                        onChange={(event) => setActionTarget(action.id, { sectionId: event.target.value })}
                        placeholder="hero-section"
                      />
                    </label>
                  ) : null}

                  {["open_modal", "open_drawer", "open_widget"].includes(type) ? (
                    <label className="lmnas-onboarding-field">
                      <span>Widget to open</span>
                      <select value={target.widgetId ?? action.destination.value ?? ""} onChange={(event) => setActionTarget(action.id, { widgetId: event.target.value })}>
                        <option value="">Select widget</option>
                        {[...selectedWidgetIds].map((widgetId) => (
                          <option key={widgetId} value={widgetId}>
                            {widgetId}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {["workflow", "submit_form"].includes(type) ? (
                    <>
                      <label className="lmnas-onboarding-field">
                        <span>Workflow exit ID</span>
                        <input value={defaultExitId} onChange={(event) => setActionTarget(action.id, { exitId: event.target.value })} />
                      </label>
                      <details>
                        <summary>Advanced exit details</summary>
                        <label className="lmnas-onboarding-field">
                          <span>Exit state</span>
                          <select value={exitStateOverrides[defaultExitId] ?? "active"} onChange={(event) => setExitStateOverrides((previous) => ({ ...previous, [defaultExitId]: event.target.value as "active" | "inactive" }))}>
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
        <section className="lmnas-onboarding-card">
          <h2>6. Publish Summary</h2>
          <p className="lmnas-muted">Preview what will be created, review warnings, then publish to Strapi.</p>

          <div className="lmnas-onboarding-actions lmnas-sticky-actions">
            <button onClick={() => publish("dry-run")} disabled={isPublishing} data-primary="true" data-testid="preview-create-button">
              {isPublishing ? "Building preview..." : "Preview What Will Be Created"}
            </button>
            <button onClick={() => publish("apply")} disabled={isPublishing} data-testid="publish-apply-button">
              Publish to Strapi
            </button>
          </div>

          <div className="lmnas-summary-grid">
            <article>
              <h3>{publishResult?.summary.shellsToCreate ?? selectedCounts.shells}</h3>
              <p>Shells</p>
            </article>
            <article>
              <h3>{publishResult?.summary.blocksToCreate ?? selectedCounts.blocks}</h3>
              <p>Blocks</p>
            </article>
            <article>
              <h3>{publishResult?.summary.widgetsToCreate ?? selectedCounts.widgets}</h3>
              <p>Widgets</p>
            </article>
            <article>
              <h3>{publishResult?.summary.actionsToCreate ?? selectedCounts.actions}</h3>
              <p>Actions</p>
            </article>
            <article>
              <h3>{publishResult?.summary.exitsRequired ?? selectedCounts.exits}</h3>
              <p>Exits</p>
            </article>
            <article>
              <h3>{publishResult?.summary.editableFieldsCreated ?? 0}</h3>
              <p>Editable Strapi fields</p>
            </article>
          </div>

          {publishResult ? (
            <p className={publishResult.applied ? "lmnas-success" : "lmnas-warning"}>
              {publishResult.applied
                ? "Publish apply succeeded against Strapi."
                : publishResult.applyReadiness.operatorMessage}
            </p>
          ) : (
            <p className="lmnas-muted">Run preview to validate creation plan and environment readiness.</p>
          )}

          <article className="lmnas-final-preview-panel">
            <h3>Final Assembly Preview</h3>
            <iframe
              className="lmnas-preview-frame lmnas-preview-frame-assembly"
              srcDoc={publishResult?.assemblyPreviewHtml ?? assemblyPreviewFromSelection}
              sandbox=""
              title="Assembly preview"
              data-testid="assembly-preview-frame"
            />
          </article>

          {publishResult?.warnings.length ? (
            <article>
              <h3>Warnings Requiring Review</h3>
              {publishResult.warnings.map((warning) => (
                <p key={warning.code} className={warning.severity === "error" ? "lmnas-error" : warning.severity === "warning" ? "lmnas-warning" : "lmnas-muted"}>
                  <strong>{warning.code}</strong>: {warning.message}
                </p>
              ))}
            </article>
          ) : null}

          {publishResult?.previewLinks.length ? (
            <article>
              <h3>Preview Links</h3>
              {publishResult.previewLinks.map((link) => (
                <p key={link}>
                  <a href={link} target="_blank" rel="noreferrer">
                    {link}
                  </a>
                </p>
              ))}
            </article>
          ) : null}

          {publishResult ? (
            <details>
              <summary>Developer details (JSON)</summary>
              <pre>{JSON.stringify(publishResult, null, 2)}</pre>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="lmnas-onboarding-card">
        <div className="lmnas-onboarding-actions">
          <button type="button" onClick={() => setStep((previous) => Math.max(0, previous - 1))} disabled={step === 0}>
            Back
          </button>
          <button
            type="button"
            data-primary="true"
            onClick={() => setStep((previous) => Math.min(STEPS.length - 1, previous + 1))}
            disabled={step >= STEPS.length - 1 || (!analysis && step >= 0)}
          >
            Next
          </button>
        </div>
      </section>
    </>
  );
}
