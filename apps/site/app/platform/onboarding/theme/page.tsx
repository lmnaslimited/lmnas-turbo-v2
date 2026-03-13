"use client";

import React, { useEffect, useMemo, useState } from "react";
import { requestClientJson } from "../_lib/client-request";
import { setPreviewSwatchThemeId } from "../_lib/preview-swatch-state";
import type { StudioShell, StudioTheme, StudioThemeToken } from "../_lib/studio-types";

type ThemeResponse = {
  ok: boolean;
  data?: StudioTheme[];
  source?: "strapi" | "fallback";
  schemaSource?: "canonical" | "legacy" | "fallback";
  error?: string;
};

type ShellResponse = {
  ok: boolean;
  data?: StudioShell[];
  source?: "strapi" | "fallback";
  schemaSource?: "canonical" | "legacy" | "fallback";
  error?: string;
};

type PreviewInheritanceMode = "auto" | "forced-dark" | "forced-light";
type PreviewDevice = "desktop" | "tablet" | "mobile";

function canonicalThemesGuard(payload: ThemeResponse): asserts payload is Required<Pick<ThemeResponse, "ok" | "data" | "source" | "schemaSource">> {
  if (!payload.ok || !Array.isArray(payload.data)) {
    throw new Error(payload.error ?? "Unable to load canonical themes.");
  }
  if (payload.source !== "strapi" || payload.schemaSource !== "canonical") {
    throw new Error("Theme & Shell requires canonical studio-themes from Strapi.");
  }
}

function canonicalShellsGuard(payload: ShellResponse): asserts payload is Required<Pick<ShellResponse, "ok" | "data" | "source" | "schemaSource">> {
  if (!payload.ok || !Array.isArray(payload.data)) {
    throw new Error(payload.error ?? "Unable to load canonical shells.");
  }
  if (payload.source !== "strapi" || payload.schemaSource !== "canonical") {
    throw new Error("Theme & Shell requires canonical studio-shells from Strapi.");
  }
}

function tokenValue(theme: StudioTheme | null, matchers: string[], fallback: string): string {
  if (!theme) {
    return fallback;
  }
  const token = theme.tokens.find((entry) => matchers.some((matcher) => entry.key.toLowerCase().includes(matcher)));
  return token?.value ?? fallback;
}

function buildPreviewCssVariables(theme: StudioTheme | null, inheritanceMode: PreviewInheritanceMode): React.CSSProperties {
  const cssVars: Record<string, string> = {
    "--theme-surface-bg": tokenValue(theme, ["background", "surface-bg", "bg"], "#0b1120"),
    "--theme-surface-text": tokenValue(theme, ["text", "foreground", "surface-text"], "#f1f5f9"),
    "--theme-surface-accent": tokenValue(theme, ["primary", "accent"], "#1162d4"),
    "--theme-surface-muted": tokenValue(theme, ["muted", "secondary"], "#94a3b8"),
    "--theme-font-display": tokenValue(theme, ["font", "display"], "Inter"),
    "--theme-radius-md": tokenValue(theme, ["radius"], "12px"),
    "--theme-panel-bg": "rgba(15, 23, 42, 0.78)",
    "--theme-panel-border": "rgba(148, 163, 184, 0.16)"
  };

  theme?.tokens.forEach((token) => {
    if (token.cssVariable.startsWith("--")) {
      cssVars[token.cssVariable] = token.value;
    }
  });

  if (inheritanceMode === "forced-light") {
    cssVars["--theme-surface-bg"] = "#f8fafc";
    cssVars["--theme-surface-text"] = "#0f172a";
    cssVars["--theme-panel-bg"] = "rgba(255, 255, 255, 0.9)";
    cssVars["--theme-panel-border"] = "rgba(15, 23, 42, 0.08)";
  }

  if (inheritanceMode === "forced-dark") {
    cssVars["--theme-surface-bg"] = theme?.darkMode ? cssVars["--theme-surface-bg"] : "#0b1120";
    cssVars["--theme-surface-text"] = theme?.darkMode ? cssVars["--theme-surface-text"] : "#e2e8f0";
    cssVars["--theme-panel-bg"] = "rgba(15, 23, 42, 0.78)";
    cssVars["--theme-panel-border"] = "rgba(148, 163, 184, 0.16)";
  }

  return cssVars as React.CSSProperties;
}

