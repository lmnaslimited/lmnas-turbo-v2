"use client";

import type { OnboardingAnalysis, OnboardingSourceType } from "@lmnas/contracts";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { PreviewPane } from "../_components/PreviewPane";
import { requestClientJson } from "../_lib/client-request";
import {
  buildPlatformBlockPreviewDocument,
  buildPreviewThumbnailDocument,
  ensureHtmlDocument,
  extractBodyHtml,
  usePlatformPreviewAssets
} from "../_lib/platform-preview";
import {
  readPreviewSwatchThemeId,
  setPreviewSwatchThemeId as setGlobalPreviewSwatchThemeId,
  subscribePreviewSwatchThemeId
} from "../_lib/preview-swatch-state";
import type { StudioImportMaster, StudioShell, StudioTheme } from "../_lib/studio-types";

type SourceTab = "stitch" | "url" | "html" | "figma";
type StitchMode = "full_page" | "section";

type AnalyzeResponse = {
  ok: boolean;
  analysis?: OnboardingAnalysis;
  error?: string;
  code?: string;
  persistence?: {
    source: "strapi" | "fallback";
    schemaSource: "canonical" | "legacy" | "fallback";
    proposalsPersisted: number;
    warnings: string[];
    proposalBlocks: Array<{
      proposalId: string;
      blockKey: string;
      schemaStatus: "valid" | "warning" | "invalid";
      status: "draft";
      disposition: "created" | "updated";
      name: string;
      importMasterId: string;
      importMasterKey: string;
      sourcePreviewHtml: string;
      targetPreviewHtml: string;
    }>;
    importMaster?: {
      id: string;
      importKey: string;
      status: "processed" | "imported_blocks" | "imported_page" | "failed";
      selectedThemeKey: string;
      selectedShellKey: string;
      importMode: "blocks" | "page";
      sourceType: OnboardingSourceType;
    };
    upload?: {
      fileName: string;
      htmlEntry: string;
      htmlEntryCount: number;
    };
  };
};

type PreparedStitchUpload = {
  fileName: string;
  sizeBytes: number;
  mimeType?: string;
  dataBase64: string;
  htmlEntryHints: string[];
};

type PersistedProposalMeta = {
  blockKey: string;
  schemaStatus: "valid" | "warning" | "invalid";
  status: "draft";
  disposition: "created" | "updated";
  name: string;
  importMasterId: string;
  importMasterKey: string;
  sourcePreviewHtml: string;
  targetPreviewHtml: string;
};

const ZIP_MAGIC_SIGNATURES = new Set(["PK\u0003\u0004", "PK\u0005\u0006", "PK\u0007\u0008"]);

function resolveSourceType(tab: SourceTab, stitchMode: StitchMode): OnboardingSourceType {
  if (tab === "url") {
    return "url";
  }
  if (tab === "figma") {
    return "figma_full_page";
  }
  if (tab === "stitch") {
    return stitchMode === "section" ? "stitch_section" : "stitch_full_page";
  }
  return "raw_html";
}

