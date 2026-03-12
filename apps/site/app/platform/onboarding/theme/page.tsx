"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StudioShell, StudioTheme, StudioThemeToken } from "../_lib/studio-types";
import { requestClientJson } from "../_lib/client-request";
import { setPreviewSwatchThemeId } from "../_lib/preview-swatch-state";
import { StudioActionMenu, StudioDetailContainer, StudioListContainer } from "../_components/workflow";
import {
  ALLOWED_THEME_SOURCES,
  isStudioThemeSourceType,
  normalizeThemeKey,
  type StudioThemeSourceType
} from "./theme-input";

type ThemeWorkflowMode = "browse" | "derive";

type ThemeSaveMode = "create" | "upsert";

type ThemeSaveResponse =
  | {
      ok: true;
      data: StudioTheme[];
      source: "fallback" | "strapi";
    }
  | {
      ok: false;
      error: string;
      code?: string;
      duplicateThemeId?: string;
    };

const SOURCE_LABELS: Record<StudioThemeSourceType, string> = {
  url: "Website URL",
  html_upload: "HTML Upload",
  figma_export: "Figma Export Code",
  stitch_export: "Stitch Export Code",
  zip_upload: "ZIP Upload",
  local_repo_path: "Local Repo/Test Path"
};

function nowDateIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function extractHexColors(source: string): string[] {
  const matches = source.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
  const unique = Array.from(new Set(matches.map((value) => value.toLowerCase())));
  return unique.slice(0, 5);
}

