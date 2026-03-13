"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestClientJson } from "../_lib/client-request";
import {
  buildPlatformTargetDocument,
  ensureHtmlDocument,
  extractBodyHtml,
  sanitizeTargetHtml,
  usePlatformPreviewAssets
} from "../_lib/platform-preview";
import { subscribePagePreviewAcceptance } from "../_lib/page-preview-acceptance-channel";
import { invalidatePageValidationOnEdit } from "../_lib/page-validation";
import { readPreviewSwatchThemeId, setPreviewSwatchThemeId, subscribePreviewSwatchThemeId } from "../_lib/preview-swatch-state";
import type { StudioBlockTemplate, StudioPageDocument, StudioShell, StudioTheme } from "../_lib/studio-types";

type PreviewMode = "draft" | "production";
type PageFocusMode = "default" | "page-focus" | "full-screen";
type CanvasDevice = "desktop" | "tablet" | "mobile";

type PagesGetResponse = {
  ok: boolean;
  data?: StudioPageDocument[] | StudioPageDocument | null;
  source?: "strapi" | "fallback";
  error?: string;
};

type BlocksGetResponse = {
  ok: boolean;
  data?: StudioBlockTemplate[];
  source?: "strapi" | "fallback";
  schemaSource?: "canonical" | "legacy" | "fallback";
  error?: string;
};

type ShellsGetResponse = {
  ok: boolean;
  data?: StudioShell[];
  source?: "strapi" | "fallback";
  schemaSource?: "canonical" | "legacy" | "fallback";
  error?: string;
};

type ThemesGetResponse = {
  ok: boolean;
  data?: StudioTheme[];
  source?: "strapi" | "fallback";
  schemaSource?: "canonical" | "legacy" | "fallback";
  error?: string;
};

type PagesPostResponse = {
  ok: boolean;
  data?: {
    page?: StudioPageDocument;
    applied?: boolean;
    warnings?: string[];
    previewRoute?: string;
    importedBlocks?: Array<{ key: string; family: string }>;
    blockCount?: number;
  };
  source?: "strapi" | "fallback";
  error?: string;
  code?: string;
};

const DEFAULT_NAVBAR_HTML =
  '<nav style="display:flex;justify-content:space-between;align-items:center;padding:14px 28px;background:#0f172a;color:#f8fafc;font-family:system-ui;border-bottom:1px solid #1e293b"><strong style="font-size:16px">LMNAs</strong><span style="font-size:12px;color:#94a3b8">Studio Shell</span></nav>';
const DEFAULT_FOOTER_HTML =
  '<footer style="padding:18px 28px;background:#0b1120;color:#64748b;font-family:system-ui;text-align:center;font-size:12px;border-top:1px solid #1e293b">LMNAs Studio Footer</footer>';

function sanitizeSlug(value: string): string {
  const next = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return next.length > 0 ? next : "draft-page";
}

