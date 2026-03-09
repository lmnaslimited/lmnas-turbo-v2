"use client";

import React, { useEffect, useState } from "react";

/* ─── Theme Data Model ─── */

interface ThemeToken {
    key: string;
    label: string;
    category: "color" | "typography" | "spacing" | "radius" | "shadow";
    value: string;
    cssVariable: string;
    mapped: boolean;
}

interface ThemeRecord {
    id: string;
    name: string;
    status: "active" | "inactive" | "draft";
    sourceRef: string;
    createdAt: string;
    updatedAt: string;
    tokenCoverage: number;
    themeDebt: string;
    darkMode: boolean;
    tokens: ThemeToken[];
}

const TOKEN_CATEGORIES = [
    { key: "color", label: "Colors", icon: "palette" },
    { key: "typography", label: "Typography", icon: "text_fields" },
    { key: "spacing", label: "Spacing", icon: "space_bar" },
    { key: "radius", label: "Border Radius", icon: "rounded_corner" },
    { key: "shadow", label: "Shadows", icon: "blur_on" }
] as const;

/* ─── Seed data from project globals.css ─── */

function loadThemesFromStorage(): ThemeRecord[] {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem("lmnas-themes");
    if (raw) {
        try { return JSON.parse(raw); } catch { /* fall through */ }
    }
    // Seed with the project's current theme
    const defaultTheme: ThemeRecord = {
        id: "theme-default",
        name: "LMNAs Dark v1",
        status: "active",
        sourceRef: "globals.css",
        createdAt: "2026-02-15",
        updatedAt: "2026-03-09",
        tokenCoverage: 0.92,
        themeDebt: "3 arbitrary color values detected outside token system",
        darkMode: true,
        tokens: [
            { key: "bg", label: "Background", category: "color", value: "#0b1120", cssVariable: "--color-lmnas-bg", mapped: true },
            { key: "bg-elevated", label: "Elevated Background", category: "color", value: "#111827", cssVariable: "--color-lmnas-bg-elevated", mapped: true },
            { key: "panel", label: "Panel", category: "color", value: "#151f32", cssVariable: "--color-lmnas-panel", mapped: true },
            { key: "border", label: "Border", category: "color", value: "#1e2d4a", cssVariable: "--color-lmnas-border", mapped: true },
            { key: "text", label: "Primary Text", category: "color", value: "#f1f5f9", cssVariable: "--color-lmnas-text", mapped: true },
            { key: "text-secondary", label: "Secondary Text", category: "color", value: "#94a3b8", cssVariable: "--color-lmnas-text-secondary", mapped: true },
            { key: "muted", label: "Muted Text", category: "color", value: "#64748b", cssVariable: "--color-lmnas-muted", mapped: true },
            { key: "accent", label: "Accent / Primary", category: "color", value: "#3b82f6", cssVariable: "--color-lmnas-accent", mapped: true },
            { key: "accent-bright", label: "Accent Bright", category: "color", value: "#60a5fa", cssVariable: "--color-lmnas-accent-bright", mapped: true },
            { key: "success", label: "Success", category: "color", value: "#22c55e", cssVariable: "--color-lmnas-success", mapped: true },
            { key: "warning", label: "Warning", category: "color", value: "#f59e0b", cssVariable: "--color-lmnas-warning", mapped: true },
            { key: "danger", label: "Danger", category: "color", value: "#ef4444", cssVariable: "--color-lmnas-danger", mapped: true },
            { key: "font-display", label: "Primary Text Font", category: "typography", value: "Manrope, sans-serif", cssVariable: "--font-display", mapped: true },
            { key: "radius-sm", label: "Small Radius", category: "radius", value: "8px", cssVariable: "rounded-lg", mapped: true },
            { key: "radius-md", label: "Medium Radius", category: "radius", value: "12px", cssVariable: "rounded-xl", mapped: true },
            { key: "radius-lg", label: "Large Radius", category: "radius", value: "16px", cssVariable: "rounded-2xl", mapped: true }
        ]
    };
    const themes = [defaultTheme];
    localStorage.setItem("lmnas-themes", JSON.stringify(themes));
    return themes;
}

function saveThemes(themes: ThemeRecord[]) {
    if (typeof window !== "undefined") {
        localStorage.setItem("lmnas-themes", JSON.stringify(themes));
    }
}

/* ─── Component ─── */

