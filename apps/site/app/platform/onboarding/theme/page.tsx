"use client";

import React, { useEffect, useState } from "react";
import { requestClientJson } from "../_lib/client-request";
import type { StudioTheme } from "../_lib/studio-types";

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
    themeKey: string;
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

/* ─── Component ─── */

export default function ThemeWorkflowPage() {
    const [themes, setThemes] = useState<ThemeRecord[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [mode, setMode] = useState<"library" | "create">("library");
    const [referenceHtml, setReferenceHtml] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isLoadingThemes, setIsLoadingThemes] = useState(false);
    const [isSavingTheme, setIsSavingTheme] = useState(false);
    const [isActivatingTheme, setIsActivatingTheme] = useState(false);
    const [confirmActivateId, setConfirmActivateId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function loadThemes() {
        setIsLoadingThemes(true);
        setError(null);
        try {
            const payload = await requestClientJson<{
                ok: boolean;
                data?: StudioTheme[];
                error?: string;
            }>("/api/platform/studio/themes", {
                method: "GET",
                headers: { "content-type": "application/json" }
            }, {
                timeoutMessage: "Loading themes timed out. Please retry.",
                fallbackErrorMessage: "Unable to load themes."
            });
            if (!payload.ok || !payload.data) {
                throw new Error(payload.error ?? "Unable to load themes.");
            }

            setThemes(payload.data as ThemeRecord[]);
            if (!selectedId && payload.data.length > 0) {
                setSelectedId(payload.data[0].id);
            }
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : String(loadError));
        } finally {
            setIsLoadingThemes(false);
        }
    }

    useEffect(() => {
        void loadThemes();
    }, []);

    const selectedTheme = themes.find((t) => t.id === selectedId) ?? null;

    async function activateTheme(id: string, themeKey?: string) {
        setError(null);
        setIsActivatingTheme(true);
        try {
            const payload = await requestClientJson<{
                ok: boolean;
                data?: StudioTheme[];
                error?: string;
            }>("/api/platform/studio/themes/activate", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ id, themeKey })
            }, {
                timeoutMessage: "Activating theme timed out. Please retry.",
                fallbackErrorMessage: "Unable to activate theme."
            });
            if (!payload.ok || !payload.data) {
                throw new Error(payload.error ?? "Unable to activate theme.");
            }
            setThemes(payload.data as ThemeRecord[]);
            setConfirmActivateId(null);
        } catch (activationError) {
            setError(activationError instanceof Error ? activationError.message : String(activationError));
        } finally {
            setIsActivatingTheme(false);
        }
    }

    async function saveTheme(theme: ThemeRecord): Promise<ThemeRecord[]> {
        setIsSavingTheme(true);
        try {
            const payload = await requestClientJson<{
                ok: boolean;
                data?: StudioTheme[];
                error?: string;
            }>("/api/platform/studio/themes", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ theme })
            }, {
                timeoutMessage: "Saving theme timed out. Please retry.",
                fallbackErrorMessage: "Unable to save theme."
            });
            if (!payload.ok || !payload.data) {
                throw new Error(payload.error ?? "Unable to save theme.");
            }
            const nextThemes = payload.data as ThemeRecord[];
            setThemes(nextThemes);
            return nextThemes;
        } finally {
            setIsSavingTheme(false);
        }
    }

    async function deriveTheme() {
        setIsAnalyzing(true);
        setError(null);
        try {
            const data = await requestClientJson<{
                ok: boolean;
                analysis?: {
                    theme: {
                        extractedColors?: Record<string, string>;
                        extractedFonts?: string[];
                        tokenFirstMatchRatio?: number;
                        themeDebtSummary?: string;
                        hasDarkModeTrigger?: boolean;
                    };
                };
                error?: string;
            }>("/api/platform/onboarding/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sourceType: "raw_html", sourceValue: referenceHtml, slug: "theme-derive", locale: "en", themeKey: "default" })
            }, {
                timeoutMessage: "Theme analysis timed out. Please retry.",
                fallbackErrorMessage: "Theme analysis failed."
            });
            if (!data.ok || !data.analysis) {
                throw new Error(data.error ?? "Theme analysis failed.");
            }

            const themeNotes = data.analysis.theme;
            if (themeNotes) {
                const tokens: ThemeToken[] = [];
                Object.values(themeNotes.extractedColors ?? {}).forEach((c: string, i: number) => {
                    tokens.push({ key: `c${i}`, label: i === 0 ? "Primary" : i === 1 ? "Secondary" : i === 2 ? "Accent" : `Color ${i + 1}`, category: "color", value: c, cssVariable: `--color-derived-${i}`, mapped: false });
                });
                (themeNotes.extractedFonts ?? []).forEach((f: string, i: number) => {
                    tokens.push({ key: `f${i}`, label: i === 0 ? "Primary Text Font" : `Font ${i + 1}`, category: "typography", value: f, cssVariable: `--font-derived-${i}`, mapped: false });
                });
                const newTheme: ThemeRecord = {
                    id: `theme-${Date.now()}`,
                    themeKey: `derived-${Date.now()}`,
                    name: `Derived Theme ${themes.length + 1}`,
                    status: "draft",
                    sourceRef: "User HTML input",
                    createdAt: new Date().toISOString().slice(0, 10),
                    updatedAt: new Date().toISOString().slice(0, 10),
                    tokenCoverage: themeNotes.tokenFirstMatchRatio ?? 0,
                    themeDebt: themeNotes.themeDebtSummary ?? "Unknown",
                    darkMode: themeNotes.hasDarkModeTrigger ?? false,
                    tokens
                };
                const nextThemes = await saveTheme(newTheme);
                const storedTheme = nextThemes.find((theme) => theme.themeKey === newTheme.themeKey) ?? nextThemes[0];
                if (storedTheme) {
                    setSelectedId(storedTheme.id);
                }
                setMode("library");
                setReferenceHtml("");
            }
        } catch (deriveError) {
            setError(deriveError instanceof Error ? deriveError.message : String(deriveError));
        } finally {
            setIsAnalyzing(false);
        }
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
                            <button type="button" data-testid="theme-confirm-activate-button" disabled={isActivatingTheme} onClick={() => {
                                const candidate = themes.find((theme) => theme.id === confirmActivateId);
                                void activateTheme(confirmActivateId, candidate?.themeKey);
                            }} className="px-4 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{isActivatingTheme ? "Activating…" : "Confirm Activation"}</button>
                            <button type="button" onClick={() => setConfirmActivateId(null)} className="px-4 py-1.5 rounded-lg bg-white/[0.04] text-slate-400 text-xs font-semibold hover:bg-white/[0.08] cursor-pointer">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="rounded-xl bg-red-500/[0.08] border border-red-500/20 px-4 py-3">
                    <p className="text-xs text-red-300">{error}</p>
                </div>
            )}

            {/* Create / Derive Mode */}
            {mode === "create" && (
                <section className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5">
                    <h2 className="text-sm font-bold text-slate-200 mb-1">Derive Theme from Reference</h2>
                    <p className="text-xs text-slate-500 mb-4">Paste reference HTML to extract theme candidates. The derived theme will appear as a draft.</p>
                    <textarea className={`${input} min-h-[180px] font-mono text-xs`} value={referenceHtml} onChange={(e) => setReferenceHtml(e.target.value)} placeholder="Paste reference HTML..." />
                    <button type="button" onClick={deriveTheme} disabled={!referenceHtml.trim() || isAnalyzing || isSavingTheme} className="mt-3 px-5 py-2 rounded-lg bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                        {isAnalyzing ? "Analyzing…" : "Derive Theme"}
                    </button>
                </section>
            )}

            {/* Library Mode */}
            {mode === "library" && (
                <div className="grid gap-5" style={{ gridTemplateColumns: selectedTheme ? "340px 1fr" : "1fr" }}>
                    {/* Theme List */}
                    <div className="flex flex-col gap-2">
                        {isLoadingThemes && (
                            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                                <p className="text-xs text-slate-500">Loading themes…</p>
                            </div>
                        )}
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
                                data-testid={`theme-card-${theme.id}`}
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
                                        <button type="button" data-testid="theme-set-active-button" disabled={isActivatingTheme || isSavingTheme} onClick={() => setConfirmActivateId(selectedTheme.id)} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                                            Set as Active
                                        </button>
                                    )}
                                    {selectedTheme.status === "active" && (
                                        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                            Active Theme
                                        </span>
                                    )}
                                    {selectedTheme.status !== "inactive" && (
                                        <button
                                            type="button"
                                            disabled={isSavingTheme || isActivatingTheme}
                                            onClick={() =>
                                                void saveTheme({
                                                    ...selectedTheme,
                                                    status: "inactive"
                                                }).catch((saveError) => {
                                                    setError(saveError instanceof Error ? saveError.message : String(saveError));
                                                })
                                            }
                                            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-400 text-xs font-semibold hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            Set Inactive
                                        </button>
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