function createUniqueDraftSlug(name: string, seed: number, existingPages: StudioPageDocument[]): string {
  const baseSlug = sanitizeSlug(name.trim().length > 0 ? name : `draft-page-${seed}`);
  const existing = new Set(existingPages.map((page) => `${page.locale}:${page.slug}`));
  if (!existing.has(`en:${baseSlug}`)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existing.has(`en:${baseSlug}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseSlug}-${suffix}`;
}

function createDraftPage(name: string, seed: number, existingPages: StudioPageDocument[]): StudioPageDocument {
  const normalizedName = name.trim().length > 0 ? name.trim() : `Draft Page ${seed}`;
  const slug = createUniqueDraftSlug(normalizedName, seed, existingPages);
  return {
    id: `page-${Date.now()}-${seed}`,
    name: normalizedName,
    slug,
    locale: "en",
    activeShellId: undefined,
    shellKey: undefined,
    lifecycle: "draft",
    status: "draft",
    blockOrder: [],
    fieldValues: {},
    actionOverrides: {},
    productMapping: "",
    industryMapping: [],
    primaryCta: {
      text: "",
      url: ""
    },
    conversionConfig: {
      trackConversions: true,
      strategy: "Track Conversions",
      valuePoints: 0
    },
    campaignUtmStrategy: {
      source: "",
      medium: "",
      campaign: ""
    },
    taxonomyState: {
      valid: false,
      tags: []
    },
    seoMetadata: {
      metaTitle: "",
      metaDescription: ""
    },
    seoJsonLdValid: false,
    blockSchemaValid: true,
    previewValid: false,
    previewHtml: "",
    updatedAt: new Date().toISOString().slice(0, 10)
  };
}

function resolveShellPreview(shells: StudioShell[]): { headerHtml: string; footerHtml: string } {
  const activeFull = shells.find((shell) => shell.status === "active" && shell.role === "full");
  const activeNavbar = shells.find((shell) => shell.status === "active" && shell.role === "navbar");
  const activeFooter = shells.find((shell) => shell.status === "active" && shell.role === "footer");

  return {
    headerHtml: activeFull?.previewHtml ?? activeNavbar?.previewHtml ?? DEFAULT_NAVBAR_HTML,
    footerHtml: activeFull ? "" : activeFooter?.previewHtml ?? DEFAULT_FOOTER_HTML
  };
}

function buildPreviewHtml(params: {
  page: StudioPageDocument;
  blocks: StudioBlockTemplate[];
  shells: StudioShell[];
  themes: StudioTheme[];
  previewTheme?: StudioTheme | null;
  hostAssets: ReturnType<typeof usePlatformPreviewAssets>;
}): string {
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
    .filter((value) => value.trim().length > 0)
    .join("\n");

  const shell = resolveShellPreview(params.shells);
  const selectedTheme =
    params.previewTheme ??
    params.themes.find((theme) => theme.themeKey === params.page.themeKey) ??
    params.themes.find((theme) => theme.status === "active") ??
    params.themes[0] ??
    null;
  const body =
    sectionHtml.length > 0
      ? sectionHtml
      : "<section style='padding:48px;font-family:system-ui'><h2>No blocks composed yet.</h2><p>Add reusable blocks from the canvas.</p></section>";

  return buildPlatformTargetDocument({
    bodyHtml: body,
    theme: selectedTheme,
    hostAssets: params.hostAssets,
    beforeBodyHtml: shell.headerHtml,
    afterBodyHtml: shell.footerHtml
  });
}

function tokenValue(theme: StudioTheme, matchers: string[], fallback: string): string {
  const token = theme.tokens.find((entry) => matchers.some((matcher) => entry.key.toLowerCase().includes(matcher)));
  return token?.value ?? fallback;
}

function themeSwatchGradient(theme: StudioTheme): string {
  const primary = tokenValue(theme, ["primary", "accent"], theme.darkMode ? "#2563eb" : "#0f172a");
  const background = tokenValue(theme, ["background", "surface", "bg"], theme.darkMode ? "#020617" : "#e2e8f0");
  const muted = tokenValue(theme, ["muted", "secondary"], theme.darkMode ? "#334155" : "#94a3b8");
  return `linear-gradient(135deg, ${background} 0%, ${primary} 62%, ${muted} 100%)`;
}

function findBlockByKey(blocks: StudioBlockTemplate[], blockKey: string): StudioBlockTemplate | null {
  return blocks.find((block) => block.id === blockKey || block.key === blockKey) ?? null;
}

function mergePagesForComposer(draftPages: StudioPageDocument[], publishedPages: StudioPageDocument[]): StudioPageDocument[] {
  const merged = new Map<string, StudioPageDocument>();

  publishedPages.forEach((page) => {
    merged.set(`${page.slug}::${page.locale}`, page);
  });

  draftPages.forEach((page) => {
    merged.set(`${page.slug}::${page.locale}`, page);
  });

  return Array.from(merged.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export default function PagesWorkflowPage(): React.ReactElement {
  const platformPreviewAssets = usePlatformPreviewAssets();
  const [pages, setPages] = useState<StudioPageDocument[]>([]);
  const [publishedPages, setPublishedPages] = useState<StudioPageDocument[]>([]);
  const [blocks, setBlocks] = useState<StudioBlockTemplate[]>([]);
  const [shells, setShells] = useState<StudioShell[]>([]);
  const [themes, setThemes] = useState<StudioTheme[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("draft");
  const [focusMode, setFocusMode] = useState<PageFocusMode>("default");
  const [showPanelsInFocus, setShowPanelsInFocus] = useState(true);
  const [previewSwatchThemeId, setPreviewSwatchThemeIdLocal] = useState<string | null>(null);
  const [canvasDevice, setCanvasDevice] = useState<CanvasDevice>("desktop");
  const [candidateBlockId, setCandidateBlockId] = useState<string>("");
  const [importHtml, setImportHtml] = useState<string>("");
  const [searchPages, setSearchPages] = useState("");
  const [newPageName, setNewPageName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewSyncTimerRef = useRef<number | null>(null);

  const selectedPage = pages.find((page) => page.id === selectedId) ?? null;
  const selectedPublishedPage = useMemo(
    () =>
      selectedPage
        ? publishedPages.find((page) => page.id === selectedPage.id || page.slug === selectedPage.slug) ?? null
        : null,
    [publishedPages, selectedPage]
  );
  const selectedPageName = selectedPage?.name ?? "No page selected";

  const refreshDraftPageById = useCallback(async (pageId: string): Promise<void> => {
    const payload = await requestClientJson<PagesGetResponse>(
      `/api/platform/studio/pages?id=${encodeURIComponent(pageId)}&status=draft`,
      {
        method: "GET",
        headers: { "content-type": "application/json" }
      },
      {
        timeoutMessage: "Refreshing canonical draft page timed out. Please retry.",
        fallbackErrorMessage: "Unable to refresh canonical draft page."
      }
    );

    if (!payload.ok || payload.source !== "strapi" || !payload.data || Array.isArray(payload.data)) {
      return;
    }

    const canonicalPage = payload.data;
    setPages((current) => {
      const next = current.map((page) => (page.id === pageId || page.slug === canonicalPage.slug ? canonicalPage : page));
      return next.some((page) => page.id === canonicalPage.id) ? next : [canonicalPage, ...next];
    });
    setSelectedId((current) => (current === pageId || current === canonicalPage.id ? canonicalPage.id : current));
  }, []);

  useEffect(() => {
    if (pages.length === 0) {
      if (selectedId !== null) {
        setSelectedId(null);
      }
      return;
    }

    if (!selectedId || !pages.some((page) => page.id === selectedId)) {
      setSelectedId(pages[0].id);
    }
  }, [pages, selectedId]);

  useEffect(() => {
    return () => {
      if (previewSyncTimerRef.current !== null && typeof window !== "undefined") {
        window.clearInterval(previewSyncTimerRef.current);
      }
    };
  }, []);

  const draftCanvasHtml = useMemo(() => {
    if (!selectedPage) {
      return "<html><body><section style='padding:40px;font-family:system-ui'><h2>Select a page to preview.</h2></section></body></html>";
    }
    return buildPreviewHtml({
      page: selectedPage,
      blocks,
      shells,
      themes,
      previewTheme: themes.find((theme) => theme.id === previewSwatchThemeId) ?? null,
      hostAssets: platformPreviewAssets
    });
  }, [selectedPage, blocks, shells, themes, previewSwatchThemeId, platformPreviewAssets]);

  const draftPreviewHtml = useMemo(() => {
    if (!selectedPage) {
      return "<html><body><section style='padding:40px;font-family:system-ui'><h2>Select a page to preview.</h2></section></body></html>";
    }
    return selectedPage.previewHtml.trim().length > 0 ? selectedPage.previewHtml : draftCanvasHtml;
  }, [draftCanvasHtml, selectedPage]);

  const productionPreviewHtml = useMemo(() => {
    const publishedPreviewHtml =
      selectedPage?.publishedPreviewHtml?.trim().length
        ? selectedPage.publishedPreviewHtml
        : selectedPublishedPage?.previewHtml?.trim().length
          ? selectedPublishedPage.previewHtml
          : "";

    if (!publishedPreviewHtml) {
      return "<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head><body style=\"margin:0;background:#020617;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;\"><div style=\"text-align:center;padding:32px\"><h2 style=\"margin:0 0 8px;font-size:24px\">No published version</h2><p style=\"margin:0;color:#94a3b8\">Publish this page from Publish Center to create the production version.</p></div></body></html>";
    }
    return publishedPreviewHtml;
  }, [selectedPage, selectedPublishedPage]);

  const visiblePreviewHtml = previewMode === "production" ? productionPreviewHtml : draftPreviewHtml;

  const filteredPages = useMemo(() => {
    const query = searchPages.trim().toLowerCase();
    if (query.length === 0) {
      return pages;
    }
    return pages.filter((page) => `${page.name} ${page.slug} ${page.locale}`.toLowerCase().includes(query));
  }, [pages, searchPages]);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [pagesPayload, publishedPagesPayload, blocksPayload, shellsPayload, themesPayload] = await Promise.all([
          requestClientJson<PagesGetResponse>(
            "/api/platform/studio/pages?status=draft",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading draft pages timed out. Please retry.",
              fallbackErrorMessage: "Unable to load draft pages."
            }
          ),
          requestClientJson<PagesGetResponse>(
            "/api/platform/studio/pages?status=published",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading published pages timed out. Please retry.",
              fallbackErrorMessage: "Unable to load published pages."
            }
          ),
          requestClientJson<BlocksGetResponse>(
            "/api/platform/studio/blocks",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading block library timed out. Please retry.",
              fallbackErrorMessage: "Unable to load blocks."
            }
          ),
          requestClientJson<ShellsGetResponse>(
            "/api/platform/studio/shells",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading shells timed out. Please retry.",
              fallbackErrorMessage: "Unable to load shells."
            }
          ),
          requestClientJson<ThemesGetResponse>(
            "/api/platform/studio/themes",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading themes timed out. Please retry.",
              fallbackErrorMessage: "Unable to load themes."
            }
          )
        ]);

        if (!pagesPayload.ok || !Array.isArray(pagesPayload.data)) {
          throw new Error(pagesPayload.error ?? "Unable to load pages.");
        }
        if (pagesPayload.source !== "strapi") {
          throw new Error("Pages composer requires canonical studio-pages from Strapi.");
        }
        if (!publishedPagesPayload.ok || !Array.isArray(publishedPagesPayload.data)) {
          throw new Error(publishedPagesPayload.error ?? "Unable to load published pages.");
        }
        if (publishedPagesPayload.source !== "strapi") {
          throw new Error("Pages composer requires canonical published studio-pages from Strapi.");
        }

        if (!blocksPayload.ok || !Array.isArray(blocksPayload.data)) {
          throw new Error(blocksPayload.error ?? "Unable to load blocks.");
        }
        if (blocksPayload.source !== "strapi" || blocksPayload.schemaSource !== "canonical") {
          throw new Error("Pages composer requires canonical studio-blocks from Strapi.");
        }

        if (!shellsPayload.ok || !Array.isArray(shellsPayload.data)) {
          throw new Error(shellsPayload.error ?? "Unable to load shells.");
        }
        if (shellsPayload.source !== "strapi" || shellsPayload.schemaSource !== "canonical") {
          throw new Error("Pages composer requires canonical studio-shells from Strapi.");
        }

        if (!themesPayload.ok || !Array.isArray(themesPayload.data)) {
          throw new Error(themesPayload.error ?? "Unable to load themes.");
        }
        if (themesPayload.source !== "strapi" || themesPayload.schemaSource !== "canonical") {
          throw new Error("Pages composer requires canonical studio-themes from Strapi.");
        }

        const canonicalPages = pagesPayload.data;
        const canonicalPublishedPages = publishedPagesPayload.data;
        const canonicalBlocks = blocksPayload.data;
        const canonicalShells = shellsPayload.data;
        const canonicalThemes = themesPayload.data;

        const mergedPages = mergePagesForComposer(canonicalPages, canonicalPublishedPages);
        setPages(mergedPages);
        setPublishedPages(canonicalPublishedPages);
        setBlocks(canonicalBlocks);
        setShells(canonicalShells);
        setThemes(canonicalThemes);
        setCandidateBlockId(blocksPayload.data[0]?.id ?? "");
        setSelectedId((previous) => previous ?? mergedPages[0]?.id ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setPreviewSwatchThemeIdLocal(readPreviewSwatchThemeId());
    return subscribePreviewSwatchThemeId((themeId) => {
      setPreviewSwatchThemeIdLocal(themeId);
    });
  }, []);

  useEffect(() => {
    return subscribePagePreviewAcceptance((message) => {
      setPages((current) =>
        current.map((page) =>
          page.id === message.pageId
            ? {
                ...page,
                previewValid: message.previewValid,
                seoJsonLdValid: message.seoJsonLdValid
              }
            : page
        )
      );
      if (selectedId === message.pageId) {
        setStatusMessage(
          message.seoJsonLdValid
            ? "Preview accepted. Preview and SEO validation are current."
            : "Preview accepted. Add SEO metadata before publish."
        );
        setError(null);
      }
      void refreshDraftPageById(message.pageId).catch(() => undefined);
    });
  }, [refreshDraftPageById, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const syncSelectedDraft = () => {
      void refreshDraftPageById(selectedId).catch(() => undefined);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncSelectedDraft();
      }
    };

    window.addEventListener("focus", syncSelectedDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", syncSelectedDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshDraftPageById, selectedId]);

  function patchSelectedPage(mutator: (page: StudioPageDocument) => StudioPageDocument): void {
    if (!selectedPage) {
      return;
    }
    setPages((current) =>
      current.map((page) => {
        if (page.id !== selectedPage.id) {
          return page;
        }
        const next = mutator(page);
        return invalidatePageValidationOnEdit(page, next);
      })
    );
  }

  function addDraftPage(): void {
    if (isLoading) {
      return;
    }
    const trimmedName = newPageName.trim();
    if (trimmedName.length === 0) {
      setError("Page name is required before creating a new page.");
      setStatusMessage(null);
      return;
    }
    const next = createDraftPage(trimmedName, pages.length + 1, pages);
    setPages((current) => [next, ...current]);
    setSelectedId(next.id);
    setPreviewMode("draft");
    setNewPageName("");
    setStatusMessage(`Created draft page ${next.name}.`);
    setError(null);
  }

  function addBlockToPage(blockId: string): void {
    if (!selectedPage || !blockId) {
      return;
    }

    patchSelectedPage((page) => ({
      ...page,
      blockOrder: [...page.blockOrder, blockId],
      updatedAt: new Date().toISOString().slice(0, 10)
    }));
    setStatusMessage("Added block to page canvas.");
  }

  function moveBlock(index: number, direction: -1 | 1): void {
    if (!selectedPage) {
      return;
    }
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedPage.blockOrder.length) {
      return;
    }

    patchSelectedPage((page) => {
      const next = [...page.blockOrder];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return {
        ...page,
        blockOrder: next,
        updatedAt: new Date().toISOString().slice(0, 10)
      };
    });
  }

  function removeBlock(index: number): void {
    if (!selectedPage) {
      return;
    }
    patchSelectedPage((page) => ({
      ...page,
      blockOrder: page.blockOrder.filter((_, currentIndex) => currentIndex !== index),
      updatedAt: new Date().toISOString().slice(0, 10)
    }));
  }

  async function refreshBlocks(): Promise<void> {
    const payload = await requestClientJson<BlocksGetResponse>(
      "/api/platform/studio/blocks",
      {
        method: "GET",
        headers: { "content-type": "application/json" }
      },
      {
        timeoutMessage: "Refreshing block library timed out. Please retry.",
        fallbackErrorMessage: "Unable to refresh block library."
      }
    );

    if (!payload.ok || !Array.isArray(payload.data)) {
      throw new Error(payload.error ?? "Unable to refresh block library.");
    }
    if (payload.source !== "strapi" || payload.schemaSource !== "canonical") {
      throw new Error("Canonical studio-block refresh failed. Fallback/legacy source detected.");
    }

    setBlocks(payload.data);
    if (!candidateBlockId && payload.data[0]) {
      setCandidateBlockId(payload.data[0].id);
    }
  }

  useEffect(() => {
    if (isLoading || !selectedPage || blocks.length > 0) {
      return;
    }

    void refreshBlocks().catch((refreshError) => {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    });
  }, [blocks.length, isLoading, selectedPage]);

  async function persistSelectedPage(mode: "save" | "preview"): Promise<void> {
    if (!selectedPage) {
      setError("Select a page before saving.");
      return;
    }
    if (selectedPage.name.trim().length === 0) {
      setError("Page name is required before saving or previewing.");
      setStatusMessage(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const pagePayload: StudioPageDocument = {
        ...selectedPage,
        slug: sanitizeSlug(selectedPage.slug),
        previewHtml: draftCanvasHtml,
        updatedAt: new Date().toISOString().slice(0, 10)
      };

      const response = await requestClientJson<PagesPostResponse>(
        "/api/platform/studio/pages",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            page: pagePayload,
            mode
          })
        },
        {
          timeoutMessage: mode === "preview" ? "Preparing preview timed out. Please retry." : "Saving draft timed out. Please retry.",
          fallbackErrorMessage: mode === "preview" ? "Unable to prepare preview." : "Unable to save page draft."
        }
      );

      if (!response.ok || !response.data) {
        throw new Error(response.error ?? "Unable to save page.");
      }
      if (response.source !== "strapi") {
        throw new Error("Canonical page persistence failed. Fallback source returned.");
      }

      const persistedPage = response.data.page ?? pagePayload;
      setPages((current) => current.map((page) => (page.id === selectedPage.id ? persistedPage : page)));
      setSelectedId(persistedPage.id);

      if (mode === "preview") {
        setPreviewMode("draft");
        setStatusMessage("Draft preview opened. Review the page and accept the preview in the preview tab.");
        if (response.data.previewRoute && typeof window !== "undefined") {
          const previewWindow = window.open(response.data.previewRoute, "_blank");
          if (previewSyncTimerRef.current !== null) {
            window.clearInterval(previewSyncTimerRef.current);
          }
          previewSyncTimerRef.current = window.setInterval(() => {
            void refreshDraftPageById(persistedPage.id).catch(() => undefined);
            if (!previewWindow || previewWindow.closed) {
              if (previewSyncTimerRef.current !== null) {
                window.clearInterval(previewSyncTimerRef.current);
                previewSyncTimerRef.current = null;
              }
            }
          }, 1000);
        }
      } else {
        setStatusMessage("Draft saved successfully.");
      }

      const [draftRefresh, publishedRefresh] = await Promise.all([
        requestClientJson<PagesGetResponse>(
          "/api/platform/studio/pages?status=draft",
          { method: "GET", headers: { "content-type": "application/json" } },
          {
            timeoutMessage: "Refreshing draft pages timed out. Please retry.",
            fallbackErrorMessage: "Unable to refresh draft pages."
          }
        ),
        requestClientJson<PagesGetResponse>(
          "/api/platform/studio/pages?status=published",
          { method: "GET", headers: { "content-type": "application/json" } },
          {
            timeoutMessage: "Refreshing published pages timed out. Please retry.",
            fallbackErrorMessage: "Unable to refresh published pages."
          }
        )
      ]);

      if (draftRefresh.ok && Array.isArray(draftRefresh.data)) {
        const mergedPages = mergePagesForComposer(
          draftRefresh.data,
          publishedRefresh.ok && Array.isArray(publishedRefresh.data) ? publishedRefresh.data : publishedPages
        );
        setPages(mergedPages);
        const matchedPersistedPage =
          mergedPages.find((page) => page.id === persistedPage.id || page.slug === persistedPage.slug) ?? null;
        if (matchedPersistedPage) {
          setSelectedId(matchedPersistedPage.id);
        }
      }
      if (publishedRefresh.ok && Array.isArray(publishedRefresh.data)) {
        setPublishedPages(publishedRefresh.data);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function runBlocksOnlyImport(): Promise<void> {
    if (importHtml.trim().length === 0) {
      setError("Paste full-page HTML before running import.");
      return;
    }

    setIsImporting(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await requestClientJson<PagesPostResponse>(
        "/api/platform/studio/pages",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "import-blocks",
            html: importHtml,
            sourceRef: "docs/testing-artifacts/code.html"
          })
        },
        {
          timeoutMessage: "Full-page import timed out. Please retry.",
          fallbackErrorMessage: "Unable to run full-page import."
        }
      );

      if (!response.ok || !response.data) {
        throw new Error(response.error ?? "Import failed.");
      }
      if (response.source !== "strapi") {
        throw new Error("Canonical block import failed. Fallback source returned.");
      }

      await refreshBlocks();
      setStatusMessage(`Imported ${response.data.blockCount ?? 0} reusable section(s) from full-page HTML.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setIsImporting(false);
    }
  }

  function toggleIndustry(industry: string): void {
    if (!selectedPage) {
      return;
    }

    patchSelectedPage((page) => {
      const exists = page.industryMapping.includes(industry);
      return {
        ...page,
        industryMapping: exists ? page.industryMapping.filter((entry) => entry !== industry) : [...page.industryMapping, industry],
        updatedAt: new Date().toISOString().slice(0, 10)
      };
    });
  }

  function enterFocusMode(): void {
    if (!selectedPage) {
      setError("No page selected. Focus mode is available in read-only state.");
    } else {
      setError(null);
    }
    setShowPanelsInFocus(true);
    setFocusMode("page-focus");
  }

  function enterFullScreenMode(): void {
    if (!selectedPage) {
      setError("No page selected. Full-screen focus is available in read-only state.");
    } else {
      setError(null);
    }
    setFocusMode("full-screen");
  }

  const shellOptions = shells.filter((shell) => shell.role === "full" || shell.role === "navbar");
  const industryOptions = ["fintech", "healthcare", "saas", "ecommerce", "enterprise"] as const;
  const previewTheme = themes.find((theme) => theme.id === previewSwatchThemeId) ?? themes.find((theme) => theme.status === "active") ?? themes[0] ?? null;

  function canvasMaxWidthClass(): string {
    if (canvasDevice === "tablet") {
      return "max-w-[780px]";
    }
    if (canvasDevice === "mobile") {
      return "max-w-[380px]";
    }
    return "max-w-[920px]";
  }

  function renderPageListPanel(params: { testId: string; compact?: boolean }): React.ReactElement {
    const { testId, compact = false } = params;
    return (
      <aside data-testid={testId} className="flex min-h-0 flex-col border-r border-white/[0.08] bg-[#081327]">
        <div className="border-b border-white/[0.08] p-3">
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-2.5 text-[16px] text-slate-500">search</span>
            <input
              value={searchPages}
              onChange={(event) => setSearchPages(event.target.value)}
              className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] py-2 pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-500"
              placeholder="Search pages..."
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {filteredPages.map((page) => {
            const isActive = page.id === selectedId;
            return (
              <button
                key={page.id}
                type="button"
                data-testid={`pages-item-${page.id}`}
                data-active={isActive ? "true" : "false"}
                onClick={() => {
                  setSelectedId(page.id);
                  setPreviewMode("draft");
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                  isActive ? "bg-blue-500/[0.18] text-blue-200" : "text-slate-300 hover:bg-white/[0.04]"
                }`}
              >
                <span className="truncate text-sm font-medium">{page.name}</span>
                {page.status === "published" ? (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                ) : (
                  <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-400">draft</span>
                )}
              </button>
            );
          })}

          {!isLoading && filteredPages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/[0.12] px-3 py-5 text-center text-xs text-slate-500">
              No pages found.
            </div>
          ) : null}
        </div>

        <div className={`border-t border-white/[0.08] p-3 ${compact ? "pt-2" : ""}`}>
          <div className="space-y-2">
            <input
              data-testid="pages-new-name-input"
              value={newPageName}
              disabled={isLoading}
              onChange={(event) => {
                setNewPageName(event.target.value);
                if (error === "Page name is required before creating a new page.") {
                  setError(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addDraftPage();
                }
              }}
              placeholder="New page name"
              className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              data-testid="pages-add-new"
              onClick={addDraftPage}
              disabled={isLoading || newPageName.trim().length === 0}
              className="w-full rounded-lg border border-dashed border-white/[0.16] px-3 py-2 text-xs font-semibold text-slate-400 hover:border-blue-400/50 hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Loading Pages..." : "+ Add New Page"}
            </button>
          </div>
        </div>
      </aside>
    );
  }

  function renderCanvas(params: { testId: string; showHeader?: boolean; showSnapshot?: boolean }): React.ReactElement {
    const { testId, showHeader = true, showSnapshot = true } = params;

    return (
      <section data-testid={testId} className="min-h-0 overflow-y-auto bg-[radial-gradient(#233348_1px,transparent_1px)] [background-size:24px_24px] p-4 md:p-6">
        <div className={`mx-auto space-y-4 ${canvasMaxWidthClass()}`}>
          {showHeader ? (
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-slate-500">layers</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Canvas Workspace</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCanvasDevice("mobile")}
                  className={`rounded p-1 ${canvasDevice === "mobile" ? "text-blue-300" : "text-slate-500"}`}
                >
                  <span className="material-symbols-outlined text-[16px]">stay_primary_portrait</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasDevice("tablet")}
                  className={`rounded p-1 ${canvasDevice === "tablet" ? "text-blue-300" : "text-slate-500"}`}
                >
                  <span className="material-symbols-outlined text-[16px]">tablet_mac</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasDevice("desktop")}
                  className={`rounded p-1 ${canvasDevice === "desktop" ? "text-blue-300" : "text-slate-500"}`}
                >
                  <span className="material-symbols-outlined text-[16px]">desktop_windows</span>
                </button>
              </div>
            </div>
          ) : null}

          {showSnapshot ? (
            <article className="overflow-hidden rounded-xl border border-white/[0.12] bg-[#0f1d36]/90">
              <header className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2">
                <p className="text-xs font-semibold text-slate-200">Page Snapshot · {previewMode}</p>
                <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("draft")}
                    className={`rounded px-2 py-0.5 text-[11px] ${previewMode === "draft" ? "bg-blue-500/20 text-blue-200" : "text-slate-500"}`}
                  >
                    Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("production")}
                    className={`rounded px-2 py-0.5 text-[11px] ${previewMode === "production" ? "bg-emerald-500/20 text-emerald-200" : "text-slate-500"}`}
                  >
                    Production
                  </button>
                </div>
              </header>
              <div className="h-[280px] bg-[#020a18] p-2">
                <iframe
                  data-testid="pages-preview-frame"
                  title="page-preview"
                  className="h-full w-full rounded-lg border border-white/[0.08] bg-white"
                  srcDoc={visiblePreviewHtml}
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </article>
          ) : null}

          {selectedPage ? (
            selectedPage.blockOrder.map((blockKey, index) => {
              const block = findBlockByKey(blocks, blockKey);
              const previewHtml =
                block && (block.targetPreviewHtml ?? block.previewHtml ?? "").trim().length > 0
                  ? buildPlatformTargetDocument({
                      bodyHtml: extractBodyHtml(ensureHtmlDocument(sanitizeTargetHtml(block.targetPreviewHtml ?? block.previewHtml ?? ""))),
                      theme:
                        previewTheme ??
                        themes.find((theme) => theme.themeKey === selectedPage.themeKey) ??
                        themes.find((theme) => theme.status === "active") ??
                        themes[0] ??
                        null,
                      hostAssets: platformPreviewAssets
                    })
                  : "";
              return (
                <article
                  key={`${blockKey}-${index}`}
                  data-testid={`pages-canvas-block-${index}`}
                  className={`group relative overflow-hidden rounded-xl border ${
                    index === 0 ? "border-white/[0.08] bg-[#122443]" : "border-blue-500/40 bg-[#132640]"
                  } shadow-[0_20px_35px_rgba(2,8,20,0.35)]`}
                >
                  <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
                    <button
                      type="button"
                      data-testid={`pages-block-up-${index}`}
                      onClick={() => moveBlock(index, -1)}
                      disabled={index === 0}
                      className="rounded border border-white/[0.12] bg-[#0c1c35] p-1 text-slate-300 disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-[16px]">expand_less</span>
                    </button>
                    <button
                      type="button"
                      data-testid={`pages-block-down-${index}`}
                      onClick={() => moveBlock(index, 1)}
                      disabled={index === selectedPage.blockOrder.length - 1}
                      className="rounded border border-white/[0.12] bg-[#0c1c35] p-1 text-slate-300 disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-[16px]">expand_more</span>
                    </button>
                    <button
                      type="button"
                      data-testid={`pages-block-remove-${index}`}
                      onClick={() => removeBlock(index)}
                      className="rounded border border-red-500/40 bg-red-500/[0.15] p-1 text-red-200"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>

                  <div className="border-b border-white/[0.06] px-3 py-2">
                    <p className="text-xs font-semibold text-slate-200">{block?.name ?? blockKey}</p>
                    <p className="text-[11px] text-slate-500">{block?.family ?? "unknown"}</p>
                  </div>
                  <div className="h-[300px] bg-[#0a152b] p-2">
                    {previewHtml.trim().length > 0 ? (
                      <iframe
                        title={`canvas-${blockKey}-${index}`}
                        className="h-full w-full rounded-lg border border-white/[0.06] bg-white"
                        srcDoc={previewHtml}
                        sandbox="allow-scripts allow-same-origin"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/[0.12] text-xs text-slate-500">
                        Preview unavailable for this block.
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-white/[0.12] px-4 py-10 text-center text-sm text-slate-500">
              Select a page from the left panel.
            </div>
          )}

          {selectedPage ? (
            <div className="rounded-xl border-2 border-dashed border-white/[0.12] bg-[#0b1730]/60 px-4 py-6">
              {blocks.length > 0 ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      data-testid="pages-add-block-select"
                      value={candidateBlockId}
                      onChange={(event) => setCandidateBlockId(event.target.value)}
                      className="min-w-[240px] rounded-lg border border-white/[0.12] bg-white/[0.02] px-3 py-2 text-xs text-slate-200"
                    >
                      {blocks.map((block) => (
                        <option key={block.id} value={block.id}>
                          {block.name} ({block.family})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      data-testid="pages-add-block-button"
                      onClick={() => addBlockToPage(candidateBlockId)}
                      className="rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Add Block
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] text-slate-500">Open Component Gallery · Add reusable governed sections</p>
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">No canonical blocks loaded in the composer yet.</p>
                    <p className="mt-1 text-[11px] text-slate-500">Refresh the block library to load persisted studio-blocks into the component gallery.</p>
                  </div>
                  <button
                    type="button"
                    data-testid="pages-refresh-block-library"
                    onClick={() => {
                      setError(null);
                      void refreshBlocks().catch((refreshError) => {
                        setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
                      });
                    }}
                    className="rounded-lg border border-blue-400/35 bg-blue-500/[0.12] px-3 py-2 text-xs font-semibold text-blue-200"
                  >
                    Refresh Blocks
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  function renderInspector(params: { testId: string }): React.ReactElement {
    return (
      <aside data-testid={params.testId} className="border-l border-white/[0.08] bg-[#081327] px-4 py-4">
        {selectedPage ? (
          <div className="space-y-4">
            <section className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Update Strategy</p>
              <div className="mt-2 grid gap-2">
                <button type="button" className="rounded border border-blue-500/35 bg-blue-500/[0.14] px-2 py-1 text-left text-[11px] text-blue-200">
                  Page Only
                </button>
                <button type="button" className="rounded border border-white/[0.1] bg-white/[0.02] px-2 py-1 text-left text-[11px] text-slate-400">
                  Global Sync
                </button>
              </div>
            </section>

            <label className="block text-[11px] text-slate-400">
              Page Name
              <input
                data-testid="pages-name-input"
                value={selectedPage.name}
                onChange={(event) =>
                  patchSelectedPage((page) => ({
                    ...page,
                    name: event.target.value,
                    updatedAt: new Date().toISOString().slice(0, 10)
                  }))
                }
                className="mt-1 w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                placeholder="Page name"
              />
              <span className="mt-1 block text-[10px] text-slate-500">
                Route slug: /{selectedPage.locale}/{selectedPage.slug}
              </span>
            </label>

            <label className="block text-[11px] text-slate-400">
              Product Mapping
              <input
                value={selectedPage.productMapping}
                onChange={(event) =>
                  patchSelectedPage((page) => ({
                    ...page,
                    productMapping: event.target.value,
                    updatedAt: new Date().toISOString().slice(0, 10)
                  }))
                }
                className="mt-1 w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                placeholder="Select product..."
              />
            </label>

            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Industry Mapping</p>
              <div className="flex flex-wrap gap-1.5">
                {industryOptions.map((industry) => {
                  const active = selectedPage.industryMapping.includes(industry);
                  return (
                    <button
                      key={industry}
                      type="button"
                      onClick={() => toggleIndustry(industry)}
                      className={`rounded px-2 py-1 text-[10px] font-semibold uppercase ${
                        active ? "bg-blue-500/20 text-blue-200" : "bg-white/[0.04] text-slate-400"
                      }`}
                    >
                      {industry}
                    </button>
                  );
                })}
              </div>
            </div>

            <section className="space-y-2 border-t border-white/[0.08] pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Primary CTA</p>
              <input
                value={selectedPage.primaryCta.text}
                onChange={(event) =>
                  patchSelectedPage((page) => ({
                    ...page,
                    primaryCta: {
                      ...page.primaryCta,
                      text: event.target.value
                    },
                    updatedAt: new Date().toISOString().slice(0, 10)
                  }))
                }
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                placeholder="Button text"
              />
              <input
                value={selectedPage.primaryCta.url}
                onChange={(event) =>
                  patchSelectedPage((page) => ({
                    ...page,
                    primaryCta: {
                      ...page.primaryCta,
                      url: event.target.value
                    },
                    updatedAt: new Date().toISOString().slice(0, 10)
                  }))
                }
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                placeholder="Link URL"
              />
            </section>

            <section className="space-y-2 border-t border-white/[0.08] pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Conversion Config</p>
              <label className="flex items-center justify-between rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-[11px] text-slate-300">
                <span>Track Conversions</span>
                <input
                  type="checkbox"
                  checked={selectedPage.conversionConfig.trackConversions}
                  onChange={(event) =>
                    patchSelectedPage((page) => ({
                      ...page,
                      conversionConfig: {
                        ...page.conversionConfig,
                        trackConversions: event.target.checked
                      },
                      updatedAt: new Date().toISOString().slice(0, 10)
                    }))
                  }
                />
              </label>
              <input
                value={selectedPage.conversionConfig.strategy}
                onChange={(event) =>
                  patchSelectedPage((page) => ({
                    ...page,
                    conversionConfig: {
                      ...page.conversionConfig,
                      strategy: event.target.value
                    },
                    updatedAt: new Date().toISOString().slice(0, 10)
                  }))
                }
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                placeholder="Strategy"
              />
              <input
                type="number"
                value={selectedPage.conversionConfig.valuePoints}
                onChange={(event) =>
                  patchSelectedPage((page) => ({
                    ...page,
                    conversionConfig: {
                      ...page.conversionConfig,
                      valuePoints: Number(event.target.value) || 0
                    },
                    updatedAt: new Date().toISOString().slice(0, 10)
                  }))
                }
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                placeholder="Conversion value"
              />
            </section>

            <section className="space-y-2 border-t border-white/[0.08] pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Campaign / UTM Strategy</p>
              <input
                value={selectedPage.campaignUtmStrategy.source}
                onChange={(event) =>
                  patchSelectedPage((page) => ({
                    ...page,
                    campaignUtmStrategy: {
                      ...page.campaignUtmStrategy,
                      source: event.target.value
                    },
                    updatedAt: new Date().toISOString().slice(0, 10)
                  }))
                }
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                placeholder="utm_source"
              />
              <input
                value={selectedPage.campaignUtmStrategy.medium}
                onChange={(event) =>
                  patchSelectedPage((page) => ({
                    ...page,
                    campaignUtmStrategy: {
                      ...page.campaignUtmStrategy,
                      medium: event.target.value
                    },
                    updatedAt: new Date().toISOString().slice(0, 10)
                  }))
                }
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                placeholder="utm_medium"
              />
              <input
                value={selectedPage.campaignUtmStrategy.campaign}
                onChange={(event) =>
                  patchSelectedPage((page) => ({
                    ...page,
                    campaignUtmStrategy: {
                      ...page.campaignUtmStrategy,
                      campaign: event.target.value
                    },
                    updatedAt: new Date().toISOString().slice(0, 10)
                  }))
                }
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                placeholder="utm_campaign"
              />
            </section>

            <section className="space-y-2 border-t border-white/[0.08] pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Taxonomy</p>
              <label className="flex items-center justify-between rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-[11px] text-slate-300">
                <span>Taxonomy valid</span>
                <input
                  type="checkbox"
                  checked={selectedPage.taxonomyState.valid}
                  onChange={(event) =>
                    patchSelectedPage((page) => ({
                      ...page,
                      taxonomyState: {
                        ...page.taxonomyState,
                        valid: event.target.checked
                      },
                      updatedAt: new Date().toISOString().slice(0, 10)
                    }))
                  }
                />
              </label>
            </section>

            <section className="space-y-2 border-t border-white/[0.08] pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SEO / Metadata</p>
              <input
                value={selectedPage.seoMetadata.metaTitle}
                onChange={(event) =>
                  patchSelectedPage((page) => ({
                    ...page,
                    seoMetadata: {
                      ...page.seoMetadata,
                      metaTitle: event.target.value
                    },
                    updatedAt: new Date().toISOString().slice(0, 10)
                  }))
                }
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                placeholder="Meta title"
              />
              <textarea
                value={selectedPage.seoMetadata.metaDescription}
                onChange={(event) =>
                  patchSelectedPage((page) => ({
                    ...page,
                    seoMetadata: {
                      ...page.seoMetadata,
                      metaDescription: event.target.value
                    },
                    updatedAt: new Date().toISOString().slice(0, 10)
                  }))
                }
                rows={3}
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
                placeholder="Meta description"
              />
            </section>

            <label className="block border-t border-white/[0.08] pt-2 text-[11px] text-slate-400">
              Theme Selection
              <select
                value={selectedPage.themeKey ?? ""}
                onChange={(event) =>
                  patchSelectedPage((page) => ({
                    ...page,
                    themeKey: event.target.value || undefined,
                    updatedAt: new Date().toISOString().slice(0, 10)
                  }))
                }
                className="mt-1 w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="">Select theme</option>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.themeKey}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block border-t border-white/[0.08] pt-2 text-[11px] text-slate-400">
              Shell Selection
              <select
                value={selectedPage.shellKey ?? ""}
                onChange={(event) =>
                  patchSelectedPage((page) => ({
                    ...page,
                    shellKey: event.target.value || undefined,
                    activeShellId: event.target.value || undefined,
                    updatedAt: new Date().toISOString().slice(0, 10)
                  }))
                }
                className="mt-1 w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="">Select shell</option>
                {shellOptions.map((shell) => (
                  <option key={shell.id} value={shell.key}>
                    {shell.name}
                  </option>
                ))}
              </select>
            </label>

            <section className="space-y-2 border-t border-white/[0.08] pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Readiness</p>
              <p className="text-[11px] text-slate-300">Preview valid: {selectedPage.previewValid ? "yes" : "no"}</p>
              <p className="text-[11px] text-slate-300">Block schema valid: {selectedPage.blockSchemaValid ? "yes" : "no"}</p>
              <p className="text-[11px] text-slate-300">SEO / JSON-LD valid: {selectedPage.seoJsonLdValid ? "yes" : "no"}</p>
              <p className="text-[11px] text-slate-500">Accept the draft preview after each edit to refresh preview and SEO validity.</p>
            </section>

            <section className="space-y-2 border-t border-white/[0.08] pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Governed Full-Page HTML Import</p>
              <textarea
                data-testid="pages-import-html-input"
                value={importHtml}
                onChange={(event) => setImportHtml(event.target.value)}
                rows={5}
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-1.5 font-mono text-[11px] text-slate-200"
                placeholder="Paste full-page HTML to extract blocks"
              />
              <button
                type="button"
                data-testid="pages-import-blocks-only"
                onClick={() => {
                  void runBlocksOnlyImport();
                }}
                disabled={isImporting}
                className="w-full rounded-lg border border-blue-500/30 bg-blue-500/[0.14] px-3 py-2 text-xs font-semibold text-blue-200 disabled:opacity-50"
              >
                {isImporting ? "Importing…" : "Import Full HTML to Blocks"}
              </button>
            </section>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/[0.12] px-3 py-8 text-center text-xs text-slate-500">
            Select a page to inspect governance fields.
          </div>
        )}
      </aside>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4" data-testid="pages-workspace">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Page Composer</h1>
          <p className="mt-1 text-xs text-slate-500">Compose and edit your pages using reusable blocks.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="pages-enter-focus-mode"
            onClick={enterFocusMode}
            className="rounded-lg border border-white/[0.12] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-slate-300"
          >
            Page Focus Mode
          </button>
          <button
            type="button"
            data-testid="pages-enter-fullscreen-mode"
            onClick={enterFullScreenMode}
            className="rounded-lg border border-white/[0.12] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-slate-300"
          >
            Full-screen Focus
          </button>
          <button
            type="button"
            onClick={() => {
              void persistSelectedPage("save");
            }}
            disabled={!selectedPage || isSaving}
            className="rounded-lg border border-white/[0.12] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-slate-300 disabled:opacity-50"
          >
            Save Draft
          </button>
          <div className="mx-1 flex items-center gap-1 rounded-full border border-white/[0.1] bg-white/[0.02] px-2 py-1">
            {themes.slice(0, 5).map((theme) => {
              const selected = previewSwatchThemeId === theme.id || (!previewSwatchThemeId && previewTheme?.id === theme.id);
              return (
                <button
                  key={`header-${theme.id}`}
                  type="button"
                  data-testid={`pages-theme-swatch-${theme.id}`}
                  onClick={() => {
                    const nextId = previewSwatchThemeId === theme.id ? null : theme.id;
                    setPreviewSwatchThemeId(nextId);
                    setPreviewSwatchThemeIdLocal(nextId);
                  }}
                  className={`h-5 w-5 rounded-full border ${selected ? "border-slate-100 ring-2 ring-blue-500/40" : "border-white/20"}`}
                  style={{ background: themeSwatchGradient(theme) }}
                  title={`Preview ${theme.name}`}
                />
              );
            })}
          </div>
          <button
            type="button"
            data-testid="pages-preview-page-button"
            onClick={() => {
              void persistSelectedPage("preview");
            }}
            disabled={!selectedPage || isSaving}
            className="rounded-lg bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Preview Page
          </button>
        </div>
      </header>

      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300">{error}</div> : null}
      {statusMessage ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-300">{statusMessage}</div>
      ) : null}

      <section
        data-testid="pages-standard-root"
        className="min-h-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071226]"
      >
        <div className="grid min-h-[74vh] gap-0 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          <div data-testid="pages-list-container">{renderPageListPanel({ testId: "pages-standard-left-panel" })}</div>
          <div data-testid="pages-detail-container">{renderCanvas({ testId: "pages-standard-canvas", showHeader: true, showSnapshot: true })}</div>
          <div data-testid="pages-action-container" className="border-t border-white/[0.08] lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0">
            {renderInspector({ testId: "pages-standard-inspector" })}
          </div>
        </div>
      </section>

      {focusMode === "page-focus" ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#071226]" data-testid="pages-focus-mode-root">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-3">
            <div>
              <p className="text-base font-bold text-slate-100">Page Composer</p>
              <p className="text-[11px] text-slate-500">Focused editing mode · {selectedPageName}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                data-testid="pages-focus-toggle-panels"
                onClick={() => setShowPanelsInFocus((current) => !current)}
                className="shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
              >
                {showPanelsInFocus ? "Hide Panels" : "Show Panels"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void persistSelectedPage("save");
                }}
                className="shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
              >
                Save Draft
              </button>
              <button
                type="button"
                data-testid="pages-focus-enter-fullscreen"
                onClick={enterFullScreenMode}
                className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Full-screen Focus
              </button>
              <button
                type="button"
                data-testid="pages-exit-focus-mode"
                onClick={() => setFocusMode("default")}
                className="shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
              >
                Exit
              </button>
            </div>
          </header>

          <div className="min-h-0 flex flex-1 overflow-hidden">
            {showPanelsInFocus ? (
              <div className="w-[280px] border-r border-white/[0.08]">{renderPageListPanel({ testId: "pages-focus-left-panel", compact: true })}</div>
            ) : null}
            <div className="min-h-0 flex-1">{renderCanvas({ testId: "pages-focus-canvas", showHeader: true, showSnapshot: false })}</div>
          </div>
        </div>
      ) : null}

      {focusMode === "full-screen" ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#041022]" data-testid="pages-fullscreen-mode-root">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">LMNAs Studio</p>
                <p className="text-[11px] text-slate-500">Page Composer · Full-screen Focus</p>
              </div>
              <button
                type="button"
                data-testid="pages-fullscreen-show-panels"
                onClick={() => {
                  setFocusMode("page-focus");
                  setShowPanelsInFocus(true);
                }}
                className="shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
              >
                Show Panels
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="mx-1 flex items-center gap-1">
                {["white", "blue", "red", "green"].map((tone) => (
                  <span
                    key={`fs-${tone}`}
                    className={`h-5 w-5 rounded-full border ${tone === "white" ? "bg-white" : tone === "blue" ? "bg-blue-500" : tone === "red" ? "bg-red-500" : "bg-green-500"}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  void persistSelectedPage("preview");
                }}
                className="shrink-0 rounded-lg bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white"
              >
                Preview Page
              </button>
              <button
                type="button"
                data-testid="pages-exit-fullscreen-mode"
                onClick={() => setFocusMode("default")}
                className="shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300"
              >
                Exit
              </button>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(#233348_1px,transparent_1px)] [background-size:24px_24px] p-6">
            <div className="mx-auto max-w-[1280px] space-y-4">
              <article className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d1d36]/90">
                <div className="h-[620px] p-2">
                  <iframe
                    data-testid="pages-fullscreen-preview"
                    title="fullscreen-page-preview"
                    className="h-full w-full rounded-lg border border-white/[0.08] bg-white"
                    srcDoc={visiblePreviewHtml}
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              </article>
            </div>
          </main>

          <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/[0.12] bg-[#0f1d36]/95 px-4 py-3">
            <span className="material-symbols-outlined text-slate-300">add</span>
            <span className="material-symbols-outlined text-slate-300">layers</span>
            <span className="material-symbols-outlined text-slate-300">title</span>
            <span className="material-symbols-outlined text-slate-300">image</span>
            <button
              type="button"
              onClick={() => {
                void persistSelectedPage("save");
              }}
              className="pointer-events-auto rounded-lg bg-blue-500 px-3 py-1.5 text-[11px] font-bold text-white"
            >
              Save Draft
            </button>
          </div>

          <div className="absolute bottom-6 right-6 flex items-center gap-1 rounded-xl border border-white/[0.12] bg-[#0f1d36]/95 px-2 py-1">
            <span className="material-symbols-outlined text-slate-400">remove</span>
            <span className="px-2 text-xs font-semibold text-slate-300">100%</span>
            <span className="material-symbols-outlined text-slate-400">add</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
