/**
 * import-page-helpers.ts
 *
 * Client-side helpers for the import pipeline that implement stylesheet
 * filtering and config threading for the target preview (CDN-free path).
 *
 * Implements:
 *   Step 1: filterSourceStylesheets (async content inspection)
 *           filterSourceStylesheetsByUrl (sync URL-heuristic, for useMemo)
 *           readManifestAssetList + resolveAssetUrl
 *           resolveProposalTargetPreviewHtml (threads importMaster through)
 */

import {
  classifyStylesheetHref,
  extractSourceTailwindConfig,
  buildPlatformBlockPreviewDocument,
  type PlatformPreviewAssets
} from "./platform-preview-shared";
import type { StudioImportMaster, StudioTheme } from "./studio-types";

// ---------------------------------------------------------------------------
// Manifest asset readers
// ---------------------------------------------------------------------------

function readManifestAssetUrl(entry: unknown): string | null {
  if (typeof entry === "string" && entry.trim().length > 0) {
    return entry.trim();
  }
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const candidates = [record["href"], record["src"], record["url"], record["value"]];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

export function resolveAssetUrl(asset: string, baseUrl?: string): string {
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

export function readManifestAssetList(
  manifest: unknown,
  key: "stylesheets" | "scripts",
  baseUrl?: string
): string[] {
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

// ---------------------------------------------------------------------------
// Step 1 — Synchronous URL-heuristic stylesheet filter
// (used inside useMemo / sync contexts where fetch is not possible)
// ---------------------------------------------------------------------------

/**
 * Applies a URL-heuristic-only classification to each href.
 * Returns only hrefs that are NOT classified as "block".
 * This is the sync version — no fetch, suitable for use inside useMemo.
 *
 * @param hrefs      - Raw href list from the source asset manifest.
 * @param runtimeSrc - Host's platform CSS src (blocked if present).
 */
export function filterSourceStylesheetsByUrl(hrefs: string[], runtimeSrc?: string): string[] {
  const additionalPatterns: string[] = [];
  if (runtimeSrc) {
    const path = runtimeSrc.replace(/^https?:\/\/[^/]+/, "").split("?")[0]?.trim() ?? "";
    if (path.length > 0) {
      additionalPatterns.push(path);
    } else {
      const origin = runtimeSrc.replace(/^https?:\/\//, "").split("/")[0]?.trim() ?? "";
      if (origin.length > 0) {
        additionalPatterns.push(origin);
      }
    }
  }
  return hrefs.filter((href) => classifyStylesheetHref(href, additionalPatterns) === "allow");
}

// ---------------------------------------------------------------------------
// Step 1 — Async content-inspection stylesheet filter
// (for use in async effects, not in render/useMemo paths)
// ---------------------------------------------------------------------------

/**
 * Classifies fetched CSS content.
 * Returns "baseline" if the CSS declares custom properties, :root blocks, or
 * @font-face rules — essential for source fidelity.
 * Returns "redundant" if it looks like compiled Tailwind output.
 * Returns "skip" on CORS/network error.
 */
export async function inspectStylesheetContent(
  href: string
): Promise<"baseline" | "redundant" | "skip"> {
  try {
    const response = await fetch(href, { mode: "cors", cache: "no-store" });
    if (!response.ok) {
      return "skip";
    }
    const text = await response.text();

    const hasCustomProperties = /--[\w-]+\s*:/i.test(text);
    const hasFontFace = /@font-face\s*\{/i.test(text);
    const hasRootBlock = /:root\s*\{/i.test(text);
    if (hasCustomProperties || hasFontFace || hasRootBlock) {
      return "baseline";
    }

    // Redundant: compiled Tailwind output — high density of utility class definitions
    const utilityClassDensity =
      (text.match(/\.(bg-|text-|flex|grid|px-|py-|md:|lg:|w-|h-|p-|m-|rounded)/g) ?? []).length;
    const redundancyThreshold = 50;
    if (utilityClassDensity > redundancyThreshold) {
      return "redundant";
    }

    return "baseline";
  } catch {
    return "skip";
  }
}

/**
 * Async version of the stylesheet filter. Uses URL heuristics first, then
 * fetches "unknown" hrefs to inspect their content.
 * Returns only hrefs that should be forwarded to the target preview.
 *
 * @param hrefs      - Raw href list from the source asset manifest.
 * @param runtimeSrc - Host's platform CSS src (blocked if present).
 */
export async function filterSourceStylesheets(
  hrefs: string[],
  runtimeSrc?: string
): Promise<string[]> {
  const additionalPatterns: string[] = runtimeSrc
    ? [runtimeSrc.replace(/^https?:\/\/[^/]+/, "").split("?")[0] ?? ""]
    : [];

  const results: string[] = [];

  await Promise.all(
    hrefs.map(async (href) => {
      const urlClassification = classifyStylesheetHref(href, additionalPatterns);
      if (urlClassification === "block") {
        return;
      }
      const contentClassification = await inspectStylesheetContent(href);
      if (contentClassification === "baseline") {
        results.push(href);
      }
    })
  );

  return results;
}

// ---------------------------------------------------------------------------
// Step 1+2+3 — resolveProposalTargetPreviewHtml
// ---------------------------------------------------------------------------

/**
 * Builds the target preview HTML for a single block proposal.
 *
 * When `importMaster` is provided:
 * - Derives filtered source stylesheets from sourceAssetManifest (Step 1).
 * - Extracts source Tailwind config from sourceHtml (Step 2).
 * - Passes both to buildPlatformBlockPreviewDocument (Step 3).
 *
 * The sync URL-heuristic filter is used here (no fetch in render path).
 */
export function resolveProposalTargetPreviewHtml(params: {
  proposalHtml: string;
  persistedTargetPreviewHtml?: string | null;
  theme: StudioTheme | null;
  hostAssets: PlatformPreviewAssets;
  importMaster?: StudioImportMaster | null;
}): string {
  const proposalHtml =
    params.proposalHtml ||
    params.persistedTargetPreviewHtml ||
    "<section></section>";

  // Step 1: derive filtered stylesheet hrefs (sync URL-heuristic only)
  const rawStylesheets = readManifestAssetList(
    params.importMaster?.sourceAssetManifest,
    "stylesheets",
    params.importMaster?.sourceBaseUrl
  );
  const runtimeSrc = params.hostAssets.platformCssSrc;
  const additionalStylesheetHrefs = filterSourceStylesheetsByUrl(rawStylesheets, runtimeSrc);

  // Step 2: extract source Tailwind config from the import master's source HTML
  const sourceTailwindConfig = extractSourceTailwindConfig(
    params.importMaster?.sourceHtml ?? ""
  );

  // Step 3: thread both through the document builder
  return buildPlatformBlockPreviewDocument({
    proposalHtml,
    theme: params.theme,
    hostAssets: params.hostAssets,
    additionalStylesheetHrefs,
    sourceTailwindConfig
  });
}
