"use client";

import React, { useMemo, useState } from "react";
import type {
  ActionType,
  CanonicalBlockFamily,
  OnboardingAnalysis,
  OnboardingItemType,
  OnboardingPublishResult,
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

export function OnboardingConsole() {
  const [step, setStep] = useState(0);
  const [intake, setIntake] = useState<IntakeFormState>({
    sourceType: "raw_html",
    sourceValue:
      "<header><nav><a href='/products'>Products</a><a href='/contact'>Contact</a></nav></header><section class='hero'><h1>Build faster with LMNAs</h1><p>Launch governed pages in minutes.</p><a href='/book'>Book Appointment</a></section><section class='faq'><h2>FAQ</h2><button>Send me the full report</button></section><footer><a href='/privacy'>Privacy</a></footer>",
    slug: "home",
    locale: "en",
    themeKey: "default"
  });

  const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null);
  const [publishResult, setPublishResult] = useState<OnboardingPublishResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [itemImportState, setItemImportState] = useState<Record<string, boolean>>({});
  const [itemTypeOverrides, setItemTypeOverrides] = useState<Record<string, OnboardingItemType>>({});
  const [mapToExisting, setMapToExisting] = useState<Record<string, string>>({});
  const [blockFamilyOverrides, setBlockFamilyOverrides] = useState<Record<string, CanonicalBlockFamily>>({});
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string[]>>({});
  const [segmentationOverrides, setSegmentationOverrides] = useState<Record<string, SegmentationMode>>({});
  const [actionTypeOverrides, setActionTypeOverrides] = useState<Record<string, ActionType>>({});
  const [actionLabelOverrides, setActionLabelOverrides] = useState<Record<string, string>>({});
  const [actionTargetOverrides, setActionTargetOverrides] = useState<Record<string, ActionTargetOverride>>({});
  const [exitStateOverrides, setExitStateOverrides] = useState<Record<string, "active" | "inactive">>({});

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

  function updateIntake<K extends keyof IntakeFormState>(key: K, value: IntakeFormState[K]) {
    setIntake((previous) => ({
      ...previous,
      [key]: value
    }));
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
      setFieldOverrides({});
      setSegmentationOverrides({});
      setMapToExisting({});
      setItemTypeOverrides({});
      setActionTypeOverrides({});
      setActionLabelOverrides({});
      setActionTargetOverrides({});
      setExitStateOverrides({});
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
          <p className="lmnas-muted">
            Start with one source. You can paste URL/HTML or import a handoff artifact.
          </p>

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
            <textarea rows={10} value={intake.sourceValue} onChange={(event) => updateIntake("sourceValue", event.target.value)} />
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
            <button data-primary="true" onClick={runAnalysis} disabled={!canAnalyze || isAnalyzing}>
              {isAnalyzing ? "Analyzing..." : "Analyze Source"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="lmnas-onboarding-card">
          <h2>2. Source Preview</h2>
          {analysis ? (
            <>
              <p className="lmnas-muted">
                Source: <strong>{analysis.source.sourceRef}</strong>
                {analysis.source.title ? ` | Title: ${analysis.source.title}` : ""}
              </p>
              <div className="lmnas-preview-grid">
                <article>
                  <h3>Visual Preview</h3>
                  <iframe className="lmnas-preview-frame" srcDoc={analysis.source.previewHtml} sandbox="" />
                </article>
                <article>
                  <h3>Imported Markup</h3>
                  <pre className="lmnas-code-preview">{analysis.source.previewHtml.slice(0, 3000)}</pre>
                </article>
              </div>
            </>
          ) : (
            <p className="lmnas-warning">Run analysis first.</p>
          )}
        </section>
      ) : null}

      {step === 2 && analysis ? (
        <section className="lmnas-onboarding-card">
          <h2>3. Detection Review</h2>
          <p className="lmnas-muted">
            Review each detected item visually. Import what you want, skip what you do not need.
          </p>

          <div className="lmnas-count-strip">
            <span className="lmnas-chip">Shells {selectedCounts.shells}</span>
            <span className="lmnas-chip">Blocks {selectedCounts.blocks}</span>
            <span className="lmnas-chip">Widgets {selectedCounts.widgets}</span>
            <span className="lmnas-chip">Actions {selectedCounts.actions}</span>
            <span className="lmnas-chip">Exits {selectedCounts.exits}</span>
          </div>

          <h3>Shell Candidates</h3>
          <div className="lmnas-detect-grid">
            {analysis.shellCandidates.map((candidate) => (
              <article key={candidate.id} className={`lmnas-detect-card ${itemImportState[candidate.id] === false ? "lmnas-detect-card-skipped" : ""}`}>
                <header>
                  <span className={chipStyleForType("shell")}>{candidate.type}</span>
                  <span className="lmnas-chip">{Math.round(candidate.confidence * 100)}% confidence</span>
                </header>
                <div className="lmnas-detect-preview" dangerouslySetInnerHTML={{ __html: candidate.previewHtml ?? "<div>No preview</div>" }} />
                <p>{candidate.selectorHint}</p>
                <p className="lmnas-muted">Fields: {candidate.editableFields.join(", ") || "menu items"}</p>
                {renderCardControls(candidate.id)}
                <label className="lmnas-onboarding-field">
                  <span>Map to existing (optional)</span>
                  <input value={mapToExisting[candidate.id] ?? ""} onChange={(event) => setMapToExisting((previous) => ({ ...previous, [candidate.id]: event.target.value }))} placeholder="Existing Shell/Menu ID" />
                </label>
              </article>
            ))}
          </div>

          <h3>Block Candidates</h3>
          <div className="lmnas-detect-grid">
            {analysis.blockProposals.map((block) => (
              <article key={block.id} className={`lmnas-detect-card ${itemImportState[block.id] === false ? "lmnas-detect-card-skipped" : ""}`}>
                <header>
                  <span className={chipStyleForType("block")}>{block.family}</span>
                  <span className="lmnas-chip">{Math.round(block.confidence * 100)}% confidence</span>
                </header>
                <div className="lmnas-detect-preview" dangerouslySetInnerHTML={{ __html: block.previewHtml ?? "<div>No preview</div>" }} />
                <p>{block.selectorHint}</p>
                <div className="lmnas-chip-list">
                  {block.editableFields.map((field) => (
                    <span key={field} className="lmnas-chip">
                      {field}
                    </span>
                  ))}
                </div>
                <div className="lmnas-chip-list">
                  {block.ctaLabels.map((cta) => (
                    <span key={cta} className="lmnas-chip">
                      CTA: {cta}
                    </span>
                  ))}
                </div>
                {renderCardControls(block.id)}
                <label className="lmnas-onboarding-field">
                  <span>Classify as</span>
                  <select value={itemTypeOverrides[block.id] ?? "block"} onChange={(event) => setItemTypeOverrides((previous) => ({ ...previous, [block.id]: event.target.value as OnboardingItemType }))}>
                    {ITEM_TYPE_OPTIONS.map((itemType) => (
                      <option key={itemType} value={itemType}>
                        {itemType}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="lmnas-onboarding-field">
                  <span>Split / Merge</span>
                  <select value={segmentationOverrides[block.id] ?? block.segmentation} onChange={(event) => setSegmentationOverrides((previous) => ({ ...previous, [block.id]: event.target.value as SegmentationMode }))}>
                    {SEGMENTATION_OPTIONS.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </label>
              </article>
            ))}
          </div>

          <h3>Widget Candidates</h3>
          <div className="lmnas-detect-grid">
            {analysis.widgetProposals.map((widget) => (
              <article key={widget.id} className={`lmnas-detect-card ${itemImportState[widget.id] === false ? "lmnas-detect-card-skipped" : ""}`}>
                <header>
                  <span className={chipStyleForType("widget")}>{widget.widgetType}</span>
                  <span className="lmnas-chip">{Math.round(widget.confidence * 100)}% confidence</span>
                </header>
                <div className="lmnas-detect-preview" dangerouslySetInnerHTML={{ __html: widget.previewHtml ?? "<div>No preview</div>" }} />
                <p>{widget.name}</p>
                <div className="lmnas-chip-list">
                  {widget.triggerLabels.map((label) => (
                    <span key={label} className="lmnas-chip">
                      Trigger: {label}
                    </span>
                  ))}
                </div>
                {renderCardControls(widget.id)}
                <label className="lmnas-onboarding-field">
                  <span>Map to existing widget (optional)</span>
                  <input value={mapToExisting[widget.id] ?? ""} onChange={(event) => setMapToExisting((previous) => ({ ...previous, [widget.id]: event.target.value }))} placeholder="Existing Widget ID" />
                </label>
              </article>
            ))}
          </div>

          <h3>Action Candidates</h3>
          <div className="lmnas-detect-grid">
            {analysis.actionProposals.map((action) => (
              <article key={action.id} className={`lmnas-detect-card ${itemImportState[action.id] === false ? "lmnas-detect-card-skipped" : ""}`}>
                <header>
                  <span className={chipStyleForType("action")}>{action.actionType}</span>
                  <span className="lmnas-chip">{Math.round(action.confidence * 100)}% confidence</span>
                </header>
                <div className="lmnas-detect-preview" dangerouslySetInnerHTML={{ __html: action.previewHtml ?? "<div>No preview</div>" }} />
                <p>
                  <strong>{action.label}</strong>
                </p>
                <p className="lmnas-muted">{action.summary}</p>
                {renderCardControls(action.id)}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {step === 3 && analysis ? (
        <section className="lmnas-onboarding-card">
          <h2>4. Selection & Mapping</h2>
          <p className="lmnas-muted">Choose block families, editable fields, and model mapping before action wiring.</p>

          <h3>Blocks</h3>
          {analysis.blockProposals
            .filter((block) => itemImportState[block.id] !== false)
            .map((block) => (
              <div key={block.id} className="lmnas-onboarding-grid lmnas-map-row">
                <p>
                  <strong>{block.id}</strong>
                </p>
                <label className="lmnas-onboarding-field">
                  <span>Block family</span>
                  <select value={blockFamilyOverrides[block.id] ?? block.family} onChange={(event) => setBlockFamilyOverrides((previous) => ({ ...previous, [block.id]: event.target.value as CanonicalBlockFamily }))}>
                    {BLOCK_FAMILIES.map((family) => (
                      <option key={family} value={family}>
                        {family}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="lmnas-onboarding-field">
                  <span>Editable fields (comma-separated)</span>
                  <input
                    value={(fieldOverrides[block.id] ?? block.editableFields).join(", ")}
                    onChange={(event) => setFieldOverrideFromText(block.id, event.target.value)}
                  />
                </label>
                <label className="lmnas-onboarding-field">
                  <span>Map to existing block (optional)</span>
                  <input
                    value={mapToExisting[block.id] ?? ""}
                    onChange={(event) => setMapToExisting((previous) => ({ ...previous, [block.id]: event.target.value }))}
                    placeholder="Existing Block Template ID"
                  />
                </label>
              </div>
            ))}

          <h3>Widgets</h3>
          {analysis.widgetProposals
            .filter((widget) => itemImportState[widget.id] !== false)
            .map((widget: OnboardingWidgetProposal) => (
              <div key={widget.id} className="lmnas-onboarding-grid lmnas-map-row">
                <p>
                  <strong>{widget.name}</strong> ({widget.widgetType})
                </p>
                <label className="lmnas-onboarding-field">
                  <span>Editable fields (comma-separated)</span>
                  <input
                    value={(fieldOverrides[widget.id] ?? widget.editableFields).join(", ")}
                    onChange={(event) => setFieldOverrideFromText(widget.id, event.target.value)}
                  />
                </label>
                <label className="lmnas-onboarding-field">
                  <span>Map to existing widget (optional)</span>
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
          <p className="lmnas-muted">
            Define what each CTA does. Advanced exit details only appear when you pick workflow-backed actions.
          </p>

          {analysis.actionProposals
            .filter((action) => itemImportState[action.id] !== false)
            .map((action) => {
              const type = actionTypeOverrides[action.id] ?? action.actionType;
              const target = actionTargetOverrides[action.id] ?? {};
              const defaultExitId = target.exitId ?? action.suggestedExitId ?? action.destination.value ?? `${action.id}_exit`;

              return (
                <article key={action.id} className="lmnas-action-card">
                  <header>
                    <strong>{action.label}</strong>
                    <span className="lmnas-chip">{action.summary}</span>
                  </header>

                  <div className="lmnas-onboarding-grid">
                    <label className="lmnas-onboarding-field">
                      <span>CTA label</span>
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
                      <select
                        value={target.widgetId ?? action.destination.value ?? ""}
                        onChange={(event) => setActionTarget(action.id, { widgetId: event.target.value })}
                      >
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
          <p className="lmnas-muted">Preview what will be created in Strapi. Apply only when the summary looks right.</p>

          <div className="lmnas-onboarding-actions">
            <button onClick={() => publish("dry-run")} disabled={isPublishing} data-primary="true">
              {isPublishing ? "Building preview..." : "Preview What Will Be Created"}
            </button>
            <button onClick={() => publish("apply")} disabled={isPublishing}>
              Publish to Strapi
            </button>
          </div>

          {publishResult ? (
            <>
              <div className="lmnas-summary-grid">
                <article>
                  <h3>{publishResult.summary.shellsToCreate}</h3>
                  <p>Shells to create</p>
                </article>
                <article>
                  <h3>{publishResult.summary.blocksToCreate}</h3>
                  <p>Blocks to create</p>
                </article>
                <article>
                  <h3>{publishResult.summary.widgetsToCreate}</h3>
                  <p>Widgets to create</p>
                </article>
                <article>
                  <h3>{publishResult.summary.actionsToCreate}</h3>
                  <p>Actions to create</p>
                </article>
                <article>
                  <h3>{publishResult.summary.exitsRequired}</h3>
                  <p>Exits required</p>
                </article>
                <article>
                  <h3>{publishResult.summary.editableFieldsCreated}</h3>
                  <p>Editable fields in Strapi</p>
                </article>
              </div>

              <p className={publishResult.applied ? "lmnas-success" : "lmnas-warning"}>
                {publishResult.applied
                  ? "Changes were applied to Strapi."
                  : "Preview mode: no data was written to Strapi."}
              </p>

              {publishResult.previewLinks.length > 0 ? (
                <div>
                  <h3>Preview Links</h3>
                  {publishResult.previewLinks.map((link) => (
                    <p key={link}>
                      <a href={link} target="_blank" rel="noreferrer">
                        {link}
                      </a>
                    </p>
                  ))}
                </div>
              ) : null}

              {publishResult.warnings.length > 0 ? (
                <div>
                  <h3>Warnings Requiring Review</h3>
                  {publishResult.warnings.map((warning) => (
                    <p key={warning.code} className={warning.severity === "error" ? "lmnas-error" : warning.severity === "warning" ? "lmnas-warning" : "lmnas-muted"}>
                      <strong>{warning.code}</strong>: {warning.message}
                    </p>
                  ))}
                </div>
              ) : null}

              <details>
                <summary>Developer details (JSON)</summary>
                <pre>{JSON.stringify(publishResult.strapiPayload, null, 2)}</pre>
              </details>
            </>
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
