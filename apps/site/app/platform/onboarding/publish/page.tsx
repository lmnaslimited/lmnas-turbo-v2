"use client";

import React, { useEffect, useMemo, useState } from "react";
import { StudioActionMenu, StudioDetailContainer, StudioListContainer } from "../_components/workflow";
import { requestClientJson } from "../_lib/client-request";
import { readPreviewSwatchThemeId, subscribePreviewSwatchThemeId } from "../_lib/preview-swatch-state";
import type { StudioFidelitySettings, StudioSettings, StudioTheme } from "../_lib/studio-types";
import { PublishOverlayWorkflow, type PublishOverlayResult } from "./PublishOverlayWorkflow";

type PublishResponse = {
  ok: boolean;
  data?: PublishOverlayResult;
  error?: string;
};

const DEFAULT_SOURCE_HTML = [
  "<style>",
  "@media(dark) {",
  "  body { background: #020617; color: #f8fafc; }",
  "}",
  "body { font-family: 'Comic Sans MS', cursive; }",
  "</style>",
  "<main><h1>Publish Fidelity Probe</h1><p>Inspect fidelity before commit.</p></main>"
].join("\n");

const DEFAULT_VALIDATION_TOKEN = JSON.stringify(
  {
    expectedTypography: ["manrope", "inter"],
    requiresDarkMode: true
  },
  null,
  2
);

type PublishListItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
};