function themeGradient(theme: StudioTheme | null): string {
  const primary = tokenValue(theme, ["primary", "accent"], "#1162d4");
  const secondary = tokenValue(theme, ["background", "surface-bg", "bg"], "#0f172a");
  const tertiary = tokenValue(theme, ["muted", "secondary"], "#334155");
  return `linear-gradient(135deg, ${secondary} 0%, ${primary} 48%, ${tertiary} 100%)`;
}

function sortThemes(themes: StudioTheme[]): StudioTheme[] {
  return [...themes].sort((left, right) => {
    if (left.status === "active" && right.status !== "active") {
      return -1;
    }
    if (left.status !== "active" && right.status === "active") {
      return 1;
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function sortShells(shells: StudioShell[]): StudioShell[] {
  return [...shells].sort((left, right) => {
    if (left.status === "active" && right.status !== "active") {
      return -1;
    }
    if (left.status !== "active" && right.status === "active") {
      return 1;
    }
    return left.name.localeCompare(right.name);
  });
}

function deriveShellPreviewKind(shell: StudioShell | null): "sidebar" | "topbar" {
  const key = `${shell?.key ?? ""} ${shell?.name ?? ""}`.toLowerCase();
  if (key.includes("sidebar") || key.includes("left nav")) {
    return "sidebar";
  }
  return "topbar";
}

function tokenByCategory(theme: StudioTheme | null, category: StudioThemeToken["category"]): StudioThemeToken[] {
  return (theme?.tokens ?? []).filter((token) => token.category === category);
}

function deviceFrameClass(device: PreviewDevice): string {
  if (device === "tablet") {
    return "mx-auto h-[620px] w-[520px]";
  }
  if (device === "mobile") {
    return "mx-auto h-[620px] w-[320px]";
  }
  return "mx-auto h-[620px] w-[760px] max-w-full";
}

export default function ThemeWorkflowPage(): React.ReactElement {
  const [themes, setThemes] = useState<StudioTheme[]>([]);
  const [shells, setShells] = useState<StudioShell[]>([]);
  const [pendingThemeId, setPendingThemeId] = useState<string | null>(null);
  const [pendingShellId, setPendingShellId] = useState<string | null>(null);
  const [themeDebtReviewOpen, setThemeDebtReviewOpen] = useState(false);
  const [inheritanceMode, setInheritanceMode] = useState<PreviewInheritanceMode>("auto");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadContext(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const [themesPayload, shellsPayload] = await Promise.all([
        requestClientJson<ThemeResponse>(
          "/api/platform/studio/themes",
          { method: "GET", headers: { "content-type": "application/json" } },
          {
            timeoutMessage: "Loading themes timed out. Please retry.",
            fallbackErrorMessage: "Unable to load canonical themes."
          }
        ),
        requestClientJson<ShellResponse>(
          "/api/platform/studio/shells",
          { method: "GET", headers: { "content-type": "application/json" } },
          {
            timeoutMessage: "Loading shells timed out. Please retry.",
            fallbackErrorMessage: "Unable to load canonical shells."
          }
        )
      ]);

      canonicalThemesGuard(themesPayload);
      canonicalShellsGuard(shellsPayload);

      const loadedThemes = sortThemes(themesPayload.data);
      const loadedShells = sortShells(shellsPayload.data);
      const activeTheme = loadedThemes.find((theme) => theme.status === "active") ?? loadedThemes[0] ?? null;
      const activeShell = loadedShells.find((shell) => shell.status === "active") ?? loadedShells[0] ?? null;

      setThemes(loadedThemes);
      setShells(loadedShells);
      setPendingThemeId(activeTheme?.id ?? null);
      setPendingShellId(activeShell?.id ?? null);
      setStatusMessage(null);
    } catch (loadError) {
      setThemes([]);
      setShells([]);
      setPendingThemeId(null);
      setPendingShellId(null);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadContext();
  }, []);

  const activeTheme = useMemo(() => themes.find((theme) => theme.status === "active") ?? null, [themes]);
  const activeShell = useMemo(() => shells.find((shell) => shell.status === "active") ?? null, [shells]);
  const pendingTheme = useMemo(() => themes.find((theme) => theme.id === pendingThemeId) ?? activeTheme, [themes, pendingThemeId, activeTheme]);
  const pendingShell = useMemo(() => shells.find((shell) => shell.id === pendingShellId) ?? activeShell, [shells, pendingShellId, activeShell]);
  const previewStyle = useMemo(() => buildPreviewCssVariables(pendingTheme, inheritanceMode), [pendingTheme, inheritanceMode]);
  const shellPreviewKind = useMemo(() => deriveShellPreviewKind(pendingShell), [pendingShell]);
  const colorTokens = useMemo(() => tokenByCategory(pendingTheme, "color").slice(0, 3), [pendingTheme]);
  const typographyTokens = useMemo(() => tokenByCategory(pendingTheme, "typography").slice(0, 2), [pendingTheme]);
  const shapeTokens = useMemo(
    () => (pendingTheme?.tokens ?? []).filter((token) => token.category === "radius" || token.category === "spacing" || token.category === "shadow").slice(0, 3),
    [pendingTheme]
  );

  const hasPendingChanges = (pendingTheme?.id ?? null) !== (activeTheme?.id ?? null) || (pendingShell?.id ?? null) !== (activeShell?.id ?? null);

  useEffect(() => {
    if (!pendingTheme || !activeTheme || pendingTheme.id === activeTheme.id) {
      setPreviewSwatchThemeId(null);
      return;
    }
    setPreviewSwatchThemeId(pendingTheme.id);
  }, [activeTheme, pendingTheme]);

  async function applyChanges(): Promise<void> {
    if (!pendingTheme && !pendingShell) {
      return;
    }

    setIsApplying(true);
    setError(null);
    setStatusMessage(null);

    try {
      if (pendingTheme && activeTheme && pendingTheme.id !== activeTheme.id) {
        const themePayload = await requestClientJson<ThemeResponse>(
          "/api/platform/studio/themes/activate",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: pendingTheme.id, themeKey: pendingTheme.themeKey })
          },
          {
            timeoutMessage: "Activating theme timed out. Please retry.",
            fallbackErrorMessage: "Unable to activate canonical theme."
          }
        );
        canonicalThemesGuard(themePayload);
      }

      if (pendingShell && activeShell && pendingShell.id !== activeShell.id) {
        const shellPayload = await requestClientJson<ShellResponse>(
          "/api/platform/studio/shells/activate",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: pendingShell.id, key: pendingShell.key })
          },
          {
            timeoutMessage: "Activating shell timed out. Please retry.",
            fallbackErrorMessage: "Unable to activate canonical shell."
          }
        );
        canonicalShellsGuard(shellPayload);
      }

      await loadContext();
      setStatusMessage("Applied canonical Theme & Shell changes.");
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : String(applyError));
    } finally {
      setIsApplying(false);
    }
  }

  async function activateTheme(theme: StudioTheme): Promise<void> {
    if (theme.status === "active") {
      setStatusMessage(`${theme.name} is already active.`);
      setError(null);
      return;
    }

    setIsApplying(true);
    setError(null);
    setStatusMessage(null);

    try {
      const themePayload = await requestClientJson<ThemeResponse>(
        "/api/platform/studio/themes/activate",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: theme.id, themeKey: theme.themeKey })
        },
        {
          timeoutMessage: "Activating theme timed out. Please retry.",
          fallbackErrorMessage: "Unable to activate canonical theme."
        }
      );
      canonicalThemesGuard(themePayload);
      await loadContext();
      setPreviewSwatchThemeId(theme.id);
      setStatusMessage(`Activated canonical theme ${theme.name}.`);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : String(applyError));
    } finally {
      setIsApplying(false);
    }
  }

  function discardChanges(): void {
    setPendingThemeId(activeTheme?.id ?? null);
    setPendingShellId(activeShell?.id ?? null);
    setInheritanceMode("auto");
    setStatusMessage("Discarded pending Theme & Shell changes.");
    setError(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1620px] flex-col gap-4">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#071226]/70 px-2 pb-3">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold leading-tight text-white">Theme &amp; Shell Studio</h1>
          <p className="text-xs text-slate-400">Manage the visual identity and global shell of your studio output.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Inheritance</span>
            <select
              value={inheritanceMode}
              onChange={(event) => setInheritanceMode(event.target.value as PreviewInheritanceMode)}
              className="border-none bg-transparent p-0 text-[10px] font-bold text-white focus:outline-none"
            >
              <option value="auto">Auto (System)</option>
              <option value="forced-dark">Forced Dark</option>
              <option value="forced-light">Forced Light</option>
            </select>
          </div>

          <div className="flex items-center rounded-lg bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setInheritanceMode("forced-light")}
              className={`rounded-md p-1.5 ${inheritanceMode === "forced-light" ? "bg-white/[0.08] text-white" : "text-slate-400"}`}
              aria-label="Preview light"
            >
              <span className="material-symbols-outlined block text-sm">light_mode</span>
            </button>
            <button
              type="button"
              onClick={() => setInheritanceMode("forced-dark")}
              className={`rounded-md p-1.5 ${inheritanceMode === "forced-dark" ? "bg-white/[0.08] text-white" : "text-slate-400"}`}
              aria-label="Preview dark"
            >
              <span className="material-symbols-outlined block text-sm">dark_mode</span>
            </button>
            <button
              type="button"
              onClick={() => setInheritanceMode("auto")}
              className={`rounded-md p-1.5 ${inheritanceMode === "auto" ? "bg-white/[0.08] text-white" : "text-slate-400"}`}
              aria-label="Preview system"
            >
              <span className="material-symbols-outlined block text-sm">desktop_windows</span>
            </button>
          </div>

          <button
            type="button"
            data-testid="theme-discard-changes"
            onClick={discardChanges}
            className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
          >
            Discard
          </button>
          <button
            type="button"
            data-testid="theme-apply-changes"
            onClick={() => {
              void applyChanges();
            }}
            disabled={isApplying || isLoading || !hasPendingChanges}
            className="rounded-lg bg-blue-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isApplying ? "Applying..." : "Apply Changes"}
          </button>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300">{error}</div> : null}
      {statusMessage ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-300">{statusMessage}</div>
      ) : null}

      <div className="grid min-h-[calc(100vh-170px)] gap-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071226] xl:grid-cols-[288px_minmax(0,1fr)_320px]">
        <section className="overflow-y-auto border-r border-white/[0.08] bg-[#061127] px-5 py-6">
          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">System Presets</h2>
            <div className="space-y-3">
              {themes.map((theme) => {
                const selected = pendingTheme?.id === theme.id;
                const active = activeTheme?.id === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    data-testid={`theme-card-${theme.id}`}
                    onClick={() => {
                      setPendingThemeId(theme.id);
                      setStatusMessage(null);
                    }}
                    className={`w-full overflow-hidden rounded-xl border text-left transition-all ${
                      selected ? "border-blue-500 bg-blue-500/[0.08] shadow-lg shadow-blue-500/10" : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.18]"
                    }`}
                  >
                    <div className="relative h-16 p-3" style={{ background: themeGradient(theme) }}>
                      <div className="flex gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-white/20" />
                        <div className="h-2 w-2 rounded-full bg-white/20" />
                      </div>
                      {active ? (
                        <span className="absolute right-3 top-3 material-symbols-outlined text-lg text-white">check_circle</span>
                      ) : null}
                    </div>
                    <div className="bg-slate-900/55 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold text-white">{theme.name}</p>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${active ? "bg-blue-500/20 text-blue-200" : "bg-white/[0.06] text-slate-400"}`}>
                          {theme.status}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">
                        {theme.themeDebt || theme.sourceRef}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{theme.themeKey}</span>
                        <button
                          type="button"
                          data-testid={`theme-activate-${theme.id}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void activateTheme(theme);
                          }}
                          disabled={isApplying || active}
                          className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                            active ? "bg-blue-500/20 text-blue-200" : "bg-white/[0.08] text-slate-200 hover:bg-blue-500/20 hover:text-blue-200"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {active ? "Active" : "Activate"}
                        </button>
                      </div>
                    </div>
                  </button>
                );
              })}
              {!isLoading && themes.length === 0 ? <p className="text-xs text-slate-500">No canonical themes loaded.</p> : null}
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">System Presets</h2>
            <div className="space-y-3">
              {shells.map((shell) => {
                const selected = pendingShell?.id === shell.id;
                const active = activeShell?.id === shell.id;
                const previewKind = deriveShellPreviewKind(shell);
                return (
                  <button
                    key={shell.id}
                    type="button"
                    data-testid={`theme-shell-card-${shell.id}`}
                    onClick={() => {
                      setPendingShellId(shell.id);
                      setStatusMessage(null);
                    }}
                    className={`w-full overflow-hidden rounded-xl border text-left transition-all ${
                      selected ? "border-blue-500 bg-blue-500/[0.08] shadow-lg shadow-blue-500/10" : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.18]"
                    }`}
                  >
                    <div className="h-24 bg-gradient-to-br from-slate-800 to-slate-950 p-2">
                      {previewKind === "sidebar" ? (
                        <div className="flex h-full gap-2">
                          <div className="w-4 rounded-sm bg-blue-500/40" />
                          <div className="flex-1 rounded-sm bg-white/8" />
                        </div>
                      ) : (
                        <div className="flex h-full flex-col gap-2">
                          <div className="h-3 rounded-sm bg-white/10" />
                          <div className="flex-1 rounded-sm bg-white/8" />
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-900/55 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[10px] font-bold text-white">{shell.name}</p>
                        {active ? <span className="text-[10px] uppercase text-blue-300">active</span> : null}
                      </div>
                    </div>
                  </button>
                );
              })}
              {!isLoading && shells.length === 0 ? <p className="text-xs text-slate-500">No canonical shell presets loaded.</p> : null}
            </div>
          </div>
        </section>

        <section className="flex min-w-0 flex-col overflow-hidden bg-[#020817] px-8 py-8">
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded bg-white/[0.05] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Live Preview</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                className={`rounded p-1.5 ${previewDevice === "desktop" ? "bg-blue-500/20 text-blue-200" : "text-slate-500"}`}
                aria-label="Desktop preview"
              >
                <span className="material-symbols-outlined text-lg">desktop_windows</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("tablet")}
                className={`rounded p-1.5 ${previewDevice === "tablet" ? "bg-blue-500/20 text-blue-200" : "text-slate-500"}`}
                aria-label="Tablet preview"
              >
                <span className="material-symbols-outlined text-lg">tablet_mac</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                className={`rounded p-1.5 ${previewDevice === "mobile" ? "bg-blue-500/20 text-blue-200" : "text-slate-500"}`}
                aria-label="Mobile preview"
              >
                <span className="material-symbols-outlined text-lg">smartphone</span>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-white/[0.08] bg-black/30 p-4">
            <div
              data-testid="theme-preview-surface"
              className={`${deviceFrameClass(previewDevice)} overflow-hidden rounded-[24px] border border-white/[0.08] shadow-2xl`}
              style={previewStyle}
            >
              <div className="flex h-full flex-col bg-[var(--theme-surface-bg)] text-[var(--theme-surface-text)]">
                <div className="flex h-10 items-center justify-between border-b border-[var(--theme-panel-border)] bg-[var(--theme-panel-bg)] px-4">
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-white/12" />
                    <div className="h-2 w-2 rounded-full bg-white/12" />
                    <div className="h-2 w-2 rounded-full bg-white/12" />
                  </div>
                  <div className="h-4 w-44 rounded-full bg-white/8" />
                  <div className="h-5 w-5 rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--theme-surface-accent) 70%, transparent)" }} />
                </div>

                <div className="flex min-h-0 flex-1">
                  {shellPreviewKind === "sidebar" ? (
                    <div className="flex w-16 shrink-0 flex-col items-center gap-4 border-r border-[var(--theme-panel-border)] bg-[var(--theme-panel-bg)] py-4">
                      <div className="h-8 w-8 rounded-lg bg-[var(--theme-surface-accent)]" />
                      <div className="h-6 w-6 rounded-md bg-white/8" />
                      <div className="h-6 w-6 rounded-md bg-white/8" />
                      <div className="h-6 w-6 rounded-md bg-white/8" />
                    </div>
                  ) : null}

                  <div className="flex-1 space-y-6 p-8" style={{ fontFamily: "var(--theme-font-display), Inter, sans-serif" }}>
                    {shellPreviewKind === "topbar" ? (
                      <div className="flex items-center justify-between rounded-xl border border-[var(--theme-panel-border)] bg-[var(--theme-panel-bg)] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-[var(--theme-surface-accent)]" />
                          <div className="h-4 w-24 rounded-full bg-white/10" />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-3 w-14 rounded-full bg-white/8" />
                          <div className="h-3 w-14 rounded-full bg-white/8" />
                          <div className="h-3 w-14 rounded-full bg-white/8" />
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-start justify-between gap-6">
                      <div className="space-y-2">
                        <div className="h-6 w-40 rounded bg-white/90" />
                        <div className="h-3 w-64 rounded" style={{ backgroundColor: "color-mix(in srgb, var(--theme-surface-muted) 60%, transparent)" }} />
                      </div>
                      <div className="h-8 w-24 rounded-lg bg-[var(--theme-surface-accent)]" />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={`preview-card-${index + 1}`} className="rounded-xl border border-[var(--theme-panel-border)] bg-[var(--theme-panel-bg)] p-4">
                          <div className="h-3 w-12 rounded bg-white/10" />
                          <div className="mt-4 h-8 w-full rounded bg-white/6" />
                        </div>
                      ))}
                    </div>

                    <div className="flex h-40 items-center justify-center rounded-xl border border-[var(--theme-panel-border)] bg-[var(--theme-panel-bg)]">
                      <span className="material-symbols-outlined text-4xl text-[var(--theme-surface-muted)]">analytics</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-y-auto border-l border-white/[0.08] bg-[#071226] px-5 py-6">
          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Color Tokens</h2>
            <div className="space-y-3">
              {colorTokens.map((token) => (
                <div key={token.key} className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg border border-white/10" style={{ backgroundColor: token.value }} />
                    <div>
                      <p className="text-xs font-bold text-white">{token.key}</p>
                      <p className="text-[10px] text-slate-500">{token.label}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500">{token.value}</span>
                </div>
              ))}
              {colorTokens.length === 0 ? <p className="text-xs text-slate-500">No color tokens available.</p> : null}
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Typography Tokens</h2>
            <div className="space-y-3">
              {typographyTokens.map((token) => (
                <div key={token.key} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{token.label}</p>
                    <span className="text-[10px] font-bold text-blue-300">{token.value}</span>
                  </div>
                  <p className="text-lg font-bold text-white">Headline Text</p>
                  <p className="mt-1 text-[10px] text-slate-500">The quick brown fox jumps over the lazy dog.</p>
                </div>
              ))}
              {typographyTokens.length === 0 ? <p className="text-xs text-slate-500">No typography tokens available.</p> : null}
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Shape Tokens</h2>
            <div className="grid grid-cols-2 gap-3">
              {shapeTokens.map((token) => (
                <div key={token.key} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-center">
                  <div className="mx-auto mb-2 h-6 w-6 bg-[var(--theme-surface-accent)]" style={{ borderRadius: token.category === "radius" ? token.value : "6px" }} />
                  <p className="text-[10px] font-bold text-white">{token.label}</p>
                  <p className="text-[10px] text-slate-500">{token.value}</p>
                </div>
              ))}
              {shapeTokens.length === 0 ? <p className="col-span-2 text-xs text-slate-500">No shape tokens available.</p> : null}
            </div>
          </div>

          <div className="mt-8 border-t border-white/[0.08] pt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-rose-400">Theme Debt</p>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.08] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">Hardcoded Styles</p>
                <span className="rounded-full bg-rose-500/20 px-2 py-1 text-[10px] font-bold text-rose-200">
                  {pendingTheme?.themeDebt?.trim() ? "Review" : "0"}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-rose-200/90">
                {pendingTheme?.themeDebt?.trim() || "No theme debt reported for the selected preset."}
              </p>
              {pendingTheme?.themeDebt?.trim() ? (
                <button
                  type="button"
                  data-testid="theme-debt-review-toggle"
                  onClick={() => setThemeDebtReviewOpen((current) => !current)}
                  className="mt-3 rounded-md border border-rose-500/30 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-200"
                >
                  {themeDebtReviewOpen ? "Hide Review" : "Review Debt"}
                </button>
              ) : null}
              {themeDebtReviewOpen && pendingTheme?.themeDebt?.trim() ? (
                <div className="mt-3 rounded-lg border border-rose-500/20 bg-black/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-200">Debt Review Queue</p>
                  <ul className="mt-2 space-y-1 text-[11px] text-rose-100/90">
                    {pendingTheme.themeDebt
                      .split(/\n|,/)
                      .map((entry) => entry.trim())
                      .filter((entry) => entry.length > 0)
                      .map((entry) => (
                        <li key={entry} className="rounded border border-rose-500/10 bg-rose-500/[0.05] px-2 py-1">
                          {entry}
                        </li>
                      ))}
                  </ul>
                  <p className="mt-2 text-[10px] text-rose-200/80">Theme debt review is actionable in the UI in this pass, but debt-resolution persistence is not yet modeled canonically.</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
