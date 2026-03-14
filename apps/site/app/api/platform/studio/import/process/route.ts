import { type OnboardingAnalysis, type OnboardingBlockProposal, type OnboardingSourceType } from "@lmnas/contracts";
import { analyzeOnboardingSource } from "@lmnas/integrations";
import { inflateRawSync } from "node:zlib";
import {
  buildPlatformBlockPreviewDocument,
  buildPlatformTargetDocument,
  createStaticPlatformPreviewAssets
} from "../../../../../platform/onboarding/_lib/platform-preview-shared";
import type { StudioTheme } from "../../../../../platform/onboarding/_lib/studio-types";
import { loadProjectEnv } from "../../../../../lib/env";
import { getStudioStore, replaceStore } from "../../_lib/store";
import { isStrapiConfigured, requestStrapi } from "../../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type StrapiSingleResponse = {
  data?: Record<string, unknown>;
};

type StitchZipUpload = {
  fileName: string;
  dataBase64: string;
  mimeType?: string;
  sizeBytes?: number;
};

type ProcessSourceRequest = {
  sourceType?: unknown;
  sourceValue?: unknown;
  slug?: unknown;
  locale?: unknown;
  themeKey?: unknown;
  shellKey?: unknown;
  importMode?: unknown;
  extractionSettings?: unknown;
  stitchZipUpload?: unknown;
};

type PersistedImportMaster = {
  id: string;
  importKey: string;
  status: "processed" | "imported_blocks" | "imported_page" | "failed";
  selectedThemeKey: string;
  selectedShellKey: string;
  importMode: "blocks" | "page";
  sourceType: OnboardingSourceType;
};

type PersistedDraftBlock = {
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
};

type ProcessSourceResponse = {
  ok: true;
  analysis: OnboardingAnalysis;
  persistence: {
    source: "strapi" | "fallback";
    schemaSource: "canonical" | "legacy" | "fallback";
    proposalsPersisted: number;
    proposalBlocks: PersistedDraftBlock[];
    importMaster?: PersistedImportMaster;
    warnings: string[];
    upload?: {
      fileName: string;
      htmlEntry: string;
      htmlEntryCount: number;
    };
  };
};

type CanonicalTheme = {
  id: string;
  themeKey: string;
  name: string;
  darkMode: boolean;
  tokens: Array<{
    key?: string;
    cssVariable?: string;
    value?: string;
  }>;
};

type CanonicalShell = {
  id: string;
  shellKey: string;
  name: string;
  role: "navbar" | "footer" | "full";
  previewHtml: string;
};

const CANONICAL_BLOCK_COLLECTION = "/api/studio-blocks";
const CANONICAL_IMPORT_MASTER_COLLECTION = "/api/studio-import-masters";
const CANONICAL_THEME_COLLECTION = "/api/studio-themes";
const CANONICAL_SHELL_COLLECTION = "/api/studio-shells";
const ZIP_MAX_BYTES = 8 * 1024 * 1024;
const DEBUG_IMPORT_FALLBACK_ENV = "STUDIO_DEBUG_ALLOW_IMPORT_FALLBACK";

function readUint16LE(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}

function readUint32LE(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

function ensureString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function parseSourceType(value: unknown): OnboardingSourceType {
  if (
    value === "stitch_section" ||
    value === "stitch_full_page" ||
    value === "figma_section" ||
    value === "figma_full_page" ||
    value === "url" ||
    value === "raw_html"
  ) {
    return value;
  }
  throw new Error("import.source_type_invalid");
}

function parseImportMode(value: unknown): "blocks" | "page" {
  return value === "page" ? "page" : "blocks";
}

function normalizeBlockKey(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized.length > 0 ? normalized : `import-block-${Date.now()}`;
}

function normalizeImportKey(input: string): string {
  const base = normalizeBlockKey(input);
  return `${base}-${Date.now()}`;
}

function decodeStitchZipUpload(value: unknown): StitchZipUpload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  if (typeof row.fileName !== "string" || row.fileName.trim().length === 0) {
    throw new Error("import.stitch_zip_filename_required");
  }
  if (typeof row.dataBase64 !== "string" || row.dataBase64.trim().length === 0) {
    throw new Error("import.stitch_zip_data_required");
  }

  const fileName = row.fileName.trim();
  if (!fileName.toLowerCase().endsWith(".zip")) {
    throw new Error("import.stitch_zip_extension_invalid");
  }

  return {
    fileName,
    dataBase64: row.dataBase64.trim(),
    mimeType: typeof row.mimeType === "string" ? row.mimeType : undefined,
    sizeBytes: typeof row.sizeBytes === "number" ? row.sizeBytes : undefined
  };
}