function normalizeKey(value: string, fallbackPrefix: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized.length > 0 ? normalized : `${fallbackPrefix}-${Date.now()}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function detectHtmlEntriesFromZip(bytes: Uint8Array): string[] {
  const text = new TextDecoder("latin1").decode(bytes);
  const entries = new Set<string>();
  const htmlPattern = /(?:^|[^A-Za-z0-9_\-.\/])(\/?[\w./-]+\.html?)/gi;
  let match = htmlPattern.exec(text);
  while (match) {
    const candidate = match[1]?.replace(/^\//, "").trim();
    if (candidate && !candidate.includes("\u0000")) {
      entries.add(candidate);
    }
    match = htmlPattern.exec(text);
  }
  return Array.from(entries).slice(0, 8);
}

function deriveSchemaStatus(confidence: number, hasPreview: boolean): "valid" | "warning" | "invalid" {
  if (!hasPreview) {
    return "invalid";
  }
  if (confidence >= 0.75) {
    return "valid";
  }
  if (confidence >= 0.5) {
    return "warning";
  }
  return "invalid";
}

function stripScriptTags(input: string): string {
  return input.replace(/<script[\s\S]*?<\/script>/gi, "");
}

function sanitizePreviewHtml(input: string): string {
  return stripScriptTags(input)
    .replace(/<link[^>]+href=["']https?:\/\/[^"']+["'][^>]*>/gi, "")
    .replace(/\s(?:src|href)=["']https?:\/\/[^"']+["']/gi, "");
}

function readManifestAssetUrl(entry: unknown): string | null {
  if (typeof entry === "string" && entry.trim().length > 0) {
    return entry.trim();
  }
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const candidates = [record.href, record.src, record.url, record.value];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function resolveAssetUrl(asset: string, baseUrl?: string): string {
  const value = asset.trim();
  if (value.length === 0) {
    return "";
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function readManifestAssetList(manifest: unknown, key: "stylesheets" | "scripts", baseUrl?: string): string[] {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return [];
  }
  const raw = (manifest as Record<string, unknown>)[key];
  if (!Array.isArray(raw)) {
    return [];
  }
  return Array.from(
    new Set(
      raw
        .map((entry) => readManifestAssetUrl(entry))
        .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
        .map((entry) => resolveAssetUrl(entry, baseUrl))
        .filter((entry) => entry.length > 0)
    )
  );
}

function buildSourcePreviewWithImportContext(params: {
  previewHtml: string;
  importMaster: StudioImportMaster | null;
}): {
  srcDoc: string;
  missingSourceCss: boolean;
} {
  const documentHtml = ensureHtmlDocument(params.previewHtml);
  const importMasterManifest = params.importMaster?.sourceAssetManifest;
  const baseUrl = params.importMaster?.sourceBaseUrl;

  const existingStylesheetHrefs = Array.from(documentHtml.matchAll(/<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi)).map(
    (match) => resolveAssetUrl(match[1], baseUrl)
  );
  const existingScriptSrcs = Array.from(documentHtml.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi)).map((match) =>
    resolveAssetUrl(match[1], baseUrl)
  );

  const importStylesheets = readManifestAssetList(importMasterManifest, "stylesheets", baseUrl);
  const importScripts = readManifestAssetList(importMasterManifest, "scripts", baseUrl);

  const styleLinksToInject = importStylesheets
    .filter((href) => !existingStylesheetHrefs.includes(href))
    .map((href) => `<link rel="stylesheet" href="${href}"/>`)
    .join("\n");
  const scriptTagsToInject = importScripts
    .filter((src) => !existingScriptSrcs.includes(src))
    .map((src) => `<script src="${src}"><\/script>`)
    .join("\n");
  const baseTagToInject =
    baseUrl && !/<base\s/i.test(documentHtml) ? `<base href="${resolveAssetUrl(baseUrl, baseUrl)}">` : "";

  const headInjection = [baseTagToInject, styleLinksToInject, scriptTagsToInject].filter((entry) => entry.length > 0).join("\n");
  const withImportAssets =
    headInjection.length === 0
      ? documentHtml
      : documentHtml.includes("</head>")
        ? documentHtml.replace("</head>", `${headInjection}\n</head>`)
        : documentHtml.replace("<html>", `<html><head>${headInjection}</head>`);

  const sourceBody = extractBodyHtml(withImportAssets);
  const hasUtilityClasses = /class=["'][^"']*(?:\bbg-|\btext-|\bflex\b|\bgrid\b|\bpx-|\bpy-|\bmd:|\blg:)[^"']*["']/i.test(sourceBody);
  const hasCssContext = existingStylesheetHrefs.length + existingScriptSrcs.length + importStylesheets.length + importScripts.length > 0;
  const missingSourceCss = hasUtilityClasses && !hasCssContext;

  return {
    srcDoc: withImportAssets,
    missingSourceCss
  };
}

function normalizeCssVarName(input: string): string {
  const token = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return token.length > 0 ? `--${token}` : `--theme-token-${Date.now()}`;
}

function buildExtractedThemeTokens(analysis: OnboardingAnalysis): StudioTheme["tokens"] {
  const tokens: StudioTheme["tokens"] = [];
  const colors = analysis.theme.extractedColors ?? {};
  Object.entries(colors).forEach(([key, value]) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return;
    }
    tokens.push({
      key: `color.${key}`,
      label: key,
      category: "color",
      value: value.trim(),
      cssVariable: normalizeCssVarName(`color-${key}`),
      mapped: true
    });
  });

  analysis.theme.extractedFonts.forEach((font, index) => {
    tokens.push({
      key: `typography.font.${index + 1}`,
      label: `Font ${index + 1}`,
      category: "typography",
      value: font,
      cssVariable: normalizeCssVarName(`font-${index + 1}`),
      mapped: true
    });
  });

  if (tokens.length === 0) {
    tokens.push({
      key: "color.primary",
      label: "Primary",
      category: "color",
      value: "#1162d4",
      cssVariable: "--color-primary",
      mapped: true
    });
  }

  return tokens;
}

function resolveProposalTargetPreviewHtml(params: {
  proposalHtml: string;
  persistedMeta: PersistedProposalMeta | null;
  theme: StudioTheme | null;
  hostAssets: ReturnType<typeof usePlatformPreviewAssets>;
}): string {
  return buildPlatformBlockPreviewDocument({
    proposalHtml: params.proposalHtml || params.persistedMeta?.targetPreviewHtml || "<section></section>",
    theme: params.theme,
    hostAssets: params.hostAssets
  });
}

export default function ImportWorkflowPage(): React.ReactElement {
  const platformPreviewAssets = usePlatformPreviewAssets();
  const [themes, setThemes] = useState<StudioTheme[]>([]);
  const [shells, setShells] = useState<StudioShell[]>([]);
  const [sourceTab, setSourceTab] = useState<SourceTab>("stitch");
  const [stitchMode, setStitchMode] = useState<StitchMode>("full_page");
  const [sourceValue, setSourceValue] = useState("");
  const [stitchUpload, setStitchUpload] = useState<PreparedStitchUpload | null>(null);
  const [figmaToken, setFigmaToken] = useState("");
  const [selectedThemeKey, setSelectedThemeKey] = useState("default");
  const [selectedShellKey, setSelectedShellKey] = useState("");
  const [newThemeName, setNewThemeName] = useState("");
  const [newShellName, setNewShellName] = useState("");
  const [importMode, setImportMode] = useState<"page" | "blocks">("blocks");
  const [deepScanning, setDeepScanning] = useState(true);
  const [extractAssets, setExtractAssets] = useState(true);
  const [smartNaming, setSmartNaming] = useState(true);
  const [previewSwatchThemeId, setPreviewSwatchThemeId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null);
  const [selectedBlocks, setSelectedBlocks] = useState<Record<string, boolean>>({});
  const [persistedProposalMeta, setPersistedProposalMeta] = useState<Record<string, PersistedProposalMeta>>({});
  const [proposalNameDrafts, setProposalNameDrafts] = useState<Record<string, string>>({});
  const [importMaster, setImportMaster] = useState<StudioImportMaster | null>(null);
  const [focusedProposalId, setFocusedProposalId] = useState<string | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isCreatingTheme, setIsCreatingTheme] = useState(false);
  const [isCreatingShell, setIsCreatingShell] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRenamingProposal, setIsRenamingProposal] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const blockProposals = analysis?.blockProposals ?? [];
  const selectedCount = useMemo(
    () => blockProposals.filter((block) => selectedBlocks[block.id] !== false).length,
    [blockProposals, selectedBlocks]
  );

  const persistedCount = useMemo(
    () => Object.values(persistedProposalMeta).filter((entry) => entry.status === "draft").length,
    [persistedProposalMeta]
  );

  const focusedProposal = useMemo(
    () => blockProposals.find((block) => block.id === focusedProposalId) ?? blockProposals[0] ?? null,
    [blockProposals, focusedProposalId]
  );

  const focusedProposalMeta = useMemo(
    () => (focusedProposal ? persistedProposalMeta[focusedProposal.id] ?? null : null),
    [focusedProposal, persistedProposalMeta]
  );

  const selectedTheme = useMemo(
    () => themes.find((theme) => theme.themeKey === selectedThemeKey) ?? themes[0] ?? null,
    [themes, selectedThemeKey]
  );

  const compareTheme = useMemo(() => {
    if (!previewSwatchThemeId) {
      return selectedTheme;
    }
    return themes.find((theme) => theme.id === previewSwatchThemeId) ?? selectedTheme;
  }, [previewSwatchThemeId, selectedTheme, themes]);
  const selectedShell = useMemo(
    () => shells.find((shell) => shell.key === selectedShellKey) ?? shells.find((shell) => shell.status === "active") ?? null,
    [shells, selectedShellKey]
  );
  const focusedTargetPreviewHtml = useMemo(() => {
    if (!focusedProposal) {
      return null;
    }

    return resolveProposalTargetPreviewHtml({
      proposalHtml: focusedProposal.previewHtml ?? focusedProposal.rawHtmlSnippet ?? "<section></section>",
      persistedMeta: focusedProposalMeta,
      theme: compareTheme,
      hostAssets: platformPreviewAssets
    });
  }, [compareTheme, focusedProposal, focusedProposalMeta, platformPreviewAssets]);

  const sourceAssetCounts = useMemo(() => {
    const manifest =
      importMaster?.sourceAssetManifest && typeof importMaster.sourceAssetManifest === "object"
        ? importMaster.sourceAssetManifest
        : null;

    const stylesheets = manifest && Array.isArray((manifest as Record<string, unknown>).stylesheets) ? ((manifest as Record<string, unknown>).stylesheets as unknown[]).length : 0;
    const scripts = manifest && Array.isArray((manifest as Record<string, unknown>).scripts) ? ((manifest as Record<string, unknown>).scripts as unknown[]).length : 0;
    const media = manifest && Array.isArray((manifest as Record<string, unknown>).media) ? ((manifest as Record<string, unknown>).media as unknown[]).length : 0;

    return { stylesheets, scripts, media };
  }, [importMaster?.sourceAssetManifest]);

  const sourceComparisonPreview = useMemo(() => {
    const fallbackHtml = importMaster?.referencePreviewHtml || analysis?.source.referencePreviewHtml || "<section></section>";
    const focusedFallbackHtml =
      focusedProposal?.rawHtmlSnippet || focusedProposal?.previewHtml || "<section></section>";
    const rawSourceHtml = focusedProposalMeta?.sourcePreviewHtml || focusedFallbackHtml || fallbackHtml;
    const matchesFocusedImportMaster =
      !focusedProposalMeta ||
      !importMaster ||
      focusedProposalMeta.importMasterId === importMaster.id ||
      focusedProposalMeta.importMasterKey === importMaster.importKey;

    const scopedImportMaster = matchesFocusedImportMaster ? importMaster : null;
    return buildSourcePreviewWithImportContext({
      previewHtml: rawSourceHtml,
      importMaster: scopedImportMaster
    });
  }, [analysis?.source.referencePreviewHtml, focusedProposal, focusedProposalMeta, importMaster]);

  useEffect(() => {
    void (async () => {
      setIsLoadingContext(true);
      setError(null);
      try {
        const [themesPayload, shellsPayload] = await Promise.all([
          requestClientJson<{ ok: boolean; data?: StudioTheme[]; error?: string }>(
            "/api/platform/studio/themes",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading themes timed out. Please retry.",
              fallbackErrorMessage: "Unable to load theme presets."
            }
          ),
          requestClientJson<{ ok: boolean; data?: StudioShell[]; error?: string }>(
            "/api/platform/studio/shells",
            {
              method: "GET",
              headers: { "content-type": "application/json" }
            },
            {
              timeoutMessage: "Loading shells timed out. Please retry.",
              fallbackErrorMessage: "Unable to load shell presets."
            }
          )
        ]);

        if (!themesPayload.ok || !Array.isArray(themesPayload.data)) {
          throw new Error(themesPayload.error ?? "Unable to load theme presets.");
        }
        if (!shellsPayload.ok || !Array.isArray(shellsPayload.data)) {
          throw new Error(shellsPayload.error ?? "Unable to load shell presets.");
        }

        const loadedThemes = themesPayload.data;
        const loadedShells = shellsPayload.data;
        setThemes(loadedThemes);
        setShells(loadedShells);

        const activeTheme = loadedThemes.find((theme) => theme.status === "active") ?? loadedThemes[0] ?? null;
        const swatchThemeId = readPreviewSwatchThemeId();
        const swatchTheme = loadedThemes.find((theme) => theme.id === swatchThemeId) ?? null;
        const activeShell = loadedShells.find((shell) => shell.status === "active") ?? loadedShells[0] ?? null;
        if (swatchTheme ?? activeTheme) {
          const initialTheme = swatchTheme ?? activeTheme;
          setSelectedThemeKey(initialTheme?.themeKey ?? "default");
          setPreviewSwatchThemeId(swatchTheme?.id ?? null);
        }
        if (activeShell) {
          setSelectedShellKey(activeShell.key);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        setIsLoadingContext(false);
      }
    })();
  }, []);

  useEffect(() => {
    setGlobalPreviewSwatchThemeId(previewSwatchThemeId);
  }, [previewSwatchThemeId]);

  useEffect(() => {
    return subscribePreviewSwatchThemeId((themeId) => {
      setPreviewSwatchThemeId(themeId);
    });
  }, []);

  async function validateAndPrepareStitchZip(file: File): Promise<PreparedStitchUpload> {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      throw new Error("Only .zip files are supported for Stitch upload.");
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.byteLength === 0) {
      throw new Error("Uploaded ZIP is empty.");
    }

    const signature = String.fromCharCode(...bytes.slice(0, 4));
    if (!ZIP_MAGIC_SIGNATURES.has(signature)) {
      throw new Error("Invalid ZIP signature. Upload a valid Stitch ZIP export.");
    }

    const htmlEntryHints = detectHtmlEntriesFromZip(bytes);
    if (htmlEntryHints.length === 0) {
      throw new Error("ZIP does not appear to contain any HTML entries. Export Stitch source with HTML.");
    }

    return {
      fileName: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
      dataBase64: bytesToBase64(bytes),
      htmlEntryHints
    };
  }

  async function handleStitchUpload(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    setError(null);
    setStatusMessage(null);
    try {
      const prepared = await validateAndPrepareStitchZip(file);
      setStitchUpload(prepared);
      setStatusMessage(`Stitch ZIP ready: ${prepared.fileName} (${prepared.htmlEntryHints.length} HTML hint(s) found).`);
    } catch (uploadError) {
      setStitchUpload(null);
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      event.target.value = "";
    }
  }

  async function loadImportMasterByKey(importKey: string): Promise<StudioImportMaster | null> {
    const payload = await requestClientJson<{
      ok: boolean;
      data?: StudioImportMaster[];
      source?: "strapi" | "fallback";
      schemaSource?: "canonical" | "legacy" | "fallback";
      error?: string;
    }>(
      `/api/platform/studio/import/masters?importKey=${encodeURIComponent(importKey)}`,
      {
        method: "GET",
        headers: { "content-type": "application/json" }
      },
      {
        timeoutMessage: "Loading import master timed out. Please retry.",
        fallbackErrorMessage: "Unable to load import master."
      }
    );

    if (!payload.ok || !Array.isArray(payload.data)) {
      throw new Error(payload.error ?? "Unable to load import master.");
    }
    if (payload.source !== "strapi" || payload.schemaSource !== "canonical") {
      throw new Error("Import master requires canonical studio-import-masters from Strapi.");
    }
    return payload.data[0] ?? null;
  }

  async function applyThemePreset(themeKey: string): Promise<void> {
    const theme = themes.find((entry) => entry.themeKey === themeKey);
    if (!theme) {
      throw new Error(`Theme preset ${themeKey} not found.`);
    }

    const payload = await requestClientJson<{ ok: boolean; data?: StudioTheme[]; error?: string }>(
      "/api/platform/studio/themes",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "upsert",
          sourceType: "html_upload",
          theme: {
            ...theme,
            status: "active"
          }
        })
      },
      {
        timeoutMessage: "Applying theme timed out. Please retry.",
        fallbackErrorMessage: "Unable to apply theme preset."
      }
    );

    if (!payload.ok || !Array.isArray(payload.data)) {
      throw new Error(payload.error ?? "Unable to apply theme preset.");
    }

    setThemes(payload.data);
    setSelectedThemeKey(themeKey);
    const active = payload.data.find((entry) => entry.status === "active" && entry.themeKey === themeKey) ?? payload.data.find((entry) => entry.themeKey === themeKey);
    setPreviewSwatchThemeId(active?.id ?? null);
  }

  async function createThemePreset(options?: {
    fromExtraction?: boolean;
  }): Promise<void> {
    const fromExtraction = options?.fromExtraction === true;
    const analysisTheme = analysis?.theme;
    const defaultName = analysis?.source.title ? `${analysis.source.title} Imported Theme` : "Imported Theme";
    const baseName = fromExtraction ? newThemeName.trim() || defaultName : newThemeName.trim();

    if (!baseName) {
      setError("Provide a theme preset name to create.");
      return;
    }

    setIsCreatingTheme(true);
    setError(null);
    setStatusMessage(null);

    try {
      const keyBase = normalizeKey(baseName, "theme");
      const key = fromExtraction ? `${keyBase}-${Date.now().toString().slice(-5)}` : keyBase;
      const sourceType = sourceTab === "stitch" ? "stitch_export" : sourceTab === "figma" ? "figma_export" : sourceTab === "url" ? "url" : "html_upload";
      const sourceRef =
        sourceTab === "stitch"
          ? stitchUpload?.fileName ?? "stitch-upload"
          : sourceTab === "url"
            ? sourceValue.trim() || "url"
            : analysis?.source.sourceRef || sourceTab;
      const extractedTokens =
        fromExtraction && analysisTheme
          ? buildExtractedThemeTokens(analysis)
          : [];

      const payload = await requestClientJson<{ ok: boolean; data?: StudioTheme[]; error?: string }>(
        "/api/platform/studio/themes",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "create",
            sourceType,
            theme: {
              id: `theme-${Date.now()}`,
              themeKey: key,
              name: baseName,
              status: fromExtraction ? "active" : "draft",
              sourceRef,
              tokenCoverage: fromExtraction && analysisTheme ? Number(analysisTheme.tokenFirstMatchRatio.toFixed(2)) : 0,
              themeDebt: fromExtraction && analysisTheme ? analysisTheme.themeDebtSummary : "",
              darkMode: fromExtraction && analysisTheme ? analysisTheme.hasDarkModeTrigger : true,
              tokens: extractedTokens
            }
          })
        },
        {
          timeoutMessage: "Creating theme timed out. Please retry.",
          fallbackErrorMessage: "Unable to create theme preset."
        }
      );

      if (!payload.ok || !Array.isArray(payload.data)) {
        throw new Error(payload.error ?? "Unable to create theme preset.");
      }

      setThemes(payload.data);
      setSelectedThemeKey(key);
      const created = payload.data.find((theme) => theme.themeKey === key);
      setPreviewSwatchThemeId(created?.id ?? null);
      setNewThemeName("");
      setStatusMessage(
        fromExtraction
          ? `Created and applied extracted Theme Preset: ${baseName} (${key}) with ${extractedTokens.length} token(s).`
          : `Created and selected Theme Preset: ${baseName} (${key}).`
      );
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setIsCreatingTheme(false);
    }
  }

  async function createShellPreset(): Promise<void> {
    const name = newShellName.trim();
    if (!name) {
      setError("Provide a shell preset name to create.");
      return;
    }

    setIsCreatingShell(true);
    setError(null);
    setStatusMessage(null);

    try {
      const key = normalizeKey(name, "shell");
      const payload = await requestClientJson<{ ok: boolean; data?: StudioShell[]; error?: string }>(
        "/api/platform/studio/shells",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            shell: {
              id: `shell-${Date.now()}`,
              key,
              name,
              role: "full",
              status: "inactive",
              updatedAt: new Date().toISOString().slice(0, 10),
              menuItems: [],
              actions: [],
              navbarBlocks: [],
              footerBlocks: [],
              previewHtml: "<div>No shell preview configured yet.</div>"
            }
          })
        },
        {
          timeoutMessage: "Creating shell timed out. Please retry.",
          fallbackErrorMessage: "Unable to create shell preset."
        }
      );

      if (!payload.ok || !Array.isArray(payload.data)) {
        throw new Error(payload.error ?? "Unable to create shell preset.");
      }

      setShells(payload.data);
      setSelectedShellKey(key);
      setNewShellName("");
      setStatusMessage(`Created and selected Shell Preset: ${name} (${key}).`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setIsCreatingShell(false);
    }
  }

  async function persistProposalName(proposalId: string, nextNameRaw: string): Promise<void> {
    if (!analysis) {
      return;
    }

    const meta = persistedProposalMeta[proposalId];
    if (!meta?.blockKey) {
      return;
    }

    const block = analysis.blockProposals.find((entry) => entry.id === proposalId);
    if (!block) {
      return;
    }

    const nextName = nextNameRaw.trim();
    if (nextName.length === 0 || nextName === meta.name) {
      return;
    }

    setIsRenamingProposal(proposalId);
    setError(null);
    try {
      const payload = await requestClientJson<{ ok: boolean; source?: "strapi" | "fallback"; schemaSource?: "canonical" | "legacy" | "fallback"; error?: string }>(
        "/api/platform/studio/blocks",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            block: {
              id: meta.blockKey,
              key: meta.blockKey,
              name: nextName,
              family: block.family,
              status: "draft",
              lifecycle: "draft",
              scope: "global",
              schemaStatus: meta.schemaStatus,
              themeKey: selectedThemeKey,
              sourceType: analysis.intake.sourceType,
              sourceRef: analysis.source.sourceRef,
              importMasterId: meta.importMasterId,
              importMasterKey: meta.importMasterKey,
              importProposalId: proposalId,
              sourcePreviewHtml: meta.sourcePreviewHtml,
              targetPreviewHtml: meta.targetPreviewHtml,
              previewHtml: meta.targetPreviewHtml || block.previewHtml || block.rawHtmlSnippet || "<section></section>",
              confidence: block.confidence,
              editableFields: block.editableFields,
              actions: [],
              inUseCount: 0,
              usageCount: 0,
              createdAt: new Date().toISOString().slice(0, 10),
              updatedAt: new Date().toISOString().slice(0, 10)
            }
          })
        },
        {
          timeoutMessage: "Persisting proposal rename timed out. Please retry.",
          fallbackErrorMessage: "Unable to persist proposal rename."
        }
      );

      if (!payload.ok) {
        throw new Error(payload.error ?? "Unable to persist proposal rename.");
      }

      setPersistedProposalMeta((current) => ({
        ...current,
        [proposalId]: {
          ...current[proposalId],
          name: nextName
        }
      }));
      setStatusMessage(`Renamed proposal to ${nextName}.`);
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : String(renameError));
    } finally {
      setIsRenamingProposal((current) => (current === proposalId ? null : current));
    }
  }

  async function processSource(): Promise<void> {
    if (sourceTab === "stitch") {
      if (sourceValue.trim().length === 0 && !stitchUpload) {
        setError("Upload a Stitch ZIP or paste Stitch HTML before processing.");
        return;
      }
    } else if (sourceValue.trim().length === 0) {
      setError("Provide source input before processing.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStatusMessage(null);
    setImportMaster(null);

    try {
      const payload = await requestClientJson<AnalyzeResponse>(
        "/api/platform/studio/import/process",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceType: resolveSourceType(sourceTab, stitchMode),
            sourceValue,
            stitchZipUpload: sourceTab === "stitch" && stitchUpload
              ? {
                  fileName: stitchUpload.fileName,
                  dataBase64: stitchUpload.dataBase64,
                  sizeBytes: stitchUpload.sizeBytes,
                  mimeType: stitchUpload.mimeType
                }
              : undefined,
            slug: "import-source",
            locale: "en",
            themeKey: selectedThemeKey,
            shellKey: selectedShellKey,
            importMode,
            extractionSettings: {
              deepScanning,
              extractAssets,
              smartNaming,
              figmaToken: sourceTab === "figma" ? figmaToken : undefined
            }
          })
        },
        {
          timeoutMs: 120_000,
          timeoutMessage: "Import analysis timed out. Please retry.",
          fallbackErrorMessage: "Unable to analyze source import."
        }
      );

      if (!payload.ok || !payload.analysis) {
        throw new Error(payload.error ?? "Unable to analyze source import.");
      }

      setAnalysis(payload.analysis);
      if (payload.persistence?.importMaster?.importKey) {
        let hydratedImportMaster: StudioImportMaster | null = null;
        try {
          hydratedImportMaster = await loadImportMasterByKey(payload.persistence.importMaster.importKey);
        } catch {
          hydratedImportMaster = null;
        }
        setImportMaster(
          hydratedImportMaster ??
            ({
              id: payload.persistence.importMaster.id,
              importKey: payload.persistence.importMaster.importKey,
              sourceType: payload.persistence.importMaster.sourceType,
              sourceRef: payload.analysis.source.sourceRef,
              referencePreviewHtml: payload.analysis.source.referencePreviewHtml,
              targetPreviewHtml: payload.analysis.source.productionPreviewHtml,
              selectedThemeKey: payload.persistence.importMaster.selectedThemeKey,
              selectedShellKey: payload.persistence.importMaster.selectedShellKey,
              importMode: payload.persistence.importMaster.importMode,
              status: payload.persistence.importMaster.status,
              lifecycle: "draft",
              createdAt: new Date().toISOString().slice(0, 10),
              updatedAt: new Date().toISOString().slice(0, 10)
            } as StudioImportMaster)
        );
        setSelectedThemeKey(payload.persistence.importMaster.selectedThemeKey || selectedThemeKey);
        setSelectedShellKey(payload.persistence.importMaster.selectedShellKey || selectedShellKey);
      } else {
        setImportMaster(null);
      }
      const nextSelection: Record<string, boolean> = {};
      const nextNameDrafts: Record<string, string> = {};
      payload.analysis.blockProposals.forEach((block) => {
        nextSelection[block.id] = true;
        nextNameDrafts[block.id] = block.displayName ?? block.family;
      });
      setSelectedBlocks(nextSelection);
      setProposalNameDrafts(nextNameDrafts);
      setFocusedProposalId(payload.analysis.blockProposals[0]?.id ?? null);

      const nextMeta: Record<string, PersistedProposalMeta> = {};
      payload.persistence?.proposalBlocks.forEach((entry) => {
        nextMeta[entry.proposalId] = {
          blockKey: entry.blockKey,
          schemaStatus: entry.schemaStatus,
          status: entry.status,
          disposition: entry.disposition,
          name: entry.name,
          importMasterId: entry.importMasterId,
          importMasterKey: entry.importMasterKey,
          sourcePreviewHtml: entry.sourcePreviewHtml,
          targetPreviewHtml: entry.targetPreviewHtml
        };
      });
      setPersistedProposalMeta(nextMeta);

      const createdDraftBlocks = payload.persistence?.proposalBlocks.filter((entry) => entry.disposition === "created").length ?? 0;
      const updatedDraftBlocks = payload.persistence?.proposalBlocks.filter((entry) => entry.disposition === "updated").length ?? 0;

      const warningMessage = payload.persistence?.warnings.length
        ? ` Warnings: ${payload.persistence.warnings.join(" ")}`
        : "";

      const uploadMessage = payload.persistence?.upload
        ? ` ZIP ${payload.persistence.upload.fileName} → ${payload.persistence.upload.htmlEntry}`
        : "";

      setStatusMessage(
        `Detected ${payload.analysis.blockProposals.length} block candidate(s). ${
          updatedDraftBlocks > 0 && createdDraftBlocks === 0
            ? `Updated ${updatedDraftBlocks} existing draft canonical block(s).`
            : updatedDraftBlocks > 0
              ? `Created ${createdDraftBlocks} and updated ${updatedDraftBlocks} draft canonical block(s).`
              : `Created ${createdDraftBlocks || payload.persistence?.proposalsPersisted || 0} draft canonical block(s).`
        }${payload.persistence?.importMaster ? ` Import master: ${payload.persistence.importMaster.importKey}.` : ""}${uploadMessage}${warningMessage}`
      );
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : String(analyzeError));
    } finally {
      setIsProcessing(false);
    }
  }

  async function importSelectedAsGovernedBlocks(): Promise<void> {
    if (!analysis) {
      setError("Run source processing before importing blocks.");
      return;
    }

    setIsImporting(true);
    setError(null);
    setStatusMessage(null);

    try {
      const resolvedImportMasterId =
        importMaster?.id ??
        Object.values(persistedProposalMeta).find((entry) => entry.importMasterId.trim().length > 0)?.importMasterId;
      const resolvedImportMasterKey =
        importMaster?.importKey ??
        Object.values(persistedProposalMeta).find((entry) => entry.importMasterKey.trim().length > 0)?.importMasterKey;

      const mapToExisting: Record<string, string> = {};
      const displayNameOverrides: Record<string, string> = {};
      Object.entries(persistedProposalMeta).forEach(([proposalId, meta]) => {
        mapToExisting[proposalId] = meta.blockKey;
        const draftName = (proposalNameDrafts[proposalId] ?? meta.name).trim();
        if (draftName.length > 0) {
          displayNameOverrides[proposalId] = draftName;
        }
      });

      const payload = await requestClientJson<{
        ok: boolean;
        result?: {
          applied: boolean;
          summary: { blocksToCreate: number };
          warnings: Array<{ message: string; severity: string }>;
        };
        matchedBlocks?: Array<{
          proposalId: string;
          disposition: "created" | "updated";
          matchedBlockKey: string;
          matchedBlockId: string | null;
          nameChanged: boolean;
          previewChanged: boolean;
          publishedContentChanged: boolean;
        }>;
        error?: string;
      }>(
        "/api/platform/studio/blocks/publish",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            analysis,
            mode: "apply",
            importMasterId: resolvedImportMasterId,
            importMasterKey: resolvedImportMasterKey,
            overrides: {
              displayNameOverrides,
              itemImportState: selectedBlocks,
              mapToExisting
            }
          })
        },
        {
          timeoutMessage: "Governed block import timed out. Please retry.",
          fallbackErrorMessage: "Unable to import governed blocks."
        }
      );

      if (!payload.ok || !payload.result) {
        throw new Error(payload.error ?? "Unable to import governed blocks.");
      }
      if (!payload.result.applied) {
        const firstWarning = payload.result.warnings[0]?.message ?? "Canonical block import did not apply.";
        throw new Error(firstWarning);
      }

      const selectedProposalIds = analysis.blockProposals.filter((block) => selectedBlocks[block.id] !== false).map((block) => block.id);
      const createdCount = selectedProposalIds.filter((proposalId) => persistedProposalMeta[proposalId]?.disposition === "created").length;
      const updatedCount = selectedProposalIds.filter((proposalId) => persistedProposalMeta[proposalId]?.disposition === "updated").length;
      const updatedMatchDetails = (payload.matchedBlocks ?? [])
        .filter((entry) => entry.disposition === "updated")
        .map((entry) => {
          const matchedId = entry.matchedBlockId ? ` / ${entry.matchedBlockId}` : "";
          const nameState = entry.nameChanged ? "renamed" : "name unchanged";
          const previewState = entry.previewChanged ? "preview changed" : "preview unchanged";
          const publishedState = entry.publishedContentChanged ? "published content changed" : "published content unchanged";
          return `${entry.matchedBlockKey}${matchedId} ${nameState}, ${previewState}, ${publishedState}`;
        });

      let pageImportMessage = "";
      if (importMode === "page") {
        const selectedBlockKeys = analysis.blockProposals
          .filter((block) => selectedBlocks[block.id] !== false)
          .map((block) => persistedProposalMeta[block.id]?.blockKey ?? block.id)
          .filter((value, index, arr) => value.trim().length > 0 && arr.indexOf(value) === index);

        const pageSeed = Date.now();
        const pageId = `import-page-${pageSeed}`;
        const pageSlug = `import-${pageSeed}`;

        const pageSavePayload = await requestClientJson<{
          ok: boolean;
          data?: {
            page?: { id: string; slug: string };
          };
          error?: string;
        }>(
          "/api/platform/studio/pages",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              mode: "save",
              page: {
                id: pageId,
                name: analysis.source.title ?? "Imported Source Page",
                slug: pageSlug,
                locale: "en",
                activeShellId: selectedShellKey || undefined,
                shellKey: selectedShellKey || undefined,
                themeKey: selectedThemeKey || undefined,
                importMasterId: resolvedImportMasterId,
                lifecycle: "draft",
                status: "draft",
                blockOrder: selectedBlockKeys,
                fieldValues: {
                  sourceType: analysis.intake.sourceType,
                  sourceRef: analysis.source.sourceRef,
                  targetThemeKey: selectedThemeKey
                },
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
                blockSchemaValid: selectedBlockKeys.length > 0,
                previewValid: Boolean(analysis.source.productionPreviewHtml),
                previewHtml: analysis.source.productionPreviewHtml,
                updatedAt: new Date().toISOString().slice(0, 10)
              }
            })
          },
          {
            timeoutMessage: "Creating imported page timed out. Please retry.",
            fallbackErrorMessage: "Unable to create imported page."
          }
        );

        if (!pageSavePayload.ok || !pageSavePayload.data?.page) {
          throw new Error(pageSavePayload.error ?? "Unable to create imported page.");
        }

        pageImportMessage = ` Draft page created: ${pageSavePayload.data.page.slug}.`;
      }

      const warningCount = payload.result.warnings.length;
      const matchDetailMessage =
        updatedMatchDetails.length > 0 ? ` Match: ${updatedMatchDetails.slice(0, 3).join("; ")}.` : "";
      setStatusMessage(
        payload.result.applied
          ? updatedCount > 0 && createdCount === 0
            ? `Updated ${updatedCount} existing governed block(s).${matchDetailMessage} Warnings: ${warningCount}.${pageImportMessage}`
            : updatedCount > 0
              ? `Imported ${createdCount} new governed block(s) and updated ${updatedCount} existing block(s).${matchDetailMessage} Warnings: ${warningCount}.${pageImportMessage}`
              : `Imported ${createdCount || selectedCount} governed block(s). Warnings: ${warningCount}.${pageImportMessage}`
          : `Import completed with no apply. Warnings: ${warningCount}.${pageImportMessage}`
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setIsImporting(false);
    }
  }

  function toggleAll(nextValue: boolean): void {
    const next: Record<string, boolean> = {};
    blockProposals.forEach((block) => {
      next[block.id] = nextValue;
    });
    setSelectedBlocks(next);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1420px] flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Import Content</h1>
          <p className="mt-1 text-xs text-slate-500">
            Import from Stitch ZIP, URL, HTML, or Figma to detect, compare, and persist governed canonical blocks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/[0.12] px-3 py-1 text-[11px] font-semibold text-emerald-300">
            Ready to process
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-2 py-1">
            {themes.slice(0, 4).map((theme) => {
              const activeSwatch = previewSwatchThemeId === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setPreviewSwatchThemeId(activeSwatch ? null : theme.id)}
                  className={`h-5 w-5 rounded-full border ${
                    activeSwatch ? "border-blue-300 ring-2 ring-blue-500/40" : "border-white/25"
                  }`}
                  style={{ backgroundColor: theme.darkMode ? "#1162d4" : "#64748b" }}
                  title={`Preview swatch: ${theme.name}`}
                />
              );
            })}
          </div>
          <button
            data-testid="import-process-source"
            type="button"
            onClick={() => {
              void processSource();
            }}
            disabled={isProcessing || isLoadingContext}
            className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {isProcessing ? "Processing…" : "Process Source"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-2">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      ) : null}
      {statusMessage ? (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2">
          <p className="text-xs text-emerald-300">{statusMessage}</p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
              {([
                ["stitch", "Stitch"],
                ["url", "URL"],
                ["html", "HTML"],
                ["figma", "Figma"]
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  data-testid={`import-source-tab-${key}`}
                  type="button"
                  onClick={() => setSourceTab(key)}
                  className={`flex-1 rounded px-2 py-1.5 text-[11px] font-semibold ${
                    sourceTab === key ? "bg-blue-500/20 text-blue-200" : "text-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {sourceTab === "stitch" ? (
                <>
                  <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
                    <button
                      type="button"
                      onClick={() => setStitchMode("full_page")}
                      className={`flex-1 rounded px-2 py-1 text-[10px] font-semibold ${
                        stitchMode === "full_page" ? "bg-blue-500/20 text-blue-200" : "text-slate-500"
                      }`}
                    >
                      Stitch Full Page
                    </button>
                    <button
                      type="button"
                      onClick={() => setStitchMode("section")}
                      className={`flex-1 rounded px-2 py-1 text-[10px] font-semibold ${
                        stitchMode === "section" ? "bg-blue-500/20 text-blue-200" : "text-slate-500"
                      }`}
                    >
                      Stitch Section
                    </button>
                  </div>

                  <label className="block rounded-lg border border-dashed border-white/[0.14] bg-white/[0.02] px-3 py-3 text-[11px] text-slate-300 hover:border-blue-400/40">
                    <span className="font-semibold text-slate-200">Upload Stitch ZIP</span>
                    <p className="mt-1 text-[10px] text-slate-500">Required utility. Accepts `.zip` with HTML entries.</p>
                    <input
                      data-testid="import-stitch-zip-input"
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed"
                      className="mt-2 block w-full cursor-pointer rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px]"
                      onChange={(event) => {
                        void handleStitchUpload(event);
                      }}
                    />
                  </label>

                  {stitchUpload ? (
                    <div className="rounded-lg border border-blue-500/30 bg-blue-500/[0.08] px-3 py-2 text-[11px]">
                      <p className="font-semibold text-blue-200">{stitchUpload.fileName}</p>
                      <p className="text-blue-300/80">{Math.round(stitchUpload.sizeBytes / 1024)} KB · HTML hints: {stitchUpload.htmlEntryHints.join(", ")}</p>
                    </div>
                  ) : null}

                  <textarea
                    className="min-h-[120px] w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-[11px] text-slate-100"
                    placeholder="Optional: paste Stitch HTML directly"
                    value={sourceValue}
                    onChange={(event) => setSourceValue(event.target.value)}
                  />
                </>
              ) : sourceTab === "figma" ? (
                <>
                  <input
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-100"
                    placeholder="https://figma.com/file/..."
                    value={sourceValue}
                    onChange={(event) => setSourceValue(event.target.value)}
                  />
                  <input
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-100"
                    type="password"
                    placeholder="Personal access token"
                    value={figmaToken}
                    onChange={(event) => setFigmaToken(event.target.value)}
                  />
                </>
              ) : sourceTab === "url" ? (
                <input
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-100"
                  placeholder="https://example.com/landing"
                  value={sourceValue}
                  onChange={(event) => setSourceValue(event.target.value)}
                />
              ) : (
                <textarea
                  data-testid="import-source-input"
                  className="min-h-[180px] w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-[11px] text-slate-100"
                  placeholder="<section>...</section>"
                  value={sourceValue}
                  onChange={(event) => setSourceValue(event.target.value)}
                />
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="text-xs font-semibold text-slate-300">Extraction Settings</p>
            <div className="mt-2 grid gap-2">
              <label className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-[11px] text-slate-300">
                <span>Deep scanning</span>
                <input type="checkbox" checked={deepScanning} onChange={(event) => setDeepScanning(event.target.checked)} />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-[11px] text-slate-300">
                <span>Extract assets</span>
                <input type="checkbox" checked={extractAssets} onChange={(event) => setExtractAssets(event.target.checked)} />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-[11px] text-slate-300">
                <span>Smart naming</span>
                <input type="checkbox" checked={smartNaming} onChange={(event) => setSmartNaming(event.target.checked)} />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="text-xs font-semibold text-slate-300">Step 1 · Theme &amp; Shell Identification</p>
            <div className="mt-2 grid gap-2">
              <label className="text-[11px] text-slate-400">
                Target Theme
                <select
                  className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-100"
                  value={selectedThemeKey}
                  onChange={(event) => {
                    const nextThemeKey = event.target.value;
                    setSelectedThemeKey(nextThemeKey);
                    const matchedTheme = themes.find((theme) => theme.themeKey === nextThemeKey);
                    setPreviewSwatchThemeId(matchedTheme?.id ?? null);
                  }}
                >
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.themeKey}>
                      {theme.name} ({theme.themeKey}) {theme.status === "active" ? "• active" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    void applyThemePreset(selectedThemeKey);
                  }}
                  disabled={isCreatingTheme || !selectedTheme}
                  className="rounded-lg border border-blue-500/30 bg-blue-500/[0.12] px-2 py-1 text-[11px] font-semibold text-blue-200 disabled:opacity-40"
                >
                  Apply Selected Theme
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-100"
                  placeholder="Create theme preset"
                  value={newThemeName}
                  onChange={(event) => setNewThemeName(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => {
                    void createThemePreset();
                  }}
                  disabled={isCreatingTheme}
                  className="rounded-lg border border-blue-500/30 bg-blue-500/[0.12] px-2 py-1 text-[11px] font-semibold text-blue-200 disabled:opacity-40"
                >
                  {isCreatingTheme ? "Creating…" : "Create"}
                </button>
              </div>

              {analysis ? (
                <div data-testid="import-extracted-theme-summary" className="rounded-lg border border-white/[0.1] bg-white/[0.02] p-2">
                  <p className="text-[11px] font-semibold text-slate-200">Extracted Source Theme</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Match ratio {Math.round(analysis.theme.tokenFirstMatchRatio * 100)}% · Arbitrary values {analysis.theme.arbitraryValueCount}
                  </p>
                  <p className="text-[10px] text-slate-500">{analysis.theme.themeDebtSummary}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Colors: {Object.keys(analysis.theme.extractedColors ?? {}).join(", ") || "none"} · Fonts:{" "}
                    {analysis.theme.extractedFonts.join(", ") || "none"}
                  </p>
                  <div className="mt-2 flex justify-end">
                    <button
                      data-testid="import-create-theme-from-extraction"
                      type="button"
                      onClick={() => {
                        void createThemePreset({ fromExtraction: true });
                      }}
                      disabled={isCreatingTheme}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.12] px-2 py-1 text-[11px] font-semibold text-emerald-200 disabled:opacity-40"
                    >
                      {isCreatingTheme ? "Creating…" : "Create + Apply Extracted Theme"}
                    </button>
                  </div>
                </div>
              ) : null}

              <label className="text-[11px] text-slate-400">
                Target Shell
                <select
                  className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-100"
                  value={selectedShellKey}
                  onChange={(event) => setSelectedShellKey(event.target.value)}
                >
                  {shells.map((shell) => (
                    <option key={shell.id} value={shell.key}>
                      {shell.name} ({shell.role})
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-slate-100"
                  placeholder="Create shell preset"
                  value={newShellName}
                  onChange={(event) => setNewShellName(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => {
                    void createShellPreset();
                  }}
                  disabled={isCreatingShell}
                  className="rounded-lg border border-blue-500/30 bg-blue-500/[0.12] px-2 py-1 text-[11px] font-semibold text-blue-200 disabled:opacity-40"
                >
                  {isCreatingShell ? "Creating…" : "Create"}
                </button>
              </div>

              <div>
                <p className="text-[11px] text-slate-400">Import Mode</p>
                <div className="mt-1 flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
                  <button
                    data-testid="import-mode-page"
                    type="button"
                    onClick={() => setImportMode("page")}
                    className={`flex-1 rounded px-2 py-1 text-[11px] ${importMode === "page" ? "bg-white/[0.08] text-slate-200" : "text-slate-500"}`}
                  >
                    As Page
                  </button>
                  <button
                    data-testid="import-mode-blocks"
                    type="button"
                    onClick={() => setImportMode("blocks")}
                    className={`flex-1 rounded px-2 py-1 text-[11px] ${importMode === "blocks" ? "bg-blue-500/20 text-blue-200" : "text-slate-500"}`}
                  >
                    As Blocks
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-2">
              <p className="text-[11px] text-slate-500">Need richer preset controls before import?</p>
              <Link href="/platform/onboarding/theme" className="text-[11px] font-semibold text-blue-300 hover:text-blue-200">
                Open Theme &amp; Shell Studio
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-3">
            <p className="text-xs font-semibold text-blue-200">Import Summary</p>
            <div className="mt-2 space-y-1 text-[11px] text-slate-300">
              <p>Blocks detected: {blockProposals.length}</p>
              <p>Accepted: {selectedCount}</p>
              <p>Draft canonical blocks persisted: {persistedCount}</p>
              <p>Blocking: {Math.max(0, blockProposals.length - selectedCount)}</p>
              <p>Readiness: {selectedCount > 0 && persistedCount >= selectedCount ? "ready" : "incomplete"}</p>
              <p>Target theme: {selectedThemeKey || "n/a"}</p>
              <p>Target shell: {selectedShellKey || "n/a"}</p>
              <p>Import mode: {importMode === "page" ? "As Page" : "As Blocks"}</p>
              <p>Import master: {importMaster?.importKey ?? "not created yet"}</p>
              <p>Source asset bases: {importMaster?.sourceAssetBases?.length ?? 0}</p>
              <p>
                Source assets (css/js/media): {sourceAssetCounts.stylesheets}/{sourceAssetCounts.scripts}/{sourceAssetCounts.media}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-100">Step 2 · Proposed Blocks</h2>
                <p className="text-[11px] text-slate-500">Detect, review, compare, and import governed reusable blocks.</p>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button type="button" onClick={() => toggleAll(true)} className="text-slate-400 hover:text-slate-200">
                  Accept All
                </button>
                <span className="text-slate-600">|</span>
                <button type="button" onClick={() => toggleAll(false)} className="text-slate-400 hover:text-slate-200">
                  Discard All
                </button>
              </div>
            </div>

            {blockProposals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.12] px-4 py-8 text-center text-xs text-slate-500">
                Process source to detect block candidates.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {blockProposals.map((block, index) => {
                  const included = selectedBlocks[block.id] !== false;
                  const persistedMeta = persistedProposalMeta[block.id] ?? null;
                  const proposalHtml = block.previewHtml ?? block.rawHtmlSnippet ?? "<section></section>";
                  const sourcePreviewHtml = persistedMeta?.sourcePreviewHtml ?? proposalHtml;
                  const targetPreviewHtml = resolveProposalTargetPreviewHtml({
                    proposalHtml,
                    persistedMeta,
                    theme: compareTheme,
                    hostAssets: platformPreviewAssets
                  });
                  const schemaStatus =
                    persistedMeta?.schemaStatus ?? deriveSchemaStatus(block.confidence, proposalHtml.trim().length > 0);
                  const schemaTone =
                    schemaStatus === "valid"
                      ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.08]"
                      : schemaStatus === "warning"
                        ? "text-amber-300 border-amber-500/30 bg-amber-500/[0.08]"
                        : "text-red-300 border-red-500/30 bg-red-500/[0.08]";

                  return (
                    <article
                      key={block.id}
                      className={`rounded-lg border p-2 ${included ? "border-blue-500/30 bg-blue-500/[0.06]" : "border-white/[0.08] bg-white/[0.02]"}`}
                    >
                      <div className="mb-2 h-24 overflow-hidden rounded border border-white/[0.08] bg-[#020617]">
                        {targetPreviewHtml.trim().length > 0 ? (
                          <iframe
                            title={`${block.id}-preview`}
                            className="h-full w-full"
                            srcDoc={buildPreviewThumbnailDocument(targetPreviewHtml)}
                            sandbox="allow-scripts allow-same-origin"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-slate-500">
                            Preview unavailable for this proposal.
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <input
                          data-testid={`import-proposal-name-${block.id}`}
                          value={proposalNameDrafts[block.id] ?? persistedMeta?.name ?? block.displayName ?? block.family}
                          onChange={(event) =>
                            setProposalNameDrafts((current) => ({
                              ...current,
                              [block.id]: event.target.value
                            }))
                          }
                          onBlur={(event) => {
                            void persistProposalName(block.id, event.currentTarget.value);
                          }}
                          className="w-full rounded border border-white/[0.08] bg-white/[0.02] px-1.5 py-1 text-xs font-semibold text-slate-200"
                        />
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">{block.family}</p>
                        <p className="text-[10px] text-slate-400">Fidelity {Math.round(block.confidence * 100)}%</p>
                        <div className="flex flex-wrap gap-1">
                          <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${schemaTone}`}>
                            schema {schemaStatus}
                          </span>
                          {persistedMeta ? (
                            <span className="rounded border border-blue-500/30 bg-blue-500/[0.08] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-blue-300">
                              draft persisted
                            </span>
                          ) : null}
                          <span className="rounded border border-white/[0.16] bg-white/[0.02] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-400">
                            #{index + 1}
                          </span>
                        </div>
                        {persistedMeta?.blockKey ? (
                          <p className="truncate text-[9px] font-mono text-slate-500" title={persistedMeta.blockKey}>
                            {persistedMeta.blockKey}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          data-testid={`import-proposal-inspect-${block.id}`}
                          onClick={() => setFocusedProposalId(block.id)}
                          className={`rounded px-2 py-1 text-[11px] font-semibold ${
                            focusedProposalId === block.id ? "bg-white/[0.1] text-slate-100" : "border border-white/[0.12] text-slate-400"
                          }`}
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          data-testid={`import-proposal-compare-${block.id}`}
                          onClick={() => setFocusedProposalId(block.id)}
                          className="rounded border border-blue-500/30 bg-blue-500/[0.12] px-2 py-1 text-[11px] font-semibold text-blue-200"
                        >
                          Compare
                        </button>
                        <button
                          type="button"
                          data-testid={`import-proposal-preview-source-${block.id}`}
                          onClick={() => {
                            setFocusedProposalId(block.id);
                            setStatusMessage(`Source preview selected for ${proposalNameDrafts[block.id] ?? block.displayName ?? block.family}.`);
                          }}
                          className="rounded border border-white/[0.12] px-2 py-1 text-[11px] text-slate-400"
                        >
                          Source
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedBlocks((prev) => ({ ...prev, [block.id]: !included }))}
                          className={`rounded px-2 py-1 text-[11px] font-semibold ${
                            included ? "bg-blue-500 text-white" : "border border-white/[0.12] text-slate-400"
                          }`}
                        >
                          {included ? "Accepted" : "Accept"}
                        </button>
                      </div>
                      {isRenamingProposal === block.id ? (
                        <p className="mt-1 text-[10px] text-blue-300">Persisting rename…</p>
                      ) : null}
                      {sourcePreviewHtml.trim().length === 0 ? (
                        <p className="mt-1 text-[10px] text-amber-300">Source preview unavailable for this proposal.</p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex items-center justify-end">
              <button
                data-testid="import-publish-selected"
                type="button"
                onClick={() => {
                  void importSelectedAsGovernedBlocks();
                }}
                disabled={!analysis || selectedCount === 0 || isImporting}
                className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {isImporting ? "Importing…" : importMode === "page" ? "Import Blocks + Create Page" : "Import Selected Blocks"}
              </button>
            </div>
          </div>

          {analysis ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                <p className="text-xs font-semibold text-slate-300">
                  Source vs Target Comparison
                  {focusedProposal ? ` · ${proposalNameDrafts[focusedProposal.id] ?? focusedProposal.displayName ?? focusedProposal.family}` : ""}
                </p>
                <div className="flex items-center gap-1">
                  {themes.slice(0, 4).map((theme) => {
                    const selected = previewSwatchThemeId === theme.id;
                    return (
                      <button
                        key={`compare-${theme.id}`}
                        type="button"
                        onClick={() => setPreviewSwatchThemeId(selected ? null : theme.id)}
                        className={`h-5 w-5 rounded-full border ${selected ? "border-blue-300 ring-2 ring-blue-500/40" : "border-white/25"}`}
                        style={{ backgroundColor: theme.darkMode ? "#1162d4" : "#64748b" }}
                        title={`Compare using ${theme.name}`}
                      />
                    );
                  })}
                </div>
              </div>
              {focusedProposal ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                  <p className="text-[11px] text-slate-300">
                    Source uses import master context
                    {importMaster ? ` (${importMaster.importKey})` : ""}. Target uses the selected Studio theme ({selectedThemeKey})
                    {importMode === "page" ? ` and page shell (${selectedShellKey || "none"})` : " without page shells"}.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-4 lg:grid-cols-2">
                <PreviewPane
                  title="Source (Reference Theme)"
                  badge="source"
                  srcDoc={sourceComparisonPreview.srcDoc}
                  minHeight="360px"
                  testId="import-source-preview"
                />
                <PreviewPane
                  title="Target (Selected Theme)"
                  badge="target"
                  srcDoc={
                    focusedProposal
                      ? focusedTargetPreviewHtml ?? "<!doctype html><html><head></head><body></body></html>"
                      : buildPlatformBlockPreviewDocument({
                          proposalHtml: analysis.source.productionPreviewHtml,
                          theme: compareTheme,
                          hostAssets: platformPreviewAssets
                        })
                  }
                  minHeight="360px"
                  testId="import-target-preview"
                />
              </div>
              {sourceComparisonPreview.missingSourceCss ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-[11px] text-red-200">
                  Source preview CSS context is missing for the selected block. Import Master asset manifest did not provide required stylesheet/script assets.
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