export default function ThemeWorkflowPage() {
    const [themes, setThemes] = useState<ThemeRecord[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [mode, setMode] = useState<"library" | "create">("library");
    const [referenceHtml, setReferenceHtml] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [confirmActivateId, setConfirmActivateId] = useState<string | null>(null);

    useEffect(() => {
        setThemes(loadThemesFromStorage());
    }, []);

    const activeTheme = themes.find((t) => t.status === "active");
    const selectedTheme = themes.find((t) => t.id === selectedId) ?? null;

    function activateTheme(id: string) {
        const updated = themes.map((t) => ({
            ...t,
            status: (t.id === id ? "active" : t.status === "active" ? "inactive" : t.status) as ThemeRecord["status"]
        }));
        setThemes(updated);
        saveThemes(updated);
        setConfirmActivateId(null);
    }

    function deactivateTheme(id: string) {
        const updated = themes.map((t) => t.id === id ? { ...t, status: "inactive" as const } : t);
        setThemes(updated);
        saveThemes(updated);
    }

    async function deriveTheme() {
        setIsAnalyzing(true);
        try {
            const res = await fetch("/api/platform/onboarding/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sourceType: "raw_html", sourceValue: referenceHtml, slug: "theme-derive", locale: "en", themeKey: "default" })
            });
            const data = await res.json();
            if (data.theme) {
                const tokens: ThemeToken[] = [];
                (data.theme.extractedColors ?? []).forEach((c: string, i: number) => {
                    tokens.push({ key: `c${i}`, label: i === 0 ? "Primary" : i === 1 ? "Secondary" : i === 2 ? "Accent" : `Color ${i + 1}`, category: "color", value: c, cssVariable: `--color-derived-${i}`, mapped: false });
                });
                (data.theme.extractedFonts ?? []).forEach((f: string, i: number) => {
                    tokens.push({ key: `f${i}`, label: i === 0 ? "Primary Text Font" : `Font ${i + 1}`, category: "typography", value: f, cssVariable: `--font-derived-${i}`, mapped: false });
                });
                const newTheme: ThemeRecord = {
                    id: `theme-${Date.now()}`,
                    name: `Derived Theme ${themes.length + 1}`,
                    status: "draft",
                    sourceRef: "User HTML input",
                    createdAt: new Date().toISOString().slice(0, 10),
                    updatedAt: new Date().toISOString().slice(0, 10),
                    tokenCoverage: data.theme.tokenFirstMatchRatio ?? 0,
                    themeDebt: data.theme.themeDebtSummary ?? "Unknown",
                    darkMode: data.theme.hasDarkModeTrigger ?? false,
                    tokens
                };
                const updated = [...themes, newTheme];
                setThemes(updated);
                saveThemes(updated);
                setSelectedId(newTheme.id);
                setMode("library");
                setReferenceHtml("");
            }
        } catch { /* analysis error */ }
        setIsAnalyzing(false);
    }

    const statusColor = (s: string) =>
        s === "active" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" :
            s === "draft" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" :
                "bg-slate-500/10 text-slate-400 border-slate-500/20";

    const input = "w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40";

    return (
        <div className="max-w-[1400px] mx-auto flex flex-col gap-5">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-2xl text-blue-400">palette</span>
                        Theme
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">Manage project themes. The active theme governs all production previews.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setMode("library")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${mode === "library" ? "bg-white/[0.08] text-slate-200" : "text-slate-500 hover:text-slate-300"}`}>
                        Library
                    </button>
                    <button type="button" onClick={() => setMode("create")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${mode === "create" ? "bg-white/[0.08] text-slate-200" : "text-slate-500 hover:text-slate-300"}`}>
                        + Derive New
                    </button>
                </div>
            </header>

            {/* Activate confirmation dialog */}
            {confirmActivateId && (
                <div className="rounded-xl bg-amber-500/[0.08] border border-amber-500/20 p-4 flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-400 text-lg mt-0.5">warning</span>
                    <div className="flex-1">
                        <p className="text-sm text-amber-300 font-medium">Changing the active theme may cause visual regression on already-published blocks and pages.</p>
                        <p className="text-xs text-amber-400/70 mt-1">All production previews and future imports will use the new theme. Existing content will not be automatically re-rendered.</p>
                        <div className="flex gap-2 mt-3">
                            <button type="button" onClick={() => activateTheme(confirmActivateId)} className="px-4 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold hover:bg-amber-500/30 cursor-pointer">Confirm Activation</button>
                            <button type="button" onClick={() => setConfirmActivateId(null)} className="px-4 py-1.5 rounded-lg bg-white/[0.04] text-slate-400 text-xs font-semibold hover:bg-white/[0.08] cursor-pointer">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create / Derive Mode */}
            {mode === "create" && (
                <section className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5">
                    <h2 className="text-sm font-bold text-slate-200 mb-1">Derive Theme from Reference</h2>
                    <p className="text-xs text-slate-500 mb-4">Paste reference HTML to extract theme candidates. The derived theme will appear as a draft.</p>
                    <textarea className={`${input} min-h-[180px] font-mono text-xs`} value={referenceHtml} onChange={(e) => setReferenceHtml(e.target.value)} placeholder="Paste reference HTML..." />
                    <button type="button" onClick={deriveTheme} disabled={!referenceHtml.trim() || isAnalyzing} className="mt-3 px-5 py-2 rounded-lg bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                        {isAnalyzing ? "Analyzing…" : "Derive Theme"}
                    </button>
                </section>
            )}

            {/* Library Mode */}
            {mode === "library" && (
                <div className="grid gap-5" style={{ gridTemplateColumns: selectedTheme ? "340px 1fr" : "1fr" }}>
                    {/* Theme List */}
                    <div className="flex flex-col gap-2">
                        {themes.length === 0 && (
                            <div className="rounded-xl bg-white/[0.02] border border-dashed border-white/[0.08] p-8 text-center">
                                <span className="material-symbols-outlined text-3xl text-slate-600 mb-2">palette</span>
                                <p className="text-sm text-slate-500">No themes yet. Use "Derive New" to create one.</p>
                            </div>
                        )}
                        {themes.map((theme) => (
                            <button
                                key={theme.id}
                                type="button"
                                onClick={() => setSelectedId(theme.id)}
                                className={`w-full text-left rounded-xl p-3.5 transition-all cursor-pointer ${selectedId === theme.id
                                        ? "bg-blue-500/[0.08] border border-blue-500/20"
                                        : "bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1]"
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <h3 className="text-sm font-semibold text-slate-200 truncate">{theme.name}</h3>
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusColor(theme.status)}`}>
                                        {theme.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                    <span>{Math.round(theme.tokenCoverage * 100)}% coverage</span>
                                    <span>·</span>
                                    <span>{theme.tokens.length} tokens</span>
                                    <span>·</span>
                                    <span>{theme.darkMode ? "Dark" : "Light"}</span>
                                </div>
                                <div className="flex gap-1 mt-2">
                                    {theme.tokens.filter((t) => t.category === "color").slice(0, 6).map((t) => (
                                        <div key={t.key} className="w-5 h-5 rounded-md border border-white/[0.08]" style={{ background: t.value }} title={t.label} />
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Detail Panel */}
                    {selectedTheme ? (
                        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                            <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
                                <div>
                                    <h2 className="text-base font-bold text-slate-100">{selectedTheme.name}</h2>
                                    <p className="text-[11px] text-slate-500 mt-0.5">Source: {selectedTheme.sourceRef} · Updated {selectedTheme.updatedAt}</p>
                                </div>
                                <div className="flex gap-2">
                                    {selectedTheme.status !== "active" && (
                                        <button type="button" onClick={() => setConfirmActivateId(selectedTheme.id)} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 cursor-pointer">
                                            Set as Active
                                        </button>
                                    )}
                                    {selectedTheme.status === "active" && (
                                        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                            Active Theme
                                        </span>
                                    )}
                                </div>
                            </header>

                            <div className="p-5 flex flex-col gap-5 max-h-[calc(100vh-240px)] overflow-y-auto">
                                {/* Overview */}
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { label: "Coverage", value: `${Math.round(selectedTheme.tokenCoverage * 100)}%`, sub: "token mapping" },
                                        { label: "Tokens", value: String(selectedTheme.tokens.length), sub: "defined" },
                                        { label: "Mapped", value: String(selectedTheme.tokens.filter((t) => t.mapped).length), sub: "of total" },
                                        { label: "Mode", value: selectedTheme.darkMode ? "Dark" : "Light", sub: "color scheme" }
                                    ].map((m) => (
                                        <div key={m.label} className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                                            <p className="text-lg font-bold text-slate-200">{m.value}</p>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{m.label}</p>
                                            <p className="text-[10px] text-slate-600">{m.sub}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Theme Debt */}
                                {selectedTheme.themeDebt && (
                                    <div className="rounded-lg bg-amber-500/[0.06] border border-amber-500/15 p-3">
                                        <p className="text-xs text-amber-400/80"><strong className="text-amber-400">Theme debt:</strong> {selectedTheme.themeDebt}</p>
                                    </div>
                                )}

                                {/* Token Categories */}
                                {TOKEN_CATEGORIES.map((cat) => {
                                    const tokens = selectedTheme.tokens.filter((t) => t.category === cat.key);
                                    if (tokens.length === 0) return null;
                                    return (
                                        <div key={cat.key}>
                                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-sm text-blue-400">{cat.icon}</span>
                                                {cat.label}
                                            </h3>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                                {tokens.map((token) => (
                                                    <div key={token.key} className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.05] p-2.5">
                                                        {token.category === "color" && (
                                                            <div className="w-8 h-8 rounded-lg border border-white/[0.08] flex-shrink-0" style={{ background: token.value }} />
                                                        )}
                                                        {token.category !== "color" && (
                                                            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                                                                <span className="text-[10px] text-slate-500 font-mono">Aa</span>
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium text-slate-300 truncate">{token.label}</p>
                                                            <p className="text-[10px] text-slate-600 font-mono truncate">{token.cssVariable}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-mono text-slate-400 bg-white/[0.03] px-2 py-0.5 rounded">{token.value}</span>
                                                            {token.mapped ? (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Mapped" />
                                                            ) : (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unmapped" />
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl bg-white/[0.01] border border-dashed border-white/[0.06] flex flex-col items-center justify-center min-h-[400px]">
                            <span className="material-symbols-outlined text-4xl text-slate-700 mb-2">palette</span>
                            <p className="text-sm text-slate-500">Select a theme to inspect</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