function decodeBase64Upload(upload: StitchZipUpload): Buffer {
  let decoded: Buffer;
  try {
    decoded = Buffer.from(upload.dataBase64, "base64");
  } catch {
    throw new Error("import.stitch_zip_base64_invalid");
  }

  if (decoded.length === 0) {
    throw new Error("import.stitch_zip_empty");
  }
  if (decoded.length > ZIP_MAX_BYTES) {
    throw new Error("import.stitch_zip_too_large");
  }

  return decoded;
}

function hasZipSignature(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }
  const sig = buffer.readUInt32LE(0);
  return sig === 0x04034b50 || sig === 0x06054b50 || sig === 0x08074b50;
}

type ZipCentralEntry = {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

function findEndOfCentralDirectoryOffset(buffer: Buffer): number {
  const EOCD_SIGNATURE = 0x06054b50;
  const minimumLength = 22;
  const start = Math.max(0, buffer.length - 0xffff - minimumLength);
  for (let index = buffer.length - minimumLength; index >= start; index -= 1) {
    if (buffer.readUInt32LE(index) === EOCD_SIGNATURE) {
      return index;
    }
  }
  throw new Error("import.stitch_zip_eocd_missing");
}

function parseCentralDirectoryEntries(buffer: Buffer): ZipCentralEntry[] {
  const eocdOffset = findEndOfCentralDirectoryOffset(buffer);
  const totalEntries = readUint16LE(buffer, eocdOffset + 10);
  const centralDirectorySize = readUint32LE(buffer, eocdOffset + 12);
  const centralDirectoryOffset = readUint32LE(buffer, eocdOffset + 16);
  if (totalEntries <= 0 || centralDirectorySize <= 0) {
    throw new Error("import.stitch_zip_no_entries");
  }

  const entries: ZipCentralEntry[] = [];
  let cursor = centralDirectoryOffset;
  const CENTRAL_SIGNATURE = 0x02014b50;

  while (cursor < centralDirectoryOffset + centralDirectorySize && entries.length < totalEntries) {
    const signature = buffer.readUInt32LE(cursor);
    if (signature !== CENTRAL_SIGNATURE) {
      throw new Error("import.stitch_zip_central_invalid");
    }

    const compressionMethod = readUint16LE(buffer, cursor + 10);
    const compressedSize = readUint32LE(buffer, cursor + 20);
    const uncompressedSize = readUint32LE(buffer, cursor + 24);
    const fileNameLength = readUint16LE(buffer, cursor + 28);
    const extraLength = readUint16LE(buffer, cursor + 30);
    const commentLength = readUint16LE(buffer, cursor + 32);
    const localHeaderOffset = readUint32LE(buffer, cursor + 42);
    const fileNameStart = cursor + 46;
    const fileName = buffer.slice(fileNameStart, fileNameStart + fileNameLength).toString("utf8");

    entries.push({
      fileName,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset
    });

    cursor = fileNameStart + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function extractZipEntry(buffer: Buffer, entry: ZipCentralEntry): Buffer {
  const LOCAL_SIGNATURE = 0x04034b50;
  const localOffset = entry.localHeaderOffset;
  if (localOffset < 0 || localOffset + 30 > buffer.length) {
    throw new Error("import.stitch_zip_local_header_invalid");
  }

  const signature = buffer.readUInt32LE(localOffset);
  if (signature !== LOCAL_SIGNATURE) {
    throw new Error("import.stitch_zip_local_header_invalid");
  }

  const fileNameLength = readUint16LE(buffer, localOffset + 26);
  const extraLength = readUint16LE(buffer, localOffset + 28);
  const dataStart = localOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataStart < 0 || dataEnd > buffer.length) {
    throw new Error("import.stitch_zip_entry_bounds_invalid");
  }

  const compressed = buffer.slice(dataStart, dataEnd);
  if (entry.compressionMethod === 0) {
    return compressed;
  }
  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressed);
  }
  throw new Error("import.stitch_zip_compression_unsupported");
}

function extractHtmlFromStitchZip(upload: StitchZipUpload): {
  html: string;
  fileName: string;
  htmlEntry: string;
  htmlEntryCount: number;
} {
  const buffer = decodeBase64Upload(upload);
  if (!hasZipSignature(buffer)) {
    throw new Error("import.stitch_zip_signature_invalid");
  }

  const entries = parseCentralDirectoryEntries(buffer).filter((entry) => !entry.fileName.endsWith("/"));
  const htmlEntries = entries.filter((entry) => /\.html?$/i.test(entry.fileName));
  if (htmlEntries.length === 0) {
    throw new Error("import.stitch_zip_missing_html");
  }

  const preferred =
    htmlEntries.find((entry) => /(^|\/)index\.html?$/i.test(entry.fileName)) ??
    htmlEntries.find((entry) => /(^|\/)page\.html?$/i.test(entry.fileName)) ??
    htmlEntries[0];

  const htmlBuffer = extractZipEntry(buffer, preferred);
  const html = htmlBuffer.toString("utf8").trim();
  if (html.length === 0) {
    throw new Error("import.stitch_zip_html_empty");
  }

  return {
    html,
    fileName: upload.fileName,
    htmlEntry: preferred.fileName,
    htmlEntryCount: htmlEntries.length
  };
}

