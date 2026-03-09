"use client";

import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
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
    OnboardingSourceType,
    OnboardingWidgetProposal,
    SegmentationMode
} from "@lmnas/contracts";
import { StepIndicator } from "../_components/StepIndicator";
import { PreviewPane } from "../_components/PreviewPane";
import { FidelityDisplay } from "../_components/FidelityDisplay";

/* ─── Project Styles ─── */

function useProjectStyles(): string {
    const [styles, setStyles] = useState("");
    useEffect(() => {
        const styleTags = Array.from(document.querySelectorAll("style"));
        const linkTags = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
        let collected = styleTags.map((s) => s.outerHTML).join("\n");
        collected += linkTags.map((l) => l.outerHTML).join("\n");
        setStyles(collected);
    }, []);
    return styles;
}

function injectProjectStyles(html: string, projectStyles: string): string {
    if (!projectStyles || !html) return html;
    const cleaned = html
        .replace(/<script[^>]*src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<script[^>]*id=["']tailwind-config["'][^>]*>[\s\S]*?<\/script>/gi, "");
    const idx = cleaned.indexOf("</head>");
    if (idx >= 0) return cleaned.slice(0, idx) + projectStyles + cleaned.slice(idx);
    return `<html><head>${projectStyles}</head><body>${cleaned}</body></html>`;
}

/* ─── Source type cards ─── */

const SOURCE_OPTIONS: Array<{ value: OnboardingSourceType; label: string; icon: string; desc: string }> = [
    { value: "raw_html", label: "HTML Paste", icon: "code", desc: "Paste section HTML directly" },
    { value: "url", label: "Website URL", icon: "language", desc: "Import from a live page" },
    { value: "stitch_section", label: "Stitch Section", icon: "content_cut", desc: "Section snapshot from Stitch" },
    { value: "stitch_full_page", label: "Stitch Full Page", icon: "crop_free", desc: "Full page from Stitch" },
    { value: "figma_section", label: "Figma Section", icon: "design_services", desc: "Section export from Figma" },
    { value: "figma_full_page", label: "Figma Full Page", icon: "web_stories", desc: "Full page export from Figma" }
];

const BLOCK_FAMILIES: CanonicalBlockFamily[] = [
    "hero", "logo_wall", "problem_grid", "feature_grid", "testimonial_list",
    "stats_band", "process_steps", "cta_banner", "faq", "rich_text_section",
    "comparison_table", "pricing_teaser", "contact_strip", "authority_section",
    "case_highlight", "timeline", "split_content_media", "form_section", "embedded_asset_section"
];

const ACTION_TYPES: Array<{ value: ActionType; label: string }> = [
    { value: "link_url", label: "Navigate to page / URL" },
    { value: "scroll_to_section", label: "Scroll to section" },
    { value: "open_modal", label: "Open modal" },
    { value: "open_drawer", label: "Open drawer" },
    { value: "open_widget", label: "Open widget" },
    { value: "submit_form", label: "Submit form" },
    { value: "download_asset", label: "Download asset" },
    { value: "external_booking", label: "Open external booking" },
    { value: "workflow", label: "Trigger backend workflow" }
];

const STEPS = [
    "Source",
    "Reference Preview",
    "Production Preview",
    "Detection Review",
    "Action Mapping",
    "Publish Block"
] as const;

/* ─── Types ─── */

interface ActionTargetOverride {
    url?: string;
    sectionId?: string;
    widgetId?: string;
    exitId?: string;
}

/* ─── Component ─── */

export default function BlockImportPage() {
    const projectStyles = useProjectStyles();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [step, setStep] = useState(0);

    // Intake
    const [sourceType, setSourceType] = useState<OnboardingSourceType>("raw_html");
    const [sourceValue, setSourceValue] = useState("");

    // Analysis
    const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null);
    const [publishResult, setPublishResult] = useState<OnboardingPublishResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Detection state
    const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
    const [itemImportState, setItemImportState] = useState<Record<string, boolean>>({});
    const [displayNameOverrides, setDisplayNameOverrides] = useState<Record<string, string>>({});
    const [blockFamilyOverrides, setBlockFamilyOverrides] = useState<Record<string, CanonicalBlockFamily>>({});
    const [fieldOverrides, setFieldOverrides] = useState<Record<string, string[]>>({});
    const [actionTypeOverrides, setActionTypeOverrides] = useState<Record<string, ActionType>>({});
    const [actionTargetOverrides, setActionTargetOverrides] = useState<Record<string, ActionTargetOverride>>({});
    const [itemTypeOverrides, setItemTypeOverrides] = useState<Record<string, OnboardingItemType>>({});
    const [segmentationOverrides, setSegmentationOverrides] = useState<Record<string, SegmentationMode>>({});
    const [mapToExisting, setMapToExisting] = useState<Record<string, string>>({});
    const [exitStateOverrides, setExitStateOverrides] = useState<Record<string, "active" | "inactive">>({});

    // Action mapping state
    const [selectedActionIndex, setSelectedActionIndex] = useState(0);

    const canAnalyze = sourceValue.trim().length > 0;
    const input = "w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40";

    /* ─── File upload ─── */

    function handleFileUpload(file: File) {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") setSourceValue(reader.result);
        };
        reader.readAsText(file);
    }

    /* ─── Analysis ─── */

    async function runAnalysis() {
        setError(null);
        setIsAnalyzing(true);
        try {
            const res = await fetch("/api/platform/onboarding/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sourceType, sourceValue, slug: "block-import", locale: "en", themeKey: "default" })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error ?? "Analysis failed");
            setAnalysis(data);
            const toggles: Record<string, boolean> = {};
            for (const b of data.blockProposals ?? []) toggles[b.id] = true;
            for (const w of data.widgetProposals ?? []) toggles[w.id] = true;
            for (const a of data.actionProposals ?? []) toggles[a.id] = true;
            setItemImportState(toggles);
            setSelectedBlockIndex(0);
            setSelectedActionIndex(0);
            setStep(1);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        setIsAnalyzing(false);
    }

    /* ─── Publish (blocks only) ─── */

    async function publish(mode: "dry-run" | "apply") {
        if (!analysis) return;
        setIsPublishing(true);
        try {
            const res = await fetch("/api/platform/onboarding/publish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode,
                    analysis,
                    overrides: {
                        itemImportState, itemTypeOverrides, displayNameOverrides,
                        blockFamilyOverrides, fieldOverrides, segmentationOverrides,
                        actionTypeOverrides, actionLabelOverrides: {}, actionTargetOverrides,
                        exitStateOverrides, mapToExisting
                    }
                })
            });
            const data = await res.json();
            if (data.result) setPublishResult(data.result);
            else if (data.error) setError(data.error);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        setIsPublishing(false);
    }

    /* ─── Block helpers ─── */

    const blocks = analysis?.blockProposals ?? [];
    const importedBlocks = blocks.filter((b) => itemImportState[b.id] !== false);
    const currentBlock = blocks[selectedBlockIndex] ?? null;

    const allActions = analysis?.actionProposals ?? [];
    const importedActions = allActions.filter((a) => itemImportState[a.id] !== false);
    const currentAction = importedActions[selectedActionIndex] ?? null;

    const blockActions = useMemo(() => {
        if (!analysis || !currentBlock) return [];
        return analysis.actionProposals.filter(
            (a) => a.sourceItemId === currentBlock.id || currentBlock.actionIds.includes(a.id)
        );
    }, [analysis, currentBlock]);

    function skipBlock(blockId: string) {
        const newState = { ...itemImportState, [blockId]: false };
        if (analysis) {
            const block = analysis.blockProposals.find((b) => b.id === blockId);
            if (block) {
                block.actionIds.forEach((aid) => { newState[aid] = false; });
                analysis.widgetProposals.forEach((w) => {
                    if (block.actionIds.some((aid) => {
                        const action = analysis.actionProposals.find((a) => a.id === aid);
                        return action?.destination.kind === "widget" && action.destination.value === w.id;
                    })) {
                        newState[w.id] = false;
                    }
                });
            }
        }
        setItemImportState(newState);
    }

    function buildCardPreview(snippet: string | undefined): string {
        if (!snippet) return "<p style='padding:16px;color:#666'>No preview</p>";
        return buildDetectionThumbnailDocument({
            sourcePreviewHtml: analysis?.source?.productionPreviewHtml ?? "",
            snippet,
            baseUrl: analysis?.source?.baseUrl ?? ""
        });
    }

    function getActionParentBlock(action: OnboardingActionProposal): OnboardingBlockProposal | undefined {
        return analysis?.blockProposals.find(
            (b) => b.id === action.sourceItemId || b.actionIds.includes(action.id)
        );
    }

    /* ─── Render ─── */

    return (
        <div className="max-w-[1400px] mx-auto flex flex-col gap-5">
            {/* Header */}
            <header>
                <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-2xl text-violet-400">dashboard_customize</span>
                    Block Import
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">Import sections and components as reusable blocks. This creates blocks only — not pages.</p>
            </header>

            <StepIndicator steps={STEPS} current={step} onStepClick={(i) => i <= step && setStep(i)} />

            {error && (
                <div className="rounded-lg bg-red-500/[0.08] border border-red-500/15 p-3">
                    <p className="text-xs text-red-400">{error}</p>
                </div>
            )}

            {/* ── Step 0: Source Intake ── */}
            {step === 0 && (
                <section className="flex flex-col gap-5">
                    {/* Source type selection – visual cards */}
                    <div>
                        <h2 className="text-sm font-semibold text-slate-300 mb-3">Choose source type</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                            {SOURCE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { setSourceType(opt.value); setSourceValue(""); }}
                                    className={`flex flex-col items-center gap-2 rounded-xl p-4 text-center transition-all cursor-pointer ${sourceType === opt.value
                                            ? "bg-blue-500/[0.1] border border-blue-500/25"
                                            : "bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12]"
                                        }`}
                                >
                                    <span className={`material-symbols-outlined text-2xl ${sourceType === opt.value ? "text-blue-400" : "text-slate-500"}`}>
                                        {opt.icon}
                                    </span>
                                    <span className={`text-xs font-semibold ${sourceType === opt.value ? "text-blue-300" : "text-slate-400"}`}>
                                        {opt.label}
                                    </span>
                                    <span className="text-[10px] text-slate-600 leading-tight">{opt.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Source input */}
                    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5">
                        {sourceType === "url" ? (
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">URL</span>
                                <input className={input} value={sourceValue} onChange={(e) => setSourceValue(e.target.value)} placeholder="https://example.com/landing" />
                            </label>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        {sourceType.startsWith("figma") ? "Figma Export HTML" : sourceType.startsWith("stitch") ? "Stitch Artifact HTML" : "HTML Source"}
                                    </span>
                                    <textarea className={`${input} min-h-[200px] font-mono text-xs`} value={sourceValue} onChange={(e) => setSourceValue(e.target.value)} placeholder="<section>...</section>" />
                                </label>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] cursor-pointer transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-sm">upload_file</span>
                                        Upload HTML file
                                    </button>
                                    <input ref={fileInputRef} type="file" accept=".html,.htm,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                                    {sourceValue && <span className="text-[10px] text-slate-600">{sourceValue.length.toLocaleString()} characters loaded</span>}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={runAnalysis}
                        disabled={!canAnalyze || isAnalyzing}
                        className="self-start px-6 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isAnalyzing ? "Analyzing…" : "Analyze Source →"}
                    </button>
                </section>
            )}

            {/* ── Step 1: Reference Preview ── */}
            {step === 1 && analysis && (
                <section className="flex flex-col gap-4">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-300 mb-1">Reference Preview</h2>
                        <p className="text-xs text-slate-500">This shows the source with its original styling. Validate against your reference screenshot.</p>
                    </div>
                    <PreviewPane title="Reference Design" badge="Original" srcDoc={analysis.source.referencePreviewHtml} testId="reference-preview" />
                    <div className="flex justify-end">
                        <button type="button" onClick={() => setStep(2)} className="px-5 py-2 rounded-lg bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:brightness-110 cursor-pointer">
                            Continue →
                        </button>
                    </div>
                </section>
            )}

            {/* ── Step 2: Production Preview + Fidelity ── */}
            {step === 2 && analysis && (
                <section className="flex flex-col gap-4">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-300 mb-1">Production Preview &amp; Fidelity</h2>
                        <p className="text-xs text-slate-500">Compare how blocks render with the active project theme versus the original reference.</p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <PreviewPane title="Reference" badge="Original" srcDoc={analysis.source.referencePreviewHtml} minHeight="450px" />
                        <PreviewPane title="Production" badge="Project Theme" srcDoc={injectProjectStyles(analysis.source.productionPreviewHtml, projectStyles)} minHeight="450px" />
                    </div>

                    <FidelityDisplay
                        score={analysis.theme.tokenFirstMatchRatio}
                        arbitraryValueCount={analysis.theme.arbitraryValueCount}
                        hasDarkMode={analysis.theme.hasDarkModeTrigger}
                        extractedFonts={analysis.theme.extractedFonts}
                        themeDebtSummary={analysis.theme.themeDebtSummary}
                    />

                    {analysis.theme.tokenFirstMatchRatio < 0.5 && (
                        <div className="rounded-lg bg-amber-500/[0.06] border border-amber-500/15 p-3">
                            <p className="text-xs text-amber-400"><strong>Low fidelity.</strong> Adapt source classes to project tokens, or update the active theme in the Theme Workflow.</p>
                        </div>
                    )}

                    <div className="flex justify-between">
                        <button type="button" onClick={() => setStep(1)} className="px-4 py-2 rounded-lg bg-white/[0.04] text-slate-400 text-xs font-semibold hover:bg-white/[0.08] cursor-pointer">← Back</button>
                        <button type="button" onClick={() => setStep(3)} className="px-5 py-2 rounded-lg bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:brightness-110 cursor-pointer">Continue →</button>
                    </div>
                </section>
            )}

            {/* ── Step 3: Detection Review — One block at a time ── */}
            {step === 3 && analysis && (
                <section className="flex flex-col gap-4">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-300 mb-1">Detection Review</h2>
                        <p className="text-xs text-slate-500">Review each detected block. Import or skip blocks individually.</p>
                    </div>

                    <div className="grid gap-4" style={{ gridTemplateColumns: "260px 1fr" }}>
                        {/* Block list */}
                        <div className="flex flex-col gap-1.5 overflow-y-auto pr-1" style={{ maxHeight: "700px" }}>
                            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-1">{blocks.length} detected</p>
                            {blocks.map((block, i) => (
                                <button
                                    key={block.id}
                                    type="button"
                                    onClick={() => setSelectedBlockIndex(i)}
                                    className={`flex items-center gap-2.5 rounded-lg p-2.5 text-left transition-all cursor-pointer ${selectedBlockIndex === i
                                            ? "bg-blue-500/[0.1] border border-blue-500/20"
                                            : itemImportState[block.id] === false
                                                ? "bg-white/[0.01] border border-white/[0.03] opacity-40"
                                                : "bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1]"
                                        }`}
                                >
                                    <span className={`flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold ${selectedBlockIndex === i ? "bg-blue-500 text-white" :
                                            itemImportState[block.id] === false ? "bg-white/[0.04] text-slate-600 line-through" :
                                                "bg-violet-500/15 text-violet-400"
                                        }`}>{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-medium truncate ${itemImportState[block.id] === false ? "text-slate-600 line-through" : "text-slate-300"}`}>
                                            {displayNameOverrides[block.id] ?? block.displayName ?? block.family.replaceAll("_", " ")}
                                        </p>
                                        <p className="text-[10px] text-slate-600">{Math.round(block.confidence * 100)}%</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Block detail workspace */}
                        {currentBlock && (
                            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                                <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-200">
                                            {displayNameOverrides[currentBlock.id] ?? currentBlock.displayName ?? currentBlock.family.replaceAll("_", " ")}
                                        </h3>
                                        <p className="text-[10px] text-slate-600 font-mono">{currentBlock.selectorHint}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {itemImportState[currentBlock.id] !== false ? (
                                            <button type="button" onClick={() => skipBlock(currentBlock.id)} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 cursor-pointer">Skip</button>
                                        ) : (
                                            <button type="button" onClick={() => setItemImportState((p) => ({ ...p, [currentBlock.id]: true }))} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 cursor-pointer">Import</button>
                                        )}
                                    </div>
                                </header>

                                <div className="p-5 flex flex-col gap-4 max-h-[600px] overflow-y-auto">
                                    {/* Large block preview */}
                                    <iframe
                                        className="w-full rounded-lg border border-white/[0.06] bg-white"
                                        style={{ minHeight: "280px", height: "280px" }}
                                        srcDoc={injectProjectStyles(buildCardPreview(currentBlock.previewHtml), projectStyles)}
                                        sandbox="allow-scripts allow-same-origin"
                                        title={`${currentBlock.id} preview`}
                                    />

                                    {/* Metrics row */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                                            <p className={`text-lg font-bold ${currentBlock.confidence >= 0.8 ? "text-emerald-400" : currentBlock.confidence >= 0.5 ? "text-amber-400" : "text-red-400"}`}>
                                                {Math.round(currentBlock.confidence * 100)}%
                                            </p>
                                            <p className="text-[10px] text-slate-500">Confidence</p>
                                        </div>
                                        <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                                            <p className="text-lg font-bold text-slate-300">{currentBlock.editableFields.length}</p>
                                            <p className="text-[10px] text-slate-500">Fields</p>
                                        </div>
                                        <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                                            <p className="text-lg font-bold text-slate-300">{blockActions.length}</p>
                                            <p className="text-[10px] text-slate-500">Actions</p>
                                        </div>
                                    </div>

                                    {/* Mapping */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="flex flex-col gap-1">
                                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Display Name</span>
                                            <input className={input} value={displayNameOverrides[currentBlock.id] ?? currentBlock.displayName ?? currentBlock.family.replaceAll("_", " ")} onChange={(e) => setDisplayNameOverrides((p) => ({ ...p, [currentBlock.id]: e.target.value }))} />
                                        </label>
                                        <label className="flex flex-col gap-1">
                                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Block Family</span>
                                            <select className={input} value={blockFamilyOverrides[currentBlock.id] ?? currentBlock.family} onChange={(e) => setBlockFamilyOverrides((p) => ({ ...p, [currentBlock.id]: e.target.value as CanonicalBlockFamily }))}>
                                                {BLOCK_FAMILIES.map((f) => <option key={f} value={f}>{f.replaceAll("_", " ")}</option>)}
                                            </select>
                                        </label>
                                    </div>

                                    {/* Fields summary */}
                                    {currentBlock.editableFields.length > 0 && (
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Editable Fields</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {currentBlock.editableFields.map((f) => (
                                                    <span key={f.fieldKey} className="text-[10px] font-mono bg-white/[0.04] border border-white/[0.06] rounded px-2 py-0.5 text-slate-400">
                                                        {f.fieldKey} <span className="text-slate-600">({f.fieldType})</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions summary */}
                                    {blockActions.length > 0 && (
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Linked Actions</p>
                                            <div className="flex flex-col gap-1.5">
                                                {blockActions.map((a) => (
                                                    <div key={a.id} className="flex items-center gap-2 rounded-lg bg-white/[0.02] border border-white/[0.04] p-2">
                                                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/15 rounded px-1.5 py-0.5">{a.actionType.replaceAll("_", " ")}</span>
                                                        <span className="text-xs text-slate-300">{a.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between">
                        <button type="button" onClick={() => setStep(2)} className="px-4 py-2 rounded-lg bg-white/[0.04] text-slate-400 text-xs font-semibold hover:bg-white/[0.08] cursor-pointer">← Back</button>
                        <button type="button" onClick={() => setStep(4)} className="px-5 py-2 rounded-lg bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:brightness-110 cursor-pointer">Continue →</button>
                    </div>
                </section>
            )}

            {/* ── Step 4: Action Mapping — one at a time, block-contextual ── */}
            {step === 4 && analysis && (
                <section className="flex flex-col gap-4">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-300 mb-1">Action Mapping</h2>
                        <p className="text-xs text-slate-500">Configure each action. Context shows the parent block and CTA position.</p>
                    </div>

                    {importedActions.length === 0 ? (
                        <div className="rounded-xl bg-white/[0.02] border border-dashed border-white/[0.06] p-8 text-center">
                            <span className="material-symbols-outlined text-3xl text-slate-700">touch_app</span>
                            <p className="text-sm text-slate-500 mt-2">No actions to map. All linked actions were skipped.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4" style={{ gridTemplateColumns: "260px 1fr" }}>
                            {/* Action list */}
                            <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: "600px" }}>
                                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-1">{importedActions.length} actions</p>
                                {importedActions.map((action, i) => {
                                    const parent = getActionParentBlock(action);
                                    return (
                                        <button
                                            key={action.id}
                                            type="button"
                                            onClick={() => setSelectedActionIndex(i)}
                                            className={`flex flex-col gap-0.5 rounded-lg p-2.5 text-left transition-all cursor-pointer ${selectedActionIndex === i
                                                    ? "bg-blue-500/[0.1] border border-blue-500/20"
                                                    : "bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1]"
                                                }`}
                                        >
                                            <p className="text-xs font-medium text-slate-300 truncate">{action.label}</p>
                                            <p className="text-[10px] text-slate-600 truncate">
                                                {parent ? parent.displayName ?? parent.family.replaceAll("_", " ") : "Orphan"}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Action detail */}
                            {currentAction && (() => {
                                const parentBlock = getActionParentBlock(currentAction);
                                return (
                                    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                                        <header className="border-b border-white/[0.06] px-5 py-3">
                                            <h3 className="text-sm font-bold text-slate-200">{currentAction.label}</h3>
                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                Parent block: <span className="text-violet-400 font-medium">{parentBlock?.displayName ?? parentBlock?.family.replaceAll("_", " ") ?? "Unknown"}</span>
                                            </p>
                                        </header>

                                        <div className="p-5 flex flex-col gap-4">
                                            {/* Block context preview */}
                                            {parentBlock?.previewHtml && (
                                                <div>
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Block Context</p>
                                                    <iframe
                                                        className="w-full rounded-lg border border-white/[0.06] bg-white"
                                                        style={{ height: "160px" }}
                                                        srcDoc={injectProjectStyles(buildCardPreview(parentBlock.previewHtml), projectStyles)}
                                                        sandbox="allow-scripts allow-same-origin"
                                                        title="Block context"
                                                    />
                                                </div>
                                            )}

                                            {/* Action details */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
                                                    <p className="text-[10px] text-slate-500 uppercase mb-1">CTA Text</p>
                                                    <p className="text-sm font-semibold text-slate-200">{currentAction.label}</p>
                                                </div>
                                                <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
                                                    <p className="text-[10px] text-slate-500 uppercase mb-1">CTA Kind</p>
                                                    <p className="text-sm text-slate-300">{currentAction.ctaKind}</p>
                                                </div>
                                            </div>

                                            <label className="flex flex-col gap-1">
                                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Action Type</span>
                                                <select
                                                    className={input}
                                                    value={actionTypeOverrides[currentAction.id] ?? currentAction.actionType}
                                                    onChange={(e) => setActionTypeOverrides((p) => ({ ...p, [currentAction.id]: e.target.value as ActionType }))}
                                                >
                                                    {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                </select>
                                            </label>

                                            <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
                                                <p className="text-[10px] text-slate-500 uppercase mb-1">Resulting Behavior</p>
                                                <p className="text-xs text-slate-300">{currentAction.summary}</p>
                                            </div>

                                            {/* Advanced / technical (collapsible) */}
                                            <details className="group">
                                                <summary className="text-[10px] text-slate-600 cursor-pointer hover:text-slate-400 uppercase tracking-wider">Advanced details</summary>
                                                <div className="mt-2 rounded-lg bg-white/[0.02] border border-white/[0.04] p-3 text-[10px] font-mono text-slate-500 space-y-1">
                                                    <p>Selector: {currentAction.selectorHint}</p>
                                                    <p>Destination: {currentAction.destination.kind} → {currentAction.destination.value ?? "none"}</p>
                                                    {currentAction.suggestedExitId && <p>Exit ID: {currentAction.suggestedExitId}</p>}
                                                </div>
                                            </details>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    <div className="flex justify-between">
                        <button type="button" onClick={() => setStep(3)} className="px-4 py-2 rounded-lg bg-white/[0.04] text-slate-400 text-xs font-semibold hover:bg-white/[0.08] cursor-pointer">← Back</button>
                        <button type="button" onClick={() => setStep(5)} className="px-5 py-2 rounded-lg bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:brightness-110 cursor-pointer">Continue →</button>
                    </div>
                </section>
            )}

            {/* ── Step 5: Publish Block ── */}
            {step === 5 && analysis && (
                <section className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-300 mb-1">Publish Blocks</h2>
                            <p className="text-xs text-slate-500">Create block structures in Strapi. No pages will be created.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => publish("dry-run")} disabled={isPublishing} className="px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-slate-300 text-xs font-semibold hover:bg-white/[0.1] disabled:opacity-40 cursor-pointer">
                                Preview
                            </button>
                            <button onClick={() => publish("apply")} disabled={isPublishing} className="px-5 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 hover:brightness-110 disabled:opacity-40 cursor-pointer">
                                {isPublishing ? "Publishing…" : "Publish to Strapi"}
                            </button>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: "Blocks", count: importedBlocks.length, color: "text-violet-400" },
                            { label: "Actions", count: importedActions.length, color: "text-amber-400" },
                            { label: "Fields", count: importedBlocks.reduce((s, b) => s + b.editableFields.length, 0), color: "text-slate-300" }
                        ].map(({ label, count, color }) => (
                            <div key={label} className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                                <p className={`text-xl font-bold ${color}`}>{count}</p>
                                <p className="text-[10px] text-slate-500">{label}</p>
                            </div>
                        ))}
                    </div>

                    <FidelityDisplay
                        score={analysis.theme.tokenFirstMatchRatio}
                        arbitraryValueCount={analysis.theme.arbitraryValueCount}
                        hasDarkMode={analysis.theme.hasDarkModeTrigger}
                        extractedFonts={analysis.theme.extractedFonts}
                        themeDebtSummary={analysis.theme.themeDebtSummary}
                    />

                    <PreviewPane
                        title="Production Preview"
                        badge="Project Theme"
                        srcDoc={injectProjectStyles(analysis.source.productionPreviewHtml, projectStyles)}
                        testId="publish-preview"
                        minHeight="500px"
                    />

                    {publishResult && (
                        <div className={`rounded-lg border p-3 ${publishResult.applied ? "bg-emerald-500/[0.08] border-emerald-500/20" : "bg-amber-500/[0.06] border-amber-500/15"}`}>
                            <p className={`text-sm font-medium ${publishResult.applied ? "text-emerald-400" : "text-amber-400"}`}>
                                {publishResult.applied ? "Blocks published to Strapi." : publishResult.applyReadiness.operatorMessage}
                            </p>
                        </div>
                    )}

                    {publishResult?.warnings.length ? (
                        <div className="flex flex-col gap-1.5">
                            {publishResult.warnings.map((w) => (
                                <div key={w.code} className={`rounded-lg border p-2.5 ${w.severity === "error" ? "bg-red-500/[0.06] border-red-500/15" : w.severity === "warning" ? "bg-amber-500/[0.06] border-amber-500/15" : "bg-white/[0.02] border-white/[0.05]"}`}>
                                    <p className={`text-[11px] ${w.severity === "error" ? "text-red-400" : w.severity === "warning" ? "text-amber-400" : "text-slate-400"}`}>
                                        <strong>{w.code}</strong>: {w.message}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    <div className="flex justify-start">
                        <button type="button" onClick={() => setStep(4)} className="px-4 py-2 rounded-lg bg-white/[0.04] text-slate-400 text-xs font-semibold hover:bg-white/[0.08] cursor-pointer">← Back</button>
                    </div>
                </section>
            )}
        </div>
    );
}