function extractFontName(source: string): string | null {
  const fontFamilyMatch = source.match(/font-family\s*:\s*([^;\n]+)/i);
  if (!fontFamilyMatch) {
    return null;
  }

  return fontFamilyMatch[1].replace(/["']/g, "").split(",")[0]?.trim() ?? null;
}

function buildDerivedTokens(sourceType: StudioThemeSourceType, sourceValue: string): StudioThemeToken[] {
  const colors = extractHexColors(sourceValue);
  const fallbackColors = ["#0b1120", "#f1f5f9", "#3b82f6", "#111827", "#94a3b8"];
  const palette = colors.length > 0 ? colors : fallbackColors;
  const font = extractFontName(sourceValue) ?? "Manrope";

  return [
    {
      key: "surface-bg",
      label: "Surface Background",
      category: "color",
      value: palette[0] ?? fallbackColors[0],
      cssVariable: "--theme-surface-bg",
      mapped: true
    },
    {
      key: "surface-text",
      label: "Surface Text",
      category: "color",
      value: palette[1] ?? fallbackColors[1],
      cssVariable: "--theme-surface-text",
      mapped: true
    },
    {
      key: "surface-accent",
      label: "Surface Accent",
      category: "color",
      value: palette[2] ?? fallbackColors[2],
      cssVariable: "--theme-surface-accent",
      mapped: true
    },
    {
      key: "surface-muted",
      label: "Surface Muted",
      category: "color",
      value: palette[4] ?? fallbackColors[4],
      cssVariable: "--theme-surface-muted",
      mapped: true
    },
    {
      key: "font-display",
      label: "Display Font",
      category: "typography",
      value: font,
      cssVariable: "--theme-font-display",
      mapped: true
    },
    {
      key: "radius-md",
      label: "Radius",
      category: "radius",
      value: sourceType === "zip_upload" ? "14px" : "12px",
      cssVariable: "--theme-radius-md",
      mapped: true
    }
  ];
}

function buildPreviewCssVariables(tokens: StudioThemeToken[]): React.CSSProperties {
  const style: Record<string, string> = {
    "--theme-surface-bg": "#0b1120",
    "--theme-surface-text": "#f1f5f9",
    "--theme-surface-accent": "#3b82f6",
    "--theme-surface-muted": "#94a3b8",
    "--theme-font-display": "Manrope",
    "--theme-radius-md": "12px"
  };

  for (const token of tokens) {
    if (token.cssVariable.startsWith("--")) {
      style[token.cssVariable] = token.value;
    }
  }

  return style as React.CSSProperties;
}

function resolveSourcePlaceholder(sourceType: StudioThemeSourceType): string {
  if (sourceType === "url") {
    return "https://example.com";
  }
  if (sourceType === "local_repo_path") {
    return "docs/testing-artifacts/code.html";
  }
  if (sourceType === "zip_upload") {
    return "Upload a .zip file containing exported theme assets.";
  }
  if (sourceType === "figma_export") {
    return "Paste exported Figma HTML/CSS snippet...";
  }
  if (sourceType === "stitch_export") {
    return "Paste exported Stitch code snippet...";
  }
  return "Paste HTML source...";
}

export default function ThemeWorkflowPage(): React.ReactElement {
  const [themes, setThemes] = useState<StudioTheme[]>([]);
  const [shells, setShells] = useState<StudioShell[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<ThemeWorkflowMode>("browse");
  const [sourceType, setSourceType] = useState<StudioThemeSourceType>("html_upload");
  const [sourceValue, setSourceValue] = useState("");
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [themeName, setThemeName] = useState("Derived Theme");
  const [themeKeyInput, setThemeKeyInput] = useState("derived-theme");
  const [candidateTheme, setCandidateTheme] = useState<StudioTheme | null>(null);
  const [swatchThemeId, setSwatchThemeId] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ message: string; duplicateThemeId?: string } | null>(null);
  const [isLoadingThemes, setIsLoadingThemes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadThemes(): Promise<void> {
    setIsLoadingThemes(true);
    setError(null);
    try {
      const payload = await requestClientJson<{ ok: boolean; data?: StudioTheme[]; error?: string }>(
        "/api/platform/studio/themes",
        {
          method: "GET",
          headers: { "content-type": "application/json" }
        },
        {
          timeoutMessage: "Loading themes timed out. Please retry.",
          fallbackErrorMessage: "Unable to load themes."
        }
      );

      if (!payload.ok || !Array.isArray(payload.data)) {
        throw new Error(payload.error ?? "Unable to load themes.");
      }

      setThemes(payload.data);
      if (!selectedId && payload.data.length > 0) {
        setSelectedId(payload.data[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoadingThemes(false);
    }
  }

  async function loadShells(): Promise<void> {
    try {
      const payload = await requestClientJson<{ ok: boolean; data?: StudioShell[]; error?: string }>(
        "/api/platform/studio/shells",
        {
          method: "GET",
          headers: { "content-type": "application/json" }
        },
        {
          timeoutMessage: "Loading shell presets timed out. Please retry.",
          fallbackErrorMessage: "Unable to load shell presets."
        }
      );
      if (!payload.ok || !Array.isArray(payload.data)) {
        throw new Error(payload.error ?? "Unable to load shell presets.");
      }
      setShells(payload.data);
    } catch {
      setShells([]);
    }
  }

  async function activateTheme(themeId: string, themeKey: string): Promise<void> {
    setIsActivating(true);
    setError(null);
    try {
      const payload = await requestClientJson<{ ok: boolean; data?: StudioTheme[]; error?: string }>(
        "/api/platform/studio/themes/activate",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: themeId, themeKey })
        },
        {
          timeoutMessage: "Activating theme timed out. Please retry.",
          fallbackErrorMessage: "Unable to activate theme."
        }
      );

      if (!payload.ok || !Array.isArray(payload.data)) {
        throw new Error(payload.error ?? "Unable to activate theme.");
      }

      setThemes(payload.data);
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : String(activationError));
    } finally {
      setIsActivating(false);
    }
  }

  async function saveTheme(theme: StudioTheme, options: { saveMode: ThemeSaveMode; source: StudioThemeSourceType }): Promise<ThemeSaveResponse> {
    const response = await fetch("/api/platform/studio/themes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: options.saveMode,
        sourceType: options.source,
        theme
      })
    });

    const payload = (await response.json()) as ThemeSaveResponse;
    return payload;
  }

  useEffect(() => {
    void loadThemes();
    void loadShells();
  }, []);

  useEffect(() => {
    setPreviewSwatchThemeId(swatchThemeId);
  }, [swatchThemeId]);

  const selectedTheme = themes.find((theme) => theme.id === selectedId) ?? null;
  const activeTheme = themes.find((theme) => theme.status === "active") ?? null;
  const activeShell = shells.find((shell) => shell.status === "active") ?? null;
  const swatchTheme = themes.find((theme) => theme.id === swatchThemeId) ?? null;

  const previewTheme = useMemo(() => {
    if (swatchTheme) {
      return swatchTheme;
    }
    if (selectedTheme) {
      return selectedTheme;
    }
    return activeTheme;
  }, [activeTheme, selectedTheme, swatchTheme]);

  const previewStyle = useMemo(() => buildPreviewCssVariables(previewTheme?.tokens ?? []), [previewTheme]);

  function resetDeriveState(): void {
    setSourceType("html_upload");
    setSourceValue("");
    setSourceFileName(null);
    setThemeName("Derived Theme");
    setThemeKeyInput("derived-theme");
    setCandidateTheme(null);
    setDuplicateWarning(null);
    setError(null);
  }

  function startDerivePreview(): void {
    setError(null);
    setDuplicateWarning(null);

    if (!isStudioThemeSourceType(sourceType)) {
      setError(`Unsupported source type. Allowed: ${ALLOWED_THEME_SOURCES.join(", ")}.`);
      return;
    }

    if (sourceType !== "zip_upload" && sourceValue.trim().length === 0) {
      setError("A source value is required for this theme source type.");
      return;
    }

    if (sourceType === "zip_upload" && !sourceFileName) {
      setError("Upload a ZIP file to continue.");
      return;
    }

    const normalizedThemeKey = normalizeThemeKey(themeKeyInput);
    const now = nowDateIso();
    const sourceRef = sourceType === "zip_upload" ? sourceFileName ?? "zip_upload" : sourceValue.trim();
    const tokens = buildDerivedTokens(sourceType, sourceRef);
    const coverage = Math.min(0.98, 0.62 + tokens.filter((token) => token.mapped).length * 0.05);

    setCandidateTheme({
      id: `theme-candidate-${Date.now()}`,
      themeKey: normalizedThemeKey,
      name: themeName.trim().length > 0 ? themeName.trim() : "Derived Theme",
      status: "draft",
      sourceRef,
      createdAt: now,
      updatedAt: now,
      tokenCoverage: coverage,
      themeDebt: "Preview candidate only. Save to persist.",
      darkMode: true,
      tokens
    });
  }

  async function persistCandidateTheme(): Promise<void> {
    if (!candidateTheme) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setDuplicateWarning(null);
    try {
      const payload = await saveTheme(candidateTheme, {
        saveMode: "create",
        source: sourceType
      });

      if (!payload.ok) {
        if (payload.code === "theme.duplicate") {
          setDuplicateWarning({
            message: payload.error,
            duplicateThemeId: payload.duplicateThemeId
          });
          if (payload.duplicateThemeId) {
            setSelectedId(payload.duplicateThemeId);
            setMode("browse");
          }
          return;
        }
        throw new Error(payload.error);
      }

      setThemes(payload.data);
      const saved = payload.data.find((theme) => theme.themeKey === candidateTheme.themeKey) ?? payload.data[0];
      setSelectedId(saved?.id ?? null);
      setMode("browse");
      resetDeriveState();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSelectedPatch(patch: Partial<StudioTheme>): Promise<void> {
    if (!selectedTheme) {
      return;
    }

    const nextTheme: StudioTheme = {
      ...selectedTheme,
      ...patch,
      updatedAt: nowDateIso()
    };

    setIsSaving(true);
    setError(null);
    try {
      const payload = await saveTheme(nextTheme, {
        saveMode: "upsert",
        source: "html_upload"
      });
      if (!payload.ok) {
        throw new Error(payload.error);
      }
      setThemes(payload.data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  const browseActions = selectedTheme
    ? [
        {
          id: "activate-theme",
          label: selectedTheme.status === "active" ? "Already Active" : "Set As Active",
          description:
            selectedTheme.status === "active"
              ? "This theme is currently the production active record."
              : "Promote this theme to active production state.",
          tone: "accent" as const,
          disabled: selectedTheme.status === "active" || isSaving || isActivating,
          onSelect: () => {
            void activateTheme(selectedTheme.id, selectedTheme.themeKey);
          }
        },
        {
          id: "apply-swatch",
          label: swatchThemeId === selectedTheme.id ? "Clear Preview Swatch" : "Apply Preview Swatch",
          description:
            swatchThemeId === selectedTheme.id
              ? "Clear temporary preview and view the active production theme."
              : "Apply visual swatch preview only (no DB persistence).",
          tone: "neutral" as const,
          disabled: false,
          onSelect: () => {
            setSwatchThemeId((previous) => (previous === selectedTheme.id ? null : selectedTheme.id));
          }
        },
        {
          id: "archive-theme",
          label: "Archive Theme",
          description: "Move this theme to inactive state.",
          tone: "danger" as const,
          disabled: selectedTheme.status === "inactive" || isSaving,
          onSelect: () => {
            void saveSelectedPatch({ status: "inactive" });
          }
        }
      ]
    : [];

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5" style={previewStyle}>
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Theme &amp; Shell Studio</h1>
          <p className="mt-1 text-xs text-slate-500">
            Govern Theme Presets, Shell Presets, and token mappings used by the Studio import and page composition flow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("browse")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              mode === "browse" ? "bg-blue-500/20 text-blue-200" : "bg-white/[0.04] text-slate-400"
            }`}
          >
            Browse
          </button>
          <button
            type="button"
            data-testid="theme-open-derive"
            onClick={() => {
              setMode("derive");
              setDuplicateWarning(null);
              setError(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              mode === "derive" ? "bg-blue-500/20 text-blue-200" : "bg-white/[0.04] text-slate-400"
            }`}
          >
            Derive / Upload
          </button>
        </div>
      </header>

      {swatchThemeId ? (
        <div data-testid="theme-swatch-banner" className="rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-3 py-2">
          <p className="text-xs text-amber-300">
            Preview Swatch Active: <strong>{swatchTheme?.name ?? "Unknown"}</strong>. Refreshing the browser resets to Active Production Theme.
          </p>
        </div>
      ) : null}

      {duplicateWarning ? (
        <div data-testid="theme-duplicate-warning" className="rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-3 py-3">
          <p className="text-sm font-semibold text-amber-200">Duplicate Theme Upload Blocked</p>
          <p className="mt-1 text-xs text-amber-300">{duplicateWarning.message}</p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3 py-2">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      ) : null}

      {mode === "derive" ? (
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <StudioListContainer
            title="Theme Source"
            description="Allowed inputs only: URL, HTML, Figma export, Stitch export, ZIP, local repo/test path."
            items={ALLOWED_THEME_SOURCES.map((value) => ({ id: value, value }))}
            selectedId={sourceType}
            onSelectItem={(item) => {
              setSourceType(item.value);
              setSourceValue("");
              setSourceFileName(null);
              setCandidateTheme(null);
              setDuplicateWarning(null);
              setError(null);
            }}
            getItemTitle={(item) => SOURCE_LABELS[item.value]}
            getItemSubtitle={(item) => item.value}
            emptyTitle="No source types"
          />

          <div className="flex flex-col gap-5">
            <StudioDetailContainer
              title="Derive Theme Candidate"
              description="Generate a sample preview before saving a draft theme record."
              isEmpty={false}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Theme Name
                  <input
                    data-testid="theme-name-input"
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
                    value={themeName}
                    onChange={(event) => {
                      setThemeName(event.target.value);
                      if (themeKeyInput === "" || themeKeyInput === "derived-theme") {
                        setThemeKeyInput(normalizeThemeKey(event.target.value));
                      }
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Theme Key
                  <input
                    data-testid="theme-key-input"
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
                    value={themeKeyInput}
                    onChange={(event) => setThemeKeyInput(event.target.value)}
                  />
                </label>
              </div>

              {sourceType === "zip_upload" ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-3">
                  <label className="text-xs text-slate-400">ZIP File</label>
                  <input
                    data-testid="theme-zip-input"
                    type="file"
                    accept=".zip"
                    className="mt-2 block w-full text-xs text-slate-300"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setSourceFileName(file?.name ?? null);
                      setSourceValue(file?.name ?? "");
                    }}
                  />
                  <p className="mt-2 text-[11px] text-slate-500">{sourceFileName ?? "No ZIP selected yet."}</p>
                </div>
              ) : sourceType === "url" || sourceType === "local_repo_path" ? (
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  {SOURCE_LABELS[sourceType]}
                  <input
                    data-testid="theme-source-input"
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
                    placeholder={resolveSourcePlaceholder(sourceType)}
                    value={sourceValue}
                    onChange={(event) => setSourceValue(event.target.value)}
                  />
                </label>
              ) : (
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  {SOURCE_LABELS[sourceType]}
                  <textarea
                    data-testid="theme-source-textarea"
                    className="min-h-[180px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-xs text-slate-100"
                    placeholder={resolveSourcePlaceholder(sourceType)}
                    value={sourceValue}
                    onChange={(event) => setSourceValue(event.target.value)}
                  />
                </label>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="theme-generate-preview"
                  onClick={startDerivePreview}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white"
                >
                  Generate Sample Preview
                </button>
                <button
                  type="button"
                  onClick={resetDeriveState}
                  className="rounded-lg bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-400"
                >
                  Reset
                </button>
              </div>
            </StudioDetailContainer>

            <StudioDetailContainer
              title="Sample Preview"
              description="Visual review before persistence (REQ-THM-03)."
              isEmpty={!candidateTheme}
              emptyTitle="No sample generated"
              emptyDescription="Generate a candidate preview to review swatches before saving."
            >
              {candidateTheme ? (
                <div data-testid="theme-sample-preview" className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-3">
                    {candidateTheme.tokens
                      .filter((token) => token.category === "color")
                      .map((token) => (
                        <div key={token.key} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
                          <p className="text-[10px] text-slate-500">{token.label}</p>
                          <div className="mt-1 h-8 rounded border border-white/[0.08]" style={{ background: token.value }} />
                          <p className="mt-1 text-[10px] text-slate-400">{token.value}</p>
                        </div>
                      ))}
                  </div>

                  <div
                    data-testid="theme-preview-card"
                    className="rounded-xl border p-4"
                    style={{
                      ...buildPreviewCssVariables(candidateTheme.tokens),
                      borderColor: "color-mix(in srgb, var(--theme-surface-accent) 50%, transparent)",
                      background: "var(--theme-surface-bg)",
                      color: "var(--theme-surface-text)",
                      borderRadius: "var(--theme-radius-md)",
                      fontFamily: "var(--theme-font-display), sans-serif"
                    }}
                  >
                    <p className="text-sm font-semibold">{candidateTheme.name}</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--theme-surface-muted)" }}>
                      This preview is visual-only. Save to persist the draft.
                    </p>
                    <button
                      type="button"
                      className="mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ background: "var(--theme-surface-accent)", color: "var(--theme-surface-text)" }}
                    >
                      Primary CTA
                    </button>
                  </div>
                </div>
              ) : null}
            </StudioDetailContainer>

            <StudioActionMenu
              title="Candidate Actions"
              description="Duplicate-safe save path with explicit warning response."
              items={
                candidateTheme
                  ? [
                      {
                        id: "save-candidate",
                        label: "Save Theme Draft",
                        description: "Persist the candidate if no duplicate key exists.",
                        tone: "accent",
                        disabled: isSaving,
                        onSelect: () => {
                          void persistCandidateTheme();
                        }
                      },
                      {
                        id: "discard-candidate",
                        label: "Discard Candidate",
                        description: "Clear the current preview candidate.",
                        disabled: false,
                        onSelect: () => setCandidateTheme(null)
                      }
                    ]
                  : []
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <StudioListContainer
            title="Theme Library"
            description={isLoadingThemes ? "Loading themes…" : "Browse active, draft, and archived theme variants."}
            items={themes}
            selectedId={selectedId}
            onSelectItem={(theme) => {
              setSelectedId(theme.id);
              setDuplicateWarning(null);
            }}
            getItemTestId={(theme) => `theme-card-${theme.id}`}
            getItemTitle={(theme) => theme.name}
            getItemSubtitle={(theme) => `${theme.status.toUpperCase()} • ${theme.themeKey}`}
            getItemMeta={(theme) => `${Math.round(theme.tokenCoverage * 100)}% token coverage • ${theme.tokens.length} tokens`}
            emptyTitle="No themes found"
            emptyDescription="Use Derive/Upload mode to create the first theme."
          />

          <div className="flex flex-col gap-5">
            <StudioDetailContainer
              title={selectedTheme ? selectedTheme.name : "Theme Detail"}
              description={selectedTheme ? `Source: ${selectedTheme.sourceRef}` : "Select a theme to inspect."}
              isEmpty={!selectedTheme}
              emptyTitle="No theme selected"
              emptyDescription="Pick a theme from the library to inspect and manage swatches."
              headerSlot={
                selectedTheme ? (
                  <span className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300">
                    {selectedTheme.status}
                  </span>
                ) : null
              }
            >
              {selectedTheme ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-center">
                      <p className="text-sm font-semibold text-slate-100">{Math.round(selectedTheme.tokenCoverage * 100)}%</p>
                      <p className="text-[10px] text-slate-500">Coverage</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-center">
                      <p className="text-sm font-semibold text-slate-100">{selectedTheme.tokens.length}</p>
                      <p className="text-[10px] text-slate-500">Tokens</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-center">
                      <p className="text-sm font-semibold text-slate-100">{selectedTheme.darkMode ? "Dark" : "Light"}</p>
                      <p className="text-[10px] text-slate-500">Mode</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-center">
                      <p className="text-sm font-semibold text-slate-100">{selectedTheme.updatedAt}</p>
                      <p className="text-[10px] text-slate-500">Updated</p>
                    </div>
                  </div>

                  <div data-testid="theme-active-preview" className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-3">
                    <p className="text-xs text-slate-400">
                      Active Production Theme: <strong>{activeTheme?.name ?? "None"}</strong>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Current Visual Preview: <strong>{previewTheme?.name ?? "None"}</strong>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Active Shell Preset: <strong>{activeShell?.name ?? "None"}</strong>
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-300">Shell Presets</p>
                      <Link href="/platform/onboarding/shells" className="text-[11px] font-semibold text-blue-300 hover:text-blue-200">
                        Open Shell Workflow
                      </Link>
                    </div>
                    <div className="space-y-2">
                      {shells.map((shell) => (
                        <div key={shell.id} className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5">
                          <p className="text-xs text-slate-200">{shell.name}</p>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              shell.status === "active" ? "bg-emerald-500/20 text-emerald-200" : "bg-white/[0.06] text-slate-400"
                            }`}
                          >
                            {shell.status}
                          </span>
                        </div>
                      ))}
                      {shells.length === 0 ? <p className="text-xs text-slate-500">No shell presets loaded.</p> : null}
                    </div>
                  </div>

                  <div
                    data-testid="theme-preview-surface"
                    className="rounded-xl border p-4"
                    style={{
                      borderColor: "color-mix(in srgb, var(--theme-surface-accent) 55%, transparent)",
                      background: "var(--theme-surface-bg)",
                      color: "var(--theme-surface-text)",
                      borderRadius: "var(--theme-radius-md)",
                      fontFamily: "var(--theme-font-display), sans-serif"
                    }}
                  >
                    <h3 className="text-sm font-semibold">Theme Surface Preview</h3>
                    <p className="mt-1 text-xs" style={{ color: "var(--theme-surface-muted)" }}>
                      Preview swatches update this panel immediately without mutating active backend state.
                    </p>
                    <button
                      type="button"
                      className="mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ background: "var(--theme-surface-accent)", color: "var(--theme-surface-text)" }}
                    >
                      Sample Button
                    </button>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Color Tokens</p>
                    <div className="grid gap-2 md:grid-cols-3">
                      {selectedTheme.tokens
                        .filter((token) => token.category === "color")
                        .map((token) => (
                          <div key={token.key} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
                            <p className="text-[10px] text-slate-500">{token.label}</p>
                            <div className="mt-1 h-7 rounded border border-white/[0.08]" style={{ background: token.value }} />
                            <p className="mt-1 text-[10px] text-slate-400">{token.value}</p>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Typography Tokens</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {selectedTheme.tokens
                        .filter((token) => token.category === "typography")
                        .map((token) => (
                          <div key={token.key} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
                            <p className="text-[10px] text-slate-500">{token.label}</p>
                            <p className="mt-1 text-xs text-slate-200">{token.value}</p>
                            <p className="mt-1 text-[10px] text-slate-500">{token.cssVariable}</p>
                          </div>
                        ))}
                      {selectedTheme.tokens.filter((token) => token.category === "typography").length === 0 ? (
                        <p className="text-xs text-slate-500">No typography tokens detected.</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Shape Tokens</p>
                    {selectedTheme.tokens
                      .filter((token) => token.category === "radius" || token.category === "shadow" || token.category === "spacing")
                      .map((token) => (
                        <div key={token.key} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
                          <p className="text-[10px] text-slate-500">
                            {token.label} <span className="text-slate-600">({token.category})</span>
                          </p>
                          <p className="mt-1 text-xs text-slate-200">{token.value}</p>
                        </div>
                      ))}
                    {selectedTheme.tokens.filter(
                      (token) => token.category === "radius" || token.category === "shadow" || token.category === "spacing"
                    ).length === 0 ? <p className="text-xs text-slate-500">No shape tokens detected.</p> : null}
                  </div>
                </div>
              ) : null}
            </StudioDetailContainer>

            <StudioActionMenu
              title="Theme Actions"
              description="Activation, preview-only swatch, and archive actions are governed here."
              items={browseActions}
            />
          </div>
        </div>
      )}
    </div>
  );
}