function resolveSchemaStatus(confidence: number, previewHtml: string | undefined): "valid" | "warning" | "invalid" {
  if (!previewHtml || previewHtml.trim().length === 0) {
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

function resolveEntityMutationId(value: Record<string, unknown>): string | null {
  if (typeof value.documentId === "string" && value.documentId.length > 0) {
    return value.documentId;
  }
  if (typeof value.id === "string" || typeof value.id === "number") {
    return String(value.id);
  }
  return null;
}

function unwrapStrapiEntity(value: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (value.attributes && typeof value.attributes === "object" && !Array.isArray(value.attributes)) {
    return {
      ...((value.attributes as Record<string, unknown>) ?? {}),
      id: value.id,
      documentId: value.documentId
    };
  }
  return value;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
}

function buildSourceSummary(analysis: OnboardingAnalysis): string {
  const text = stripHtmlTags(analysis.source.rawMarkupPreview ?? analysis.intake.sourceValue).replace(/\s+/g, " ").trim();
  if (text.length === 0) {
    return "No source text extracted.";
  }
  return text.slice(0, 320);
}

function extractSourceAssetContext(params: {
  sourceHtml: string;
  sourceBaseUrl?: string;
}): {
  assetBases: string[];
  assetManifest: {
    stylesheets: string[];
    scripts: string[];
    media: string[];
  };
} {
  const stylesheetMatches = Array.from(params.sourceHtml.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)).map((match) => match[1]);
  const scriptMatches = Array.from(params.sourceHtml.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)).map((match) => match[1]);
  const mediaMatches = Array.from(params.sourceHtml.matchAll(/<(?:img|video|source)[^>]+src=["']([^"']+)["'][^>]*>/gi)).map((match) => match[1]);

  const originBases = new Set<string>();
  if (params.sourceBaseUrl) {
    originBases.add(params.sourceBaseUrl);
  }

  [...stylesheetMatches, ...scriptMatches, ...mediaMatches].forEach((assetRef) => {
    try {
      const resolved = new URL(assetRef, params.sourceBaseUrl);
      originBases.add(`${resolved.origin}/`);
    } catch {
      // Ignore malformed asset refs in context summary.
    }
  });

  return {
    assetBases: Array.from(originBases),
    assetManifest: {
      stylesheets: Array.from(new Set(stylesheetMatches)).slice(0, 120),
      scripts: Array.from(new Set(scriptMatches)).slice(0, 120),
      media: Array.from(new Set(mediaMatches)).slice(0, 200)
    }
  };
}

function mapCanonicalThemeToPreviewTheme(theme: CanonicalTheme | null): StudioTheme | null {
  if (!theme) {
    return null;
  }

  return {
    id: theme.id,
    themeKey: theme.themeKey,
    name: theme.name,
    status: "active",
    sourceRef: "canonical-import-theme",
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    tokenCoverage: 1,
    themeDebt: "",
    darkMode: theme.darkMode,
    tokens: theme.tokens
      .map((token, index) => {
        const key = typeof token.key === "string" && token.key.trim().length > 0 ? token.key.trim() : `token.${index + 1}`;
        const value = typeof token.value === "string" ? token.value.trim() : "";
        if (value.length === 0) {
          return null;
        }
        const cssVariable =
          typeof token.cssVariable === "string" && token.cssVariable.trim().length > 0
            ? token.cssVariable.trim()
            : `--${key.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}`;
        return {
          key,
          label: key,
          category: key.includes("font") ? "typography" : key.includes("radius") ? "radius" : "color",
          value,
          cssVariable,
          mapped: true
        } as StudioTheme["tokens"][number];
      })
      .filter((token): token is StudioTheme["tokens"][number] => token !== null)
  };
}