export default function PublishWorkflowPage(): React.ReactElement {
  const [themes, setThemes] = useState<StudioTheme[]>([]);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [sourceHtml, setSourceHtml] = useState(DEFAULT_SOURCE_HTML);
  const [validationTokenInput, setValidationTokenInput] = useState(DEFAULT_VALIDATION_TOKEN);
  const [thresholdDraft, setThresholdDraft] = useState("0.25");
  const [previewSwatchThemeId, setPreviewSwatchThemeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishOverlayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const [themesPayload, settingsPayload] = await Promise.all([
          requestClientJson<{ ok: boolean; data?: StudioTheme[]; error?: string }>(
            "/api/platform/studio/themes",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading themes timed out. Please retry.",
              fallbackErrorMessage: "Unable to load themes."
            }
          ),
          requestClientJson<{ ok: boolean; data?: StudioSettings; error?: string }>(
            "/api/platform/studio/settings",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading studio settings timed out. Please retry.",
              fallbackErrorMessage: "Unable to load studio settings."
            }
          )
        ]);

        if (!mounted) {
          return;
        }

        if (!themesPayload.ok || !Array.isArray(themesPayload.data)) {
          throw new Error(themesPayload.error ?? "Unable to load themes.");
        }
        if (!settingsPayload.ok || !settingsPayload.data) {
          throw new Error(settingsPayload.error ?? "Unable to load studio settings.");
        }

        setThemes(themesPayload.data);
        setSettings(settingsPayload.data);
        setThresholdDraft(String(settingsPayload.data.fidelity.threshold));
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setPreviewSwatchThemeId(readPreviewSwatchThemeId());
    const unsubscribe = subscribePreviewSwatchThemeId((themeId) => {
      setPreviewSwatchThemeId(themeId);
    });
    return unsubscribe;
  }, []);

  const activeTheme = useMemo(
    () => themes.find((theme) => theme.status === "active") ?? themes[0] ?? null,
    [themes]
  );

  const selectedSwatchTheme = useMemo(
    () => themes.find((theme) => theme.id === previewSwatchThemeId) ?? null,
    [themes, previewSwatchThemeId]
  );

  const listItems = useMemo<PublishListItem[]>(
    () => [
      {
        id: "active-theme",
        title: "Active Theme",
        subtitle: activeTheme ? `${activeTheme.name} (${activeTheme.themeKey})` : "No active theme found",
        meta: activeTheme ? `${activeTheme.darkMode ? "dark" : "light"} • ${activeTheme.status}` : "inactive"
      },
      {
        id: "fidelity-mode",
        title: "Fidelity Threshold Mode",
        subtitle: settings?.fidelity.mode ?? "loading",
        meta: settings ? `threshold ${settings.fidelity.threshold.toFixed(2)}` : "n/a"
      },
      {
        id: "swatch-preview",
        title: "Preview Swatch Signal",
        subtitle: selectedSwatchTheme ? `${selectedSwatchTheme.name}` : "No swatch currently previewed",
        meta: selectedSwatchTheme ? "DOM-only preview state" : "Active theme only"
      }
    ],
    [activeTheme, selectedSwatchTheme, settings]
  );

  async function updateFidelitySettings(next: StudioFidelitySettings): Promise<void> {
    setIsSavingSettings(true);
    setError(null);
    try {
      const payload = await requestClientJson<{ ok: boolean; data?: StudioSettings; error?: string }>(
        "/api/platform/studio/settings",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fidelity: next
          })
        },
        {
          timeoutMessage: "Saving studio settings timed out. Please retry.",
          fallbackErrorMessage: "Unable to save studio settings."
        }
      );
      if (!payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to save studio settings.");
      }
      setSettings(payload.data);
      setThresholdDraft(String(payload.data.fidelity.threshold));
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : String(settingsError));
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function runPublish(): Promise<void> {
    if (!settings) {
      return;
    }

    setIsPublishing(true);
    setError(null);
    try {
      let parsedValidationToken: unknown = null;
      if (validationTokenInput.trim().length > 0) {
        parsedValidationToken = JSON.parse(validationTokenInput);
      }

      const payload = await requestClientJson<PublishResponse>(
        "/api/platform/studio/publish",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "apply",
            sourceHtml,
            previewSwatchThemeId,
            validationToken: parsedValidationToken
          })
        },
        {
          timeoutMessage: "Publish verification timed out. Please retry.",
          fallbackErrorMessage: "Unable to complete publish verification."
        }
      );
      if (!payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Publish verification failed.");
      }
      setPublishResult(payload.data);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : String(publishError));
    } finally {
      setIsPublishing(false);
    }
  }

  const actionItems = settings
    ? [
        {
          id: "save-threshold",
          label: "Save Fidelity Threshold",
          description: "Persist global threshold and mode for studio publish.",
          tone: "accent" as const,
          disabled: isSavingSettings,
          onSelect: () => {
            const parsed = Number(thresholdDraft);
            const normalized = Number.isFinite(parsed) ? parsed : settings.fidelity.threshold;
            void updateFidelitySettings({
              mode: settings.fidelity.mode,
              threshold: normalized
            });
          }
        },
        {
          id: "open-publish-overlay",
          label: "Open Publish Overlay",
          description: "Review fidelity checks and run final publish commit.",
          tone: "neutral" as const,
          disabled: isPublishing,
          onSelect: () => {
            setPublishResult(null);
            setOverlayOpen(true);
          }
        }
      ]
    : [];

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-slate-100">Publish Workflow</h1>
        <p className="mt-1 text-xs text-slate-500">
          Final review always serializes the backend active theme and never commits preview-only swatch state.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-2">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
        <StudioListContainer
          testId="publish-settings-list-container"
          title="Publish Review Inputs"
          description={isLoading ? "Loading publish context…" : "Active theme, fidelity mode, and swatch signal status."}
          items={listItems}
          selectedId="active-theme"
          onSelectItem={() => undefined}
          getItemTitle={(item) => item.title}
          getItemSubtitle={(item) => item.subtitle}
          getItemMeta={(item) => item.meta}
          emptyTitle="No publish context"
        />

        <div className="flex flex-col gap-5">
          <StudioDetailContainer
            testId="publish-settings-detail-container"
            title="Publish Guardrail Configuration"
            description="Configure global fidelity mode and review active-theme-only payload behavior."
            isEmpty={!settings}
            emptyTitle="Settings unavailable"
            emptyDescription="Unable to load Studio settings."
          >
            {settings ? (
              <div className="space-y-4">
                <div data-testid="publish-active-theme" className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                  <p className="text-xs text-slate-400">
                    Active Theme: <strong>{activeTheme?.name ?? "None"}</strong> ({activeTheme?.themeKey ?? "n/a"})
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Dark mode: <strong>{activeTheme?.darkMode ? "enabled" : "disabled"}</strong>
                  </p>
                  <p data-testid="publish-ignored-swatch" className="mt-1 text-[11px] text-amber-300">
                    DOM Preview Swatch: <strong>{selectedSwatchTheme?.name ?? "none"}</strong>. Publish payload strips this state.
                  </p>
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                  <p className="text-xs font-semibold text-slate-300">Fidelity Threshold Mode</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      data-testid="publish-mode-allow"
                      type="button"
                      disabled={isSavingSettings}
                      onClick={() => {
                        void updateFidelitySettings({
                          mode: "allow-below-threshold",
                          threshold: settings.fidelity.threshold
                        });
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        settings.fidelity.mode === "allow-below-threshold"
                          ? "bg-emerald-500/20 text-emerald-200"
                          : "bg-white/[0.05] text-slate-400"
                      }`}
                    >
                      allow-below-threshold
                    </button>
                    <button
                      data-testid="publish-mode-disallow"
                      type="button"
                      disabled={isSavingSettings}
                      onClick={() => {
                        void updateFidelitySettings({
                          mode: "disallow-below-threshold",
                          threshold: settings.fidelity.threshold
                        });
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        settings.fidelity.mode === "disallow-below-threshold"
                          ? "bg-red-500/20 text-red-200"
                          : "bg-white/[0.05] text-slate-400"
                      }`}
                    >
                      disallow-below-threshold
                    </button>
                  </div>

                  <label className="mt-3 flex flex-col gap-1 text-[11px] text-slate-400">
                    Threshold (0.00 - 1.00)
                    <input
                      data-testid="publish-threshold-input"
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-100"
                      value={thresholdDraft}
                      onChange={(event) => setThresholdDraft(event.target.value)}
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                  Source HTML
                  <textarea
                    data-testid="publish-source-html"
                    className="min-h-[150px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-xs text-slate-100"
                    value={sourceHtml}
                    onChange={(event) => setSourceHtml(event.target.value)}
                  />
                </label>

                <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                  Figma Validation Token (JSON)
                  <textarea
                    data-testid="publish-validation-token"
                    className="min-h-[110px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-xs text-slate-100"
                    value={validationTokenInput}
                    onChange={(event) => setValidationTokenInput(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
          </StudioDetailContainer>

          <StudioActionMenu
            testId="publish-settings-action-container"
            title="Publish Actions"
            description="Persist fidelity settings, then launch final publish review overlay."
            items={actionItems}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          data-testid="publish-open-overlay"
          type="button"
          onClick={() => {
            setPublishResult(null);
            setOverlayOpen(true);
          }}
          className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white"
        >
          Open Publish Overlay
        </button>
      </div>

      {overlayOpen ? (
        <PublishOverlayWorkflow
          isPublishing={isPublishing}
          publishResult={publishResult}
          onRunPublish={() => {
            void runPublish();
          }}
          onClose={() => setOverlayOpen(false)}
        />
      ) : null}
    </div>
  );
}
