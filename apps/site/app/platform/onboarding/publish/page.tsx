"use client";

import React, { useEffect, useMemo, useState } from "react";
import { requestClientJson } from "../_lib/client-request";
import {
  buildPlatformTargetDocument,
  ensureHtmlDocument,
  extractBodyHtml,
  sanitizeTargetHtml,
  usePlatformPreviewAssets
} from "../_lib/platform-preview";
import { readPreviewSwatchThemeId, subscribePreviewSwatchThemeId } from "../_lib/preview-swatch-state";
import type {
  StudioBlockTemplate,
  StudioFidelitySettings,
  StudioPageDocument,
  StudioSettings,
  StudioShell,
  StudioTheme
} from "../_lib/studio-types";
import type { PublishOverlayResult } from "./PublishOverlayWorkflow";

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

type ChangeCard = {
  id: string;
  title: string;
  subtitle: string;
  tone: "emerald" | "blue" | "violet" | "rose";
  status: string;
};

function changeToneClasses(tone: ChangeCard["tone"]): { badge: string; icon: string } {
  if (tone === "emerald") {
    return { badge: "bg-emerald-500/10 text-emerald-300", icon: "bg-emerald-500/10 text-emerald-400" };
  }
  if (tone === "violet") {
    return { badge: "bg-violet-500/10 text-violet-300", icon: "bg-violet-500/10 text-violet-400" };
  }
  if (tone === "rose") {
    return { badge: "bg-rose-500/10 text-rose-300", icon: "bg-rose-500/10 text-rose-400" };
  }
  return { badge: "bg-blue-500/10 text-blue-300", icon: "bg-blue-500/10 text-blue-400" };
}

function previewSrcDoc(page: StudioPageDocument | null): string {
  const html = page?.previewHtml?.trim() ?? "";
  if (html.length > 0) {
    return html;
  }
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body style=\"margin:0;background:#020617;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;\">",
    "<div style=\"text-align:center;padding:32px\"><h2 style=\"margin:0 0 8px;font-size:24px\">No preview available</h2><p style=\"margin:0;color:#94a3b8\">Save the canonical page preview before publishing.</p></div>",
    "</body></html>"
  ].join("");
}

function unpublishedPreviewSrcDoc(): string {
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body style=\"margin:0;background:#020617;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;\">",
    "<div style=\"text-align:center;padding:32px\"><h2 style=\"margin:0 0 8px;font-size:24px\">No published version</h2><p style=\"margin:0;color:#94a3b8\">Publish this page from Publish Center to create the production version.</p></div>",
    "</body></html>"
  ].join("");
}

function resolveShellPreview(shells: StudioShell[]): { headerHtml: string; footerHtml: string } {
  const activeFull = shells.find((shell) => shell.status === "active" && shell.role === "full");
  const activeNavbar = shells.find((shell) => shell.status === "active" && shell.role === "navbar");
  const activeFooter = shells.find((shell) => shell.status === "active" && shell.role === "footer");

  return {
    headerHtml:
      activeFull?.previewHtml ??
      activeNavbar?.previewHtml ??
      '<nav style="display:flex;justify-content:space-between;align-items:center;padding:14px 28px;background:#0f172a;color:#f8fafc;font-family:system-ui;border-bottom:1px solid #1e293b"><strong style="font-size:16px">LMNAs</strong><span style="font-size:12px;color:#94a3b8">Studio Shell</span></nav>',
    footerHtml:
      activeFull
        ? ""
        : activeFooter?.previewHtml ??
          '<footer style="padding:18px 28px;background:#0b1120;color:#64748b;font-family:system-ui;text-align:center;font-size:12px;border-top:1px solid #1e293b">LMNAs Studio Footer</footer>'
  };
}