function buildSourceProposalPreview(params: {
  block: OnboardingBlockProposal;
  analysis: OnboardingAnalysis;
  sourceBaseUrl?: string;
}): string {
  const snippet = params.block.previewHtml ?? params.block.rawHtmlSnippet ?? "<section></section>";
  const styleTags = Array.from(params.analysis.source.referencePreviewHtml.matchAll(/<style[\s\S]*?<\/style>/gi))
    .map((entry) => entry[0])
    .slice(0, 24)
    .join("\n");
  const stylesheetLinks = Array.from(params.analysis.source.referencePreviewHtml.matchAll(/<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi))
    .map((entry) => entry[0])
    .slice(0, 24)
    .join("\n");
  const baseTag = params.sourceBaseUrl ? `<base href=\"${params.sourceBaseUrl}\">` : "";

  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    "<meta charset=\"utf-8\"/>",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>",
    baseTag,
    stylesheetLinks,
    styleTags,
    "</head>",
    `<body class=\"${params.analysis.source.themeScopeClass}\">`,
    snippet,
    "</body>",
    "</html>"
  ].join("");
}

function buildTargetProposalPreview(params: {
  block: OnboardingBlockProposal;
  theme: CanonicalTheme | null;
}): string {
  return buildPlatformBlockPreviewDocument({
    proposalHtml: params.block.previewHtml ?? params.block.rawHtmlSnippet ?? "<section></section>",
    theme: mapCanonicalThemeToPreviewTheme(params.theme),
    hostAssets: createStaticPlatformPreviewAssets()
  });
}

function buildTargetComparisonPreview(params: {
  analysis: OnboardingAnalysis;
  theme: CanonicalTheme | null;
  shell: CanonicalShell | null;
  includeShell: boolean;
}): string {
  const blocksHtml = params.analysis.blockProposals
    .map((block, index) => {
      const snippet = block.previewHtml ?? block.rawHtmlSnippet ?? "<section></section>";
      const label = block.displayName ?? block.family;
      return [
        `<section class="overflow-hidden rounded-xl border border-primary/20 bg-background-dark/20" data-index="${index + 1}">`,
        `<div class="border-b border-primary/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">${label}</div>`,
        snippet,
        "</section>"
      ].join("");
    })
    .join("\n");

  return buildPlatformTargetDocument({
    bodyHtml: `<main class="lmnas-target-main grid gap-3 p-4">${
      blocksHtml ||
      "<section class=\"overflow-hidden rounded-xl border border-primary/20 bg-background-dark/20\"><div class=\"px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary\">No blocks</div></section>"
    }</main>`,
    theme: mapCanonicalThemeToPreviewTheme(params.theme),
    hostAssets: createStaticPlatformPreviewAssets(),
    beforeBodyHtml: params.includeShell ? params.shell?.previewHtml ?? "" : undefined
  });
}

async function lookupCanonicalTheme(themeKey: string): Promise<CanonicalTheme | null> {
  const response = await requestStrapi<StrapiCollectionResponse>(
    `${CANONICAL_THEME_COLLECTION}?filters[themeKey][$eq]=${encodeURIComponent(themeKey)}&pagination[pageSize]=1`
  );
  const row = Array.isArray(response.data) ? unwrapStrapiEntity(response.data[0]) : undefined;
  if (!row || Object.keys(row).length === 0) {
    return null;
  }

  const tokens: CanonicalTheme["tokens"] = Array.isArray(row.tokens)
    ? row.tokens.reduce<CanonicalTheme["tokens"]>((acc, token) => {
        if (!token || typeof token !== "object" || Array.isArray(token)) {
          return acc;
        }
        const record = token as Record<string, unknown>;
        acc.push({
          key: typeof record.key === "string" ? record.key : undefined,
          cssVariable: typeof record.cssVariable === "string" ? record.cssVariable : undefined,
          value: typeof record.value === "string" ? record.value : undefined
        });
        return acc;
      }, [])
    : [];

  return {
    id: String(row.documentId ?? row.id ?? ""),
    themeKey: typeof row.themeKey === "string" ? row.themeKey : themeKey,
    name: typeof row.name === "string" ? row.name : themeKey,
    darkMode: Boolean(row.darkMode),
    tokens
  };
}

async function lookupCanonicalShell(shellKey: string): Promise<CanonicalShell | null> {
  if (shellKey.trim().length === 0) {
    return null;
  }

  const response = await requestStrapi<StrapiCollectionResponse>(
    `${CANONICAL_SHELL_COLLECTION}?filters[shellKey][$eq]=${encodeURIComponent(shellKey)}&pagination[pageSize]=1`
  );
  const row = Array.isArray(response.data) ? unwrapStrapiEntity(response.data[0]) : undefined;
  if (!row || Object.keys(row).length === 0) {
    return null;
  }

  return {
    id: String(row.documentId ?? row.id ?? ""),
    shellKey: typeof row.shellKey === "string" ? row.shellKey : shellKey,
    name: typeof row.name === "string" ? row.name : shellKey,
    role: row.role === "navbar" || row.role === "footer" ? row.role : "full",
    previewHtml: typeof row.previewHtml === "string" ? row.previewHtml : ""
  };
}

