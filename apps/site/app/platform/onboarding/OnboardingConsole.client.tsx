"use client";

import React, { useMemo, useState } from "react";
import type {
  CanonicalBlockFamily,
  OnboardingAnalysis,
  OnboardingPublishResult,
  OnboardingSourceType
} from "@lmnas/contracts";

const SOURCE_TYPES: OnboardingSourceType[] = [
  "url",
  "raw_html",
  "figma_section",
  "figma_full_page",
  "stitch_section",
  "stitch_full_page"
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

type IntakeFormState = {
  sourceType: OnboardingSourceType;
  sourceValue: string;
  slug: string;
  locale: string;
  themeKey: string;
};

export function OnboardingConsole() {
  const [intake, setIntake] = useState<IntakeFormState>({
    sourceType: "raw_html",
    sourceValue:
      "<nav><a href='/products'>Products</a></nav><section><h1>Hero</h1><a href='/book'>Book Appointment</a></section><footer><a href='/privacy'>Privacy</a></footer>",
    slug: "home",
    locale: "en",
    themeKey: "default"
  });
  const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null);
  const [publishResult, setPublishResult] = useState<OnboardingPublishResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shellVariantId, setShellVariantId] = useState("");
  const [navbarVariantId, setNavbarVariantId] = useState("");
  const [footerVariantId, setFooterVariantId] = useState("");

  const [blockFamilyOverrides, setBlockFamilyOverrides] = useState<Record<string, CanonicalBlockFamily>>({});
  const [exitStateOverrides, setExitStateOverrides] = useState<Record<string, "active" | "inactive">>({});

  const canAnalyze = intake.sourceValue.trim().length > 0 && intake.slug.trim().length > 0 && intake.locale.trim().length > 0;

  const sortedBlocks = useMemo(() => analysis?.blockProposals ?? [], [analysis]);

  function updateIntake<K extends keyof IntakeFormState>(key: K, value: IntakeFormState[K]) {
    setIntake((previous) => ({
      ...previous,
      [key]: value
    }));
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

      const payload = (await response.json()) as { ok: boolean; analysis?: OnboardingAnalysis; error?: string };
      if (!payload.ok || !payload.analysis) {
        throw new Error(payload.error ?? "Analysis failed");
      }

      setAnalysis(payload.analysis);
      setShellVariantId(`shell-${payload.analysis.intake.slug}`);
      setNavbarVariantId(`navbar-${payload.analysis.intake.slug}`);
      setFooterVariantId(`footer-${payload.analysis.intake.slug}`);
      setBlockFamilyOverrides({});
      setExitStateOverrides({});
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : String(analysisError));
    } finally {
      setIsAnalyzing(false);
    }
  }

  function setBlockOverride(blockId: string, family: CanonicalBlockFamily) {
    setBlockFamilyOverrides((current) => ({
      ...current,
      [blockId]: family
    }));
  }

  function setExitOverride(exitId: string, state: "active" | "inactive") {
    setExitStateOverrides((current) => ({
      ...current,
      [exitId]: state
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
            shellVariantId,
            navbarVariantId,
            footerVariantId,
            blockFamilyOverrides,
            exitStateOverrides
          }
        })
      });

      const payload = (await response.json()) as { ok: boolean; result?: OnboardingPublishResult; error?: string };
      if (!payload.ok || !payload.result) {
        throw new Error(payload.error ?? "Publish failed");
      }

      setPublishResult(payload.result);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : String(publishError));
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <>
      <section className="lmnas-onboarding-card">
        <h2>Source Intake</h2>
        <div className="lmnas-onboarding-grid">
          <label className="lmnas-onboarding-field">
            <span>Source Type</span>
            <select value={intake.sourceType} onChange={(event) => updateIntake("sourceType", event.target.value as OnboardingSourceType)}>
              {SOURCE_TYPES.map((sourceType) => (
                <option key={sourceType} value={sourceType}>
                  {sourceType}
                </option>
              ))}
            </select>
          </label>
          <label className="lmnas-onboarding-field">
            <span>Slug</span>
            <input value={intake.slug} onChange={(event) => updateIntake("slug", event.target.value)} />
          </label>
          <label className="lmnas-onboarding-field">
            <span>Locale</span>
            <input value={intake.locale} onChange={(event) => updateIntake("locale", event.target.value)} />
          </label>
          <label className="lmnas-onboarding-field">
            <span>Theme Key</span>
            <input value={intake.themeKey} onChange={(event) => updateIntake("themeKey", event.target.value)} />
          </label>
        </div>
        <label className="lmnas-onboarding-field">
          <span>Source Value (URL, HTML, or artifact payload)</span>
          <textarea rows={8} value={intake.sourceValue} onChange={(event) => updateIntake("sourceValue", event.target.value)} />
        </label>
        <div className="lmnas-onboarding-actions">
          <button data-primary="true" onClick={runAnalysis} disabled={!canAnalyze || isAnalyzing}>
            {isAnalyzing ? "Analyzing..." : "Analyze Source"}
          </button>
        </div>
      </section>

      {error ? (
        <section className="lmnas-onboarding-card">
          <p className="lmnas-error">{error}</p>
        </section>
      ) : null}

      {analysis ? (
        <>
          <section className="lmnas-onboarding-card">
            <h2>Analysis</h2>
            <div className="lmnas-onboarding-grid">
              <div>
                <h3>Shell Candidates</h3>
                {analysis.shellCandidates.map((candidate) => (
                  <p key={candidate.id}>
                    <span className="lmnas-chip">{candidate.type}</span> {candidate.selectorHint} ({Math.round(candidate.confidence * 100)}%)
                  </p>
                ))}
              </div>
              <div>
                <h3>Theme Notes</h3>
                <p>
                  Token match: {Math.round(analysis.theme.tokenFirstMatchRatio * 100)}% | Arbitrary values: {analysis.theme.arbitraryValueCount}
                </p>
                <p>{analysis.theme.themeDebtSummary}</p>
              </div>
              <div>
                <h3>Detected Exits</h3>
                {analysis.exitProposals.map((proposal) => (
                  <p key={proposal.id}>
                    <span className="lmnas-chip">{proposal.id}</span> {proposal.name}
                  </p>
                ))}
              </div>
            </div>
          </section>

          <section className="lmnas-onboarding-card">
            <h2>Confirmation</h2>
            <div className="lmnas-onboarding-grid">
              <label className="lmnas-onboarding-field">
                <span>Shell Variant ID</span>
                <input value={shellVariantId} onChange={(event) => setShellVariantId(event.target.value)} />
              </label>
              <label className="lmnas-onboarding-field">
                <span>Navbar Variant ID</span>
                <input value={navbarVariantId} onChange={(event) => setNavbarVariantId(event.target.value)} />
              </label>
              <label className="lmnas-onboarding-field">
                <span>Footer Variant ID</span>
                <input value={footerVariantId} onChange={(event) => setFooterVariantId(event.target.value)} />
              </label>
            </div>

            <h3>Block Family Mapping</h3>
            {sortedBlocks.map((block) => (
              <div className="lmnas-onboarding-grid" key={block.id}>
                <p>
                  <strong>{block.id}</strong> ({Math.round(block.confidence * 100)}%)
                </p>
                <label className="lmnas-onboarding-field">
                  <span>Family</span>
                  <select
                    value={blockFamilyOverrides[block.id] ?? block.family}
                    onChange={(event) => setBlockOverride(block.id, event.target.value as CanonicalBlockFamily)}
                  >
                    {BLOCK_FAMILIES.map((family) => (
                      <option key={family} value={family}>
                        {family}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}

            <h3>Exit State Mapping</h3>
            {analysis.exitProposals.map((exit) => (
              <div className="lmnas-onboarding-grid" key={exit.id}>
                <p>
                  <strong>{exit.id}</strong> ({exit.name})
                </p>
                <label className="lmnas-onboarding-field">
                  <span>State</span>
                  <select value={exitStateOverrides[exit.id] ?? exit.state} onChange={(event) => setExitOverride(exit.id, event.target.value as "active" | "inactive")}>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </label>
              </div>
            ))}
          </section>

          <section className="lmnas-onboarding-card">
            <h2>Publish</h2>
            <div className="lmnas-onboarding-actions">
              <button onClick={() => publish("dry-run")} disabled={isPublishing} data-primary="true">
                {isPublishing ? "Publishing..." : "Publish Dry Run"}
              </button>
              <button onClick={() => publish("apply")} disabled={isPublishing}>
                Apply to Strapi
              </button>
            </div>
            {analysis.fidelityWarnings.length > 0 ? (
              <div>
                <h3>Fidelity/Theme Warnings</h3>
                {analysis.fidelityWarnings.map((warning) => (
                  <p key={warning.code} className={warning.severity === "error" ? "lmnas-error" : warning.severity === "warning" ? "lmnas-warning" : ""}>
                    <strong>{warning.code}</strong>: {warning.message}
                  </p>
                ))}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {publishResult ? (
        <section className="lmnas-onboarding-card">
          <h2>Result</h2>
          <p className={publishResult.applied ? "lmnas-success" : "lmnas-warning"}>
            Mode: {publishResult.mode} | Applied: {publishResult.applied ? "yes" : "no"}
          </p>
          <p>
            Shell variants: {publishResult.summary.shellVariants} | Blocks: {publishResult.summary.blockInstances} | Exits: {publishResult.summary.exitDefinitions}
          </p>
          <details>
            <summary>Strapi sync payload</summary>
            <pre>{JSON.stringify(publishResult.strapiPayload, null, 2)}</pre>
          </details>
        </section>
      ) : null}
    </>
  );
}