function buildStagingPreview(params: {
  page: StudioPageDocument | null;
  blocks: StudioBlockTemplate[];
  shells: StudioShell[];
  themes: StudioTheme[];
  previewTheme: StudioTheme | null;
  hostAssets: ReturnType<typeof usePlatformPreviewAssets>;
}): string {
  if (!params.page) {
    return previewSrcDoc(null);
  }

  const blockMap = new Map<string, StudioBlockTemplate>();
  params.blocks.forEach((block) => {
    blockMap.set(block.id, block);
    blockMap.set(block.key, block);
  });

  const sectionHtml = params.page.blockOrder
    .map((blockId) => {
      const block = blockMap.get(blockId);
      return extractBodyHtml(ensureHtmlDocument(sanitizeTargetHtml(block?.targetPreviewHtml ?? block?.previewHtml ?? "")));
    })
    .filter((html) => html.trim().length > 0)
    .join("\n");

  const shell = resolveShellPreview(params.shells);
  const theme =
    params.previewTheme ??
    params.themes.find((entry) => entry.themeKey === params.page?.themeKey) ??
    params.themes.find((entry) => entry.status === "active") ??
    params.themes[0] ??
    null;

  return buildPlatformTargetDocument({
    bodyHtml:
      sectionHtml.length > 0
        ? sectionHtml
        : "<section style='padding:48px;font-family:system-ui'><h2>No blocks composed yet.</h2><p>Add reusable blocks before publishing.</p></section>",
    theme,
    hostAssets: params.hostAssets,
    beforeBodyHtml: shell.headerHtml,
    afterBodyHtml: shell.footerHtml
  });
}