async function createImportMasterInStrapi(params: {
  importKey: string;
  analysis: OnboardingAnalysis;
  resolvedSourceHtml: string;
  importMode: "blocks" | "page";
  selectedThemeKey: string;
  selectedShellKey: string;
  sourceAssetBases: string[];
  sourceAssetManifest: {
    stylesheets: string[];
    scripts: string[];
    media: string[];
  };
  targetPreviewHtml: string;
  uploadSummary?: {
    fileName: string;
    htmlEntry: string;
    htmlEntryCount: number;
  };
}): Promise<PersistedImportMaster> {
  const payload: Record<string, unknown> = {
    importKey: params.importKey,
    sourceType: params.analysis.intake.sourceType,
    sourceRef: params.analysis.source.sourceRef,
    sourceTitle: params.analysis.source.title,
    sourceSummary: buildSourceSummary(params.analysis),
    sourceHtml: params.resolvedSourceHtml,
    sourceRawMarkupPreview: params.analysis.source.rawMarkupPreview,
    sourceBaseUrl: params.analysis.source.baseUrl,
    sourceAssetBases: params.sourceAssetBases,
    sourceAssetManifest: params.sourceAssetManifest,
    sourceStyleProfile: params.analysis.source.styleProfile,
    sourceThemeCharacteristics: params.analysis.theme,
    sourceShellCharacteristics: params.analysis.shellCandidates,
    referencePreviewHtml: params.analysis.source.referencePreviewHtml,
    targetPreviewHtml: params.targetPreviewHtml,
    selectedThemeKey: params.selectedThemeKey,
    selectedShellKey: params.selectedShellKey,
    importMode: params.importMode,
    status: "processed",
    lifecycle: "draft",
    extractionSummary: {
      fidelityWarnings: params.analysis.fidelityWarnings.length,
      shellCandidates: params.analysis.shellCandidates.length,
      widgetProposals: params.analysis.widgetProposals.length,
      actionProposals: params.analysis.actionProposals.length,
      exitProposals: params.analysis.exitProposals.length
    },
    proposalSummary: {
      blocksDetected: params.analysis.blockProposals.length,
      acceptedByDefault: params.analysis.blockProposals.length
    },
    warnings: [],
    uploadSummary: params.uploadSummary,
    processedAt: new Date().toISOString()
  };

  const created = await requestStrapi<StrapiSingleResponse>(CANONICAL_IMPORT_MASTER_COLLECTION, {
    method: "POST",
    body: payload
  });

  const row = unwrapStrapiEntity(created.data);
  const mutationId = resolveEntityMutationId(row);
  if (!mutationId) {
    throw new Error("import.import_master_persistence_failed");
  }

  return {
    id: mutationId,
    importKey: typeof row.importKey === "string" && row.importKey.length > 0 ? row.importKey : params.importKey,
    status: "processed",
    selectedThemeKey: params.selectedThemeKey,
    selectedShellKey: params.selectedShellKey,
    importMode: params.importMode,
    sourceType: params.analysis.intake.sourceType
  };
}

async function upsertCanonicalBlockInStrapi(block: {
  blockKey: string;
  name: string;
  family: string;
  themeKey: string;
  sourceType: string;
  sourceRef: string;
  sourcePreviewHtml: string;
  targetPreviewHtml: string;
  sourceAssetContext: {
    baseUrl?: string;
    importKey: string;
    importMasterId: string;
    assetManifest: {
      stylesheets: string[];
      scripts: string[];
      media: string[];
    };
  };
  importProposalId: string;
  importMasterId: string;
  confidence: number;
  editableFields: string[];
  actions: Array<{ id: string; label: string; type: string; target: string }>;
  schemaStatus: "valid" | "warning" | "invalid";
}): Promise<"created" | "updated"> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `${CANONICAL_BLOCK_COLLECTION}?filters[blockKey][$eq]=${encodeURIComponent(block.blockKey)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  const existingId = existing ? resolveEntityMutationId(existing) : null;

  const payload: Record<string, unknown> = {
    blockKey: block.blockKey,
    name: block.name,
    family: block.family,
    status: "draft",
    lifecycle: "draft",
    scope: "global",
    schemaStatus: block.schemaStatus,
    themeKey: block.themeKey,
    sourceType: block.sourceType,
    sourceRef: block.sourceRef,
    sourcePreviewHtml: block.sourcePreviewHtml,
    targetPreviewHtml: block.targetPreviewHtml,
    sourceAssetContext: block.sourceAssetContext,
    importProposalId: block.importProposalId,
    importMaster: block.importMasterId,
    confidence: block.confidence,
    editableFields: block.editableFields,
    actions: block.actions,
    previewHtml: block.targetPreviewHtml,
    usageCount: 0
  };

  if (existingId !== null) {
    await requestStrapi(`${CANONICAL_BLOCK_COLLECTION}/${encodeURIComponent(existingId)}`, {
      method: "PUT",
      body: payload
    });
    return "updated";
  }

  await requestStrapi(CANONICAL_BLOCK_COLLECTION, {
    method: "POST",
    body: payload
  });
  return "created";
}

async function persistDraftProposalsToStrapi(params: {
  analysis: OnboardingAnalysis;
  importMaster: PersistedImportMaster;
  sourceAssetManifest: {
    stylesheets: string[];
    scripts: string[];
    media: string[];
  };
  targetTheme: CanonicalTheme | null;
}): Promise<{
  schemaSource: "canonical";
  proposalBlocks: PersistedDraftBlock[];
}> {
  const persisted: PersistedDraftBlock[] = [];
  const slug = normalizeBlockKey(params.analysis.intake.slug);

  for (let index = 0; index < params.analysis.blockProposals.length; index += 1) {
    const block = params.analysis.blockProposals[index];
    const keySeed = `${slug}-${block.id}-${String(index + 1).padStart(2, "0")}`;
    const blockKey = normalizeBlockKey(keySeed);
    const schemaStatus = resolveSchemaStatus(block.confidence, block.previewHtml ?? block.rawHtmlSnippet);
    const sourcePreviewHtml = buildSourceProposalPreview({
      block,
      analysis: params.analysis,
      sourceBaseUrl: params.analysis.source.baseUrl
    });
    const targetPreviewHtml = buildTargetProposalPreview({
      block,
      theme: params.targetTheme
    });
    const name = block.displayName ?? block.family.replaceAll("_", " ");

    const disposition = await upsertCanonicalBlockInStrapi({
      blockKey,
      name,
      family: block.family,
      themeKey: params.analysis.intake.themeKey,
      sourceType: params.analysis.intake.sourceType,
      sourceRef: params.analysis.source.sourceRef,
      sourcePreviewHtml,
      targetPreviewHtml,
      sourceAssetContext: {
        baseUrl: params.analysis.source.baseUrl,
        importKey: params.importMaster.importKey,
        importMasterId: params.importMaster.id,
        assetManifest: params.sourceAssetManifest
      },
      importProposalId: block.id,
      importMasterId: params.importMaster.id,
      confidence: block.confidence,
      editableFields: block.editableFields,
      actions: [],
      schemaStatus
    });

    persisted.push({
      proposalId: block.id,
      blockKey,
      schemaStatus,
      status: "draft",
      disposition,
      name,
      importMasterId: params.importMaster.id,
      importMasterKey: params.importMaster.importKey,
      sourcePreviewHtml,
      targetPreviewHtml
    });
  }

  return {
    schemaSource: "canonical",
    proposalBlocks: persisted
  };
}

function persistDraftProposalsInFallback(analysis: OnboardingAnalysis): PersistedDraftBlock[] {
  const store = getStudioStore();
  const blocks = [...store.blocks];
  const persisted: PersistedDraftBlock[] = [];
  const slug = normalizeBlockKey(analysis.intake.slug);
  const now = new Date().toISOString().slice(0, 10);

  analysis.blockProposals.forEach((block, index) => {
    const keySeed = `${slug}-${block.id}-${String(index + 1).padStart(2, "0")}`;
    const blockKey = normalizeBlockKey(keySeed);
    const schemaStatus = resolveSchemaStatus(block.confidence, block.previewHtml ?? block.rawHtmlSnippet);
    const existingIndex = blocks.findIndex((entry) => entry.key === blockKey || entry.id === blockKey);
    const name = block.displayName ?? block.family.replaceAll("_", " ");
    const sourcePreviewHtml = buildSourceProposalPreview({
      block,
      analysis,
      sourceBaseUrl: analysis.source.baseUrl
    });
    const targetPreviewHtml = buildTargetProposalPreview({
      block,
      theme: null
    });

    const next = {
      id: existingIndex >= 0 ? blocks[existingIndex].id : blockKey,
      key: blockKey,
      name,
      family: block.family,
      status: "draft" as const,
      lifecycle: "draft" as const,
      scope: "global" as const,
      schemaStatus,
      themeKey: analysis.intake.themeKey,
      sourceType: analysis.intake.sourceType,
      sourceRef: analysis.source.sourceRef,
      confidence: block.confidence,
      editableFields: block.editableFields,
      actions: [],
      previewHtml: block.previewHtml ?? block.rawHtmlSnippet ?? "<section></section>",
      sourcePreviewHtml,
      targetPreviewHtml,
      inUseCount: 0,
      usageCount: 0,
      createdAt: existingIndex >= 0 ? blocks[existingIndex].createdAt : now,
      updatedAt: now
    };

    if (existingIndex >= 0) {
      blocks[existingIndex] = next;
    } else {
      blocks.unshift(next);
    }

    persisted.push({
      proposalId: block.id,
      blockKey,
      schemaStatus,
      status: "draft",
      disposition: existingIndex >= 0 ? "updated" : "created",
      name,
      importMasterId: "fallback",
      importMasterKey: "fallback",
      sourcePreviewHtml,
      targetPreviewHtml
    });
  });

  replaceStore({
    ...store,
    blocks
  });
  return persisted;
}

function operatorMessageForError(error: unknown): { status: number; error: string; code?: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "import.source_type_invalid") {
    return {
      status: 400,
      error: "Unsupported source type. Allowed values: stitch_section, stitch_full_page, figma_section, figma_full_page, url, raw_html.",
      code: message
    };
  }
  if (message.startsWith("import.stitch_zip_")) {
    const labelMap: Record<string, string> = {
      "import.stitch_zip_filename_required": "ZIP filename is required.",
      "import.stitch_zip_data_required": "ZIP file payload is missing.",
      "import.stitch_zip_extension_invalid": "Only .zip uploads are allowed for Stitch source.",
      "import.stitch_zip_base64_invalid": "ZIP payload is invalid base64.",
      "import.stitch_zip_empty": "Uploaded ZIP is empty.",
      "import.stitch_zip_too_large": "Uploaded ZIP exceeds 8 MB limit.",
      "import.stitch_zip_signature_invalid": "Uploaded file is not a valid ZIP archive.",
      "import.stitch_zip_eocd_missing": "ZIP structure is invalid (EOCD record missing).",
      "import.stitch_zip_no_entries": "ZIP contains no readable entries.",
      "import.stitch_zip_central_invalid": "ZIP central directory is malformed.",
      "import.stitch_zip_local_header_invalid": "ZIP local header is malformed.",
      "import.stitch_zip_entry_bounds_invalid": "ZIP entry bounds are invalid.",
      "import.stitch_zip_compression_unsupported":
        "ZIP contains unsupported compression. Re-export with standard deflate or stored entries.",
      "import.stitch_zip_missing_html": "No .html file found in uploaded Stitch ZIP.",
      "import.stitch_zip_html_empty": "Detected HTML file in ZIP is empty."
    };
    return {
      status: 400,
      error: labelMap[message] ?? "Unable to parse Stitch ZIP upload.",
      code: message
    };
  }
  if (message === "import.source_value_required") {
    return {
      status: 400,
      error: "Provide source input before processing.",
      code: message
    };
  }
  if (message === "import.strapi_required") {
    return {
      status: 503,
      error:
        "Canonical import persistence requires Strapi. Configure STRAPI_URL and STRAPI_API_TOKEN, then retry Process Source.",
      code: message
    };
  }
  if (message.startsWith("import.canonical_persistence_failed:")) {
    return {
      status: 502,
      error: message.replace("import.canonical_persistence_failed:", "").trim(),
      code: "import.canonical_persistence_failed"
    };
  }

  const isEnvMissing = message.includes("STRAPI") || message.includes("env") || message.includes("undefined");
  if (isEnvMissing) {
    return {
      status: 400,
      error: "Missing environment configuration. Ensure STRAPI_URL and STRAPI_API_TOKEN are set in .env at the monorepo root."
    };
  }
  return {
    status: 400,
    error: message
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    loadProjectEnv();
    const rawPayload = (await request.json()) as ProcessSourceRequest;
    const sourceType = parseSourceType(rawPayload.sourceType);
    const sourceValue = typeof rawPayload.sourceValue === "string" ? rawPayload.sourceValue : "";
    const stitchUpload = decodeStitchZipUpload(rawPayload.stitchZipUpload);
    const selectedThemeKey = ensureString(rawPayload.themeKey, "default");
    const selectedShellKey = ensureString(rawPayload.shellKey, "");
    const importMode = parseImportMode(rawPayload.importMode);

    let resolvedSourceValue = sourceValue.trim();
    let uploadSummary:
      | {
          fileName: string;
          htmlEntry: string;
          htmlEntryCount: number;
        }
      | undefined;
    if (sourceType === "stitch_full_page" || sourceType === "stitch_section") {
      if (stitchUpload) {
        const extracted = extractHtmlFromStitchZip(stitchUpload);
        resolvedSourceValue = extracted.html;
        uploadSummary = {
          fileName: extracted.fileName,
          htmlEntry: extracted.htmlEntry,
          htmlEntryCount: extracted.htmlEntryCount
        };
      }
      if (resolvedSourceValue.length === 0) {
        throw new Error("import.source_value_required");
      }
    }

    if (sourceType !== "stitch_full_page" && sourceType !== "stitch_section" && resolvedSourceValue.length === 0) {
      throw new Error("import.source_value_required");
    }

    const analysis = await analyzeOnboardingSource({
      sourceType,
      sourceValue: resolvedSourceValue,
      slug: ensureString(rawPayload.slug, "import-source"),
      locale: ensureString(rawPayload.locale, "en"),
      themeKey: selectedThemeKey,
      shellKey: selectedShellKey,
      importMode,
      extractionSettings: rawPayload.extractionSettings
    });

    const allowDebugFallback = process.env[DEBUG_IMPORT_FALLBACK_ENV] === "1";

    if (!isStrapiConfigured() && !allowDebugFallback) {
      throw new Error("import.strapi_required");
    }

    let warnings: string[] = [];
    let persistenceSource: "strapi" | "fallback" = "strapi";
    let schemaSource: "canonical" | "legacy" | "fallback" = "canonical";
    let proposalBlocks: PersistedDraftBlock[] = [];
    let persistedImportMaster: PersistedImportMaster | undefined;
    let analysisWithTargetPreview: OnboardingAnalysis = analysis;

    if (isStrapiConfigured()) {
      try {
        const [targetTheme, targetShell] = await Promise.all([
          lookupCanonicalTheme(selectedThemeKey),
          lookupCanonicalShell(selectedShellKey)
        ]);
        const sourceAssetContext = extractSourceAssetContext({
          sourceHtml: resolvedSourceValue,
          sourceBaseUrl: analysis.source.baseUrl
        });
        const targetPreviewHtml = buildTargetComparisonPreview({
          analysis,
          theme: targetTheme,
          shell: targetShell,
          includeShell: importMode === "page"
        });

        analysisWithTargetPreview = {
          ...analysis,
          source: {
            ...analysis.source,
            productionPreviewHtml: targetPreviewHtml
          }
        };

        const importKey = normalizeImportKey(analysis.intake.slug);
        persistedImportMaster = await createImportMasterInStrapi({
          importKey,
          analysis,
          resolvedSourceHtml: resolvedSourceValue,
          importMode,
          selectedThemeKey,
          selectedShellKey,
          sourceAssetBases: sourceAssetContext.assetBases,
          sourceAssetManifest: sourceAssetContext.assetManifest,
          targetPreviewHtml,
          uploadSummary
        });

        const persisted = await persistDraftProposalsToStrapi({
          analysis,
          importMaster: persistedImportMaster,
          sourceAssetManifest: sourceAssetContext.assetManifest,
          targetTheme
        });
        proposalBlocks = persisted.proposalBlocks;
        schemaSource = persisted.schemaSource;
      } catch (error) {
        if (!allowDebugFallback) {
          throw new Error(
            `import.canonical_persistence_failed:Canonical import persistence failed during processing. ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
        warnings = [
          `Debug fallback enabled via ${DEBUG_IMPORT_FALLBACK_ENV}=1. Canonical persistence failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        ];
        proposalBlocks = persistDraftProposalsInFallback(analysis);
        persistenceSource = "fallback";
        schemaSource = "fallback";
      }
    } else {
      proposalBlocks = persistDraftProposalsInFallback(analysis);
      persistenceSource = "fallback";
      schemaSource = "fallback";
      warnings = [
        `Debug fallback enabled via ${DEBUG_IMPORT_FALLBACK_ENV}=1. Strapi not configured; proposals persisted in local fallback store.`
      ];
    }

    const responseBody: ProcessSourceResponse = {
      ok: true,
      analysis: analysisWithTargetPreview,
      persistence: {
        source: persistenceSource,
        schemaSource,
        proposalsPersisted: proposalBlocks.length,
        proposalBlocks,
        ...(persistedImportMaster ? { importMaster: persistedImportMaster } : {}),
        warnings,
        ...(uploadSummary ? { upload: uploadSummary } : {})
      }
    };

    return Response.json(responseBody);
  } catch (error) {
    const normalized = operatorMessageForError(error);
    return Response.json(
      {
        ok: false,
        error: normalized.error,
        ...(normalized.code ? { code: normalized.code } : {})
      },
      { status: normalized.status }
    );
  }
}