export default function PublishWorkflowPage(): React.ReactElement {
  const platformPreviewAssets = usePlatformPreviewAssets();
  const [themes, setThemes] = useState<StudioTheme[]>([]);
  const [shells, setShells] = useState<StudioShell[]>([]);
  const [blocks, setBlocks] = useState<StudioBlockTemplate[]>([]);
  const [pages, setPages] = useState<StudioPageDocument[]>([]);
  const [publishedPages, setPublishedPages] = useState<StudioPageDocument[]>([]);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [sourceHtml, setSourceHtml] = useState(DEFAULT_SOURCE_HTML);
  const [validationTokenInput, setValidationTokenInput] = useState(DEFAULT_VALIDATION_TOKEN);
  const [thresholdDraft, setThresholdDraft] = useState("0.25");
  const [previewSwatchThemeId, setPreviewSwatchThemeId] = useState<string | null>(null);
  const [governancePageId, setGovernancePageId] = useState<string | null>(null);
  const [safetyLockEnabled, setSafetyLockEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishOverlayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const [themesPayload, settingsPayload, pagesPayload, publishedPagesPayload, blocksPayload, shellsPayload] = await Promise.all([
          requestClientJson<{ ok: boolean; data?: StudioTheme[]; error?: string }>(
            "/api/platform/studio/themes",
            { method: "GET", headers: { "content-type": "application/json" } },
            {
              timeoutMessage: "Loading themes timed out. Please retry.",
              fallbackErrorMessage: "Unable to load themes."
            }
          ),
          requestClientJson<{ ok: boolean; data?: StudioSettings; error?: string }>(
            "/api/platform/studio/settings",
            { method: "GET", headers: { "content-type": "application/json" } },
            {
              timeoutMessage: "Loading studio settings timed out. Please retry.",
              fallbackErrorMessage: "Unable to load studio settings."
            }
          ),
          requestClientJson<{ ok: boolean; data?: StudioPageDocument[]; error?: string }>(
            "/api/platform/studio/pages?status=draft",
            { method: "GET", headers: { "content-type": "application/json" } },
            {
              timeoutMessage: "Loading draft pages timed out. Please retry.",
              fallbackErrorMessage: "Unable to load draft pages."
            }
          ),
          requestClientJson<{ ok: boolean; data?: StudioPageDocument[]; error?: string }>(
            "/api/platform/studio/pages?status=published",
            { method: "GET", headers: { "content-type": "application/json" } },
            {
              timeoutMessage: "Loading published pages timed out. Please retry.",
              fallbackErrorMessage: "Unable to load published pages."
            }
          ),
          requestClientJson<{ ok: boolean; data?: StudioBlockTemplate[]; error?: string }>(
            "/api/platform/studio/blocks",
            { method: "GET", headers: { "content-type": "application/json" } },
            {
              timeoutMessage: "Loading blocks timed out. Please retry.",
              fallbackErrorMessage: "Unable to load blocks."
            }
          ),
          requestClientJson<{ ok: boolean; data?: StudioShell[]; error?: string }>(
            "/api/platform/studio/shells",
            { method: "GET", headers: { "content-type": "application/json" } },
            {
              timeoutMessage: "Loading shells timed out. Please retry.",
              fallbackErrorMessage: "Unable to load shells."
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
        if (!pagesPayload.ok || !Array.isArray(pagesPayload.data)) {
          throw new Error(pagesPayload.error ?? "Unable to load pages.");
        }
        if (!publishedPagesPayload.ok || !Array.isArray(publishedPagesPayload.data)) {
          throw new Error(publishedPagesPayload.error ?? "Unable to load published pages.");
        }
        if (!blocksPayload.ok || !Array.isArray(blocksPayload.data)) {
          throw new Error(blocksPayload.error ?? "Unable to load blocks.");
        }
        if (!shellsPayload.ok || !Array.isArray(shellsPayload.data)) {
          throw new Error(shellsPayload.error ?? "Unable to load shells.");
        }

        const loadedPages = pagesPayload.data;
        const loadedPublishedPages = publishedPagesPayload.data;
        setThemes(themesPayload.data);
        setBlocks(blocksPayload.data);
        setShells(shellsPayload.data);
        setPages(loadedPages);
        setPublishedPages(loadedPublishedPages);
        setGovernancePageId((current) => current ?? loadedPages[0]?.id ?? null);
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
    return subscribePreviewSwatchThemeId((themeId) => {
      setPreviewSwatchThemeId(themeId);
    });
  }, []);

  const activeTheme = useMemo(() => themes.find((theme) => theme.status === "active") ?? themes[0] ?? null, [themes]);
  const selectedSwatchTheme = useMemo(() => themes.find((theme) => theme.id === previewSwatchThemeId) ?? null, [themes, previewSwatchThemeId]);
  const governancePage = useMemo(() => pages.find((page) => page.id === governancePageId) ?? pages[0] ?? null, [pages, governancePageId]);
  const draftPages = useMemo(() => pages.filter((page) => page.status !== "published"), [pages]);
  const publishedPage = useMemo(
    () =>
      governancePage
        ? publishedPages.find((page) => page.id === governancePage.id || page.slug === governancePage.slug) ?? null
        : null,
    [governancePage, publishedPages]
  );
  const productionPreview = useMemo(
    () => {
      const publishedPreviewHtml =
        governancePage?.publishedPreviewHtml?.trim().length
          ? governancePage.publishedPreviewHtml
          : publishedPage?.previewHtml?.trim().length
            ? publishedPage.previewHtml
            : "";
      if (!publishedPreviewHtml) {
        return unpublishedPreviewSrcDoc();
      }
      return publishedPreviewHtml;
    },
    [governancePage, publishedPage]
  );
  const stagingPreview = useMemo(
    () => {
      if (!governancePage) {
        return previewSrcDoc(null);
      }
      if (governancePage.previewHtml.trim().length > 0) {
        return governancePage.previewHtml;
      }
      return buildStagingPreview({
        page: governancePage,
        blocks,
        shells,
        themes,
        previewTheme: null,
        hostAssets: platformPreviewAssets
      });
    },
    [blocks, governancePage, platformPreviewAssets, shells, themes]
  );

  const readinessChecklist = useMemo(
    () => [
      { id: "preview-valid", label: "Preview valid", pass: Boolean(governancePage?.previewValid), detail: "Viewport tests passed" },
      { id: "block-schema-valid", label: "Schema valid", pass: Boolean(governancePage?.blockSchemaValid), detail: "JSON-LD structured data" },
      { id: "product-mapped", label: "Product mapped", pass: Boolean(governancePage?.productMapping?.trim()), detail: "SKU inventory synced" },
      { id: "primary-cta-set", label: "Primary CTA set", pass: Boolean(governancePage?.primaryCta.text.trim() && governancePage?.primaryCta.url.trim()), detail: "Lead capture active" },
      { id: "conversion-present", label: "Conversion config", pass: Boolean(governancePage?.conversionConfig.strategy.trim()), detail: "GTM and pixel verified" },
      { id: "seo-jsonld-valid", label: "SEO valid", pass: Boolean(governancePage?.seoJsonLdValid), detail: "Meta tags and structured data" }
    ],
    [governancePage]
  );
  const readyToPublish = readinessChecklist.length > 0 && readinessChecklist.every((item) => item.pass);
  const readinessPassedCount = readinessChecklist.filter((item) => item.pass).length;

  const pendingChanges = useMemo<ChangeCard[]>(() => {
    const pageCard: ChangeCard = {
      id: "page",
      title: governancePage ? `Page: ${governancePage.name}` : "No page selected",
      subtitle: governancePage ? `${governancePage.locale}/${governancePage.slug}` : "Select a canonical page",
      tone: governancePage?.status === "published" ? "blue" : "emerald",
      status: governancePage?.status === "published" ? "modified" : "draft"
    };
    const themeCard: ChangeCard = {
      id: "theme",
      title: activeTheme ? `Theme: ${activeTheme.name}` : "No active theme",
      subtitle: activeTheme ? `${activeTheme.themeKey} • ${activeTheme.darkMode ? "dark" : "light"}` : "Theme missing",
      tone: "blue",
      status: "active"
    };
    const swatchCard: ChangeCard = {
      id: "swatch",
      title: selectedSwatchTheme ? `Preview Swatch: ${selectedSwatchTheme.name}` : "Preview swatch not applied here",
      subtitle: selectedSwatchTheme
        ? "Publish Center previews use persisted Strapi draft/published page versions, not transient swatches."
        : "Publish Center previews use persisted Strapi draft/published page versions.",
      tone: selectedSwatchTheme ? "violet" : "rose",
      status: selectedSwatchTheme ? "ignored" : "canonical"
    };
    const readinessCard: ChangeCard = {
      id: "readiness",
      title: readyToPublish ? "Validation complete" : "Validation still required",
      subtitle: `${readinessPassedCount}/${readinessChecklist.length} checks passed`,
      tone: readyToPublish ? "emerald" : "rose",
      status: readyToPublish ? "validated" : "blocked"
    };
    return [pageCard, themeCard, swatchCard, readinessCard];
  }, [activeTheme, governancePage, readinessChecklist.length, readinessPassedCount, readyToPublish, selectedSwatchTheme]);

  async function updateFidelitySettings(next: StudioFidelitySettings): Promise<void> {
    setIsSavingSettings(true);
    setError(null);
    try {
      const payload = await requestClientJson<{ ok: boolean; data?: StudioSettings; error?: string }>(
        "/api/platform/studio/settings",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fidelity: next })
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
    if (!settings || !governancePage) {
      setError("Select a canonical page before publishing.");
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
            pageId: governancePage.id,
            pageSlug: governancePage.slug,
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

      const [refreshedDraftPages, refreshedPublishedPages] = await Promise.all([
        requestClientJson<{ ok: boolean; data?: StudioPageDocument[]; error?: string }>(
          "/api/platform/studio/pages?status=draft",
          { method: "GET", headers: { "content-type": "application/json" } },
          {
            timeoutMessage: "Refreshing draft pages timed out. Please retry.",
            fallbackErrorMessage: "Unable to refresh draft pages after publish."
          }
        ),
        requestClientJson<{ ok: boolean; data?: StudioPageDocument[]; error?: string }>(
          "/api/platform/studio/pages?status=published",
          { method: "GET", headers: { "content-type": "application/json" } },
          {
            timeoutMessage: "Refreshing published pages timed out. Please retry.",
            fallbackErrorMessage: "Unable to refresh published pages after publish."
          }
        )
      ]);
      if (refreshedDraftPages.ok && Array.isArray(refreshedDraftPages.data)) {
        setPages(refreshedDraftPages.data);
      }
      if (refreshedPublishedPages.ok && Array.isArray(refreshedPublishedPages.data)) {
        setPublishedPages(refreshedPublishedPages.data);
      }
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : String(publishError));
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6" data-testid="publish-workspace">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
            <span className="material-symbols-outlined">cloud_upload</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Publish Center</h1>
            <p className="mt-1 text-sm text-slate-500">Review canonical page changes and publish only when governance clears.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1.5">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0b1528] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Safety Lock</span>
            <label data-testid="publish-safety-toggle" className="relative inline-flex cursor-pointer items-center">
              <input
                data-testid="publish-safety-lock"
                type="checkbox"
                checked={safetyLockEnabled}
                onChange={(event) => setSafetyLockEnabled(event.target.checked)}
                className="peer sr-only"
              />
              <span className="h-5 w-9 rounded-full bg-slate-700 transition peer-checked:bg-emerald-500" />
              <span className="absolute left-[2px] top-[2px] h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4" />
            </label>
          </div>
          <button
            type="button"
            data-testid="publish-live-button"
            onClick={() => {
              void runPublish();
            }}
            disabled={!safetyLockEnabled || isPublishing}
            className="rounded-xl bg-blue-500 px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPublishing ? "Publishing…" : "Publish Live"}
          </button>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-100">Review your changes</h2>
        <p className="text-lg text-slate-400">
          You have {Math.max(1, draftPages.length)} pending canonical page change{draftPages.length === 1 ? "" : "s"} ready for production deployment.
        </p>
      </section>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-300">{error}</div> : null}
      {publishResult ? (
        <div className={`rounded-xl border px-4 py-3 ${publishResult.applied ? "border-blue-500/30 bg-blue-500/[0.08]" : "border-amber-500/30 bg-amber-500/[0.08]"}`}>
          <p className={`text-sm font-semibold ${publishResult.applied ? "text-blue-200" : "text-amber-200"}`}>
            {publishResult.applied ? "Canonical publish completed" : "Publish not applied"}
          </p>
          <p className="mt-1 text-xs text-slate-300">
            {publishResult.applied
              ? `Published studio-page ${publishResult.persistence?.pageId ?? "n/a"} through ${publishResult.persistence?.source ?? "unknown"}.`
              : publishResult.rejectionReason ?? "Governance or fidelity blocked publish."}
          </p>
        </div>
      ) : null}

      <div className={`rounded-2xl border p-4 ${readyToPublish ? "border-blue-500/20 bg-blue-500/[0.06]" : "border-amber-500/20 bg-amber-500/[0.07]"}`}>
        <div className="flex flex-wrap items-center gap-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${readyToPublish ? "bg-blue-500/20 text-blue-300" : "bg-amber-500/20 text-amber-300"}`}>
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div>
            <h3 className={`text-sm font-semibold ${readyToPublish ? "text-blue-200" : "text-amber-200"}`}>{readyToPublish ? "Ready to Publish" : "Governance review required"}</h3>
            <p className="text-sm text-slate-400">
              {readyToPublish
                ? "All checks passed. Your changes are optimized and ready for canonical publish."
                : "Resolve the remaining governance gaps before publishing the canonical page."}
            </p>
          </div>
          <div className={`ml-auto rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${readyToPublish ? "bg-blue-500/10 text-blue-300" : "bg-amber-500/10 text-amber-300"}`}>
            {readyToPublish ? "Validated" : "Blocked"}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Validation Checklist</h3>
            <p className="mt-2 text-sm text-slate-400">Canonical publish gate for the selected Studio page.</p>
          </div>
          <span className={`text-xs font-semibold ${readyToPublish ? "text-emerald-400" : "text-amber-300"}`}>
            {readyToPublish ? "SYSTEM CLEAR" : "NEEDS ATTENTION"}
          </span>
        </div>
        <label className="mb-4 flex flex-col gap-1 text-[11px] text-slate-400">
          Governance Page
          <select
            data-testid="publish-governance-page"
            value={governancePage?.id ?? ""}
            onChange={(event) => setGovernancePageId(event.target.value || null)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
          >
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.name} ({page.locale}/{page.slug})
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {readinessChecklist.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.015] px-3 py-3">
              <span className={`material-symbols-outlined text-[18px] ${item.pass ? "text-emerald-400" : "text-rose-400"}`}>
                {item.pass ? "check_circle" : "cancel"}
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-200">{item.label}</p>
                <p className="text-[11px] text-slate-500">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-slate-500">Version Preview</h3>
          <div className="flex gap-4 text-[10px] font-medium">
            <span className="flex items-center gap-1 text-slate-400"><span className="h-2 w-2 rounded-full bg-slate-400" />Production</span>
            <span className="flex items-center gap-1 text-blue-300"><span className="h-2 w-2 rounded-full bg-blue-500" />Staging</span>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#020817]">
            <header className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-slate-500">public</span>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Live Production</span>
              </div>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                    publishedPage ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"
                  }`}
                >
                  {publishedPage ? "Online" : "Unpublished"}
                </span>
            </header>
            <div className="h-[420px] bg-[#020617] p-3 opacity-60 grayscale">
              <iframe
                data-testid="publish-production-preview"
                title="publish-production-preview"
                className="h-full w-full rounded-xl border border-white/[0.08] bg-white"
                srcDoc={productionPreview}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </article>
          <article className="overflow-hidden rounded-2xl border-2 border-blue-500 bg-[#071226] shadow-xl shadow-blue-500/10">
            <header className="flex items-center justify-between border-b border-blue-500/20 bg-blue-500/[0.05] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-blue-300">science</span>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Draft Staging</span>
              </div>
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-200">Draft</span>
            </header>
            <div className="h-[420px] bg-[#071226] p-3">
              <iframe
                data-testid="publish-staging-preview"
                title="publish-staging-preview"
                className="h-full w-full rounded-xl border border-blue-500/20 bg-white"
                srcDoc={stagingPreview}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </article>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-slate-500">Summary of Changes</h3>
          <span className="rounded bg-white/[0.06] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{pendingChanges.length} pending items</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pendingChanges.map((item) => {
            const tones = changeToneClasses(item.tone);
            return (
              <article key={item.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.14]">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones.icon}`}>
                    <span className="material-symbols-outlined text-[18px]">published_with_changes</span>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${tones.badge}`}>{item.status}</span>
                </div>
                <p className="text-sm font-bold text-slate-100">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="border-b border-white/[0.08] px-6 py-5">
          <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-slate-500">Deployment Config</h3>
        </div>
        <div className="grid gap-6 px-6 py-6 md:grid-cols-3">
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Environment</label>
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.015] p-4">
              <span className="material-symbols-outlined text-blue-300">cloud_done</span>
              <div>
                <p className="text-sm font-bold text-slate-100">Production Edge</p>
                <p className="text-xs text-slate-500">Canonical studio-page publish</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Fidelity Mode</label>
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    data-testid="publish-mode-allow"
                    type="button"
                    disabled={isSavingSettings}
                    onClick={() => {
                      if (!settings) return;
                      void updateFidelitySettings({ mode: "allow-below-threshold", threshold: settings.fidelity.threshold });
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${settings?.fidelity.mode === "allow-below-threshold" ? "bg-emerald-500/20 text-emerald-200" : "bg-white/[0.05] text-slate-400"}`}
                  >
                    allow-below-threshold
                  </button>
                  <button
                    data-testid="publish-mode-disallow"
                    type="button"
                    disabled={isSavingSettings}
                    onClick={() => {
                      if (!settings) return;
                      void updateFidelitySettings({ mode: "disallow-below-threshold", threshold: settings.fidelity.threshold });
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${settings?.fidelity.mode === "disallow-below-threshold" ? "bg-red-500/20 text-red-200" : "bg-white/[0.05] text-slate-400"}`}
                  >
                    disallow-below-threshold
                  </button>
                </div>
                <label className="mt-4 flex flex-col gap-1 text-[11px] text-slate-400">
                  Threshold (0.00 - 1.00)
                  <input
                    data-testid="publish-threshold-input"
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
                    value={thresholdDraft}
                    onChange={(event) => setThresholdDraft(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  data-testid="publish-save-settings"
                  disabled={isSavingSettings || !settings}
                  onClick={() => {
                    if (!settings) return;
                    const parsed = Number(thresholdDraft);
                    const normalized = Number.isFinite(parsed) ? parsed : settings.fidelity.threshold;
                    void updateFidelitySettings({ mode: settings.fidelity.mode, threshold: normalized });
                  }}
                  className="mt-4 rounded-lg border border-white/[0.12] px-3 py-2 text-xs font-semibold text-slate-300 disabled:opacity-50"
                >
                  {isSavingSettings ? "Saving…" : "Save Fidelity Settings"}
                </button>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Theme Context</p>
                <p className="mt-3 text-sm font-bold text-slate-100">{activeTheme?.name ?? "No active theme"}</p>
                <p className="mt-1 text-xs text-slate-500">{activeTheme?.themeKey ?? "n/a"}</p>
                <p className="mt-3 text-xs text-slate-400">
                  {selectedSwatchTheme
                    ? `Global swatch ${selectedSwatchTheme.name} is selected elsewhere, but Publish Center uses persisted draft/published previews only.`
                    : "Publish Center uses persisted draft/published previews only."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {themes.slice(0, 5).map((theme) => {
                    const selected = selectedSwatchTheme?.id === theme.id;
                    const active = activeTheme?.id === theme.id;
                    return (
                      <span
                        key={theme.id}
                        className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                          selected
                            ? "border-blue-500/40 bg-blue-500/15 text-blue-200"
                            : active
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                              : "border-white/[0.08] bg-white/[0.04] text-slate-400"
                        }`}
                      >
                        {theme.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.08] px-6 py-6">
          <details className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200">Advanced Fidelity Inputs</summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                Source HTML
                <textarea data-testid="publish-source-html" className="min-h-[180px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-xs text-slate-100" value={sourceHtml} onChange={(event) => setSourceHtml(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                Figma Validation Token (JSON)
                <textarea data-testid="publish-validation-token" className="min-h-[180px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-xs text-slate-100" value={validationTokenInput} onChange={(event) => setValidationTokenInput(event.target.value)} />
              </label>
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}
