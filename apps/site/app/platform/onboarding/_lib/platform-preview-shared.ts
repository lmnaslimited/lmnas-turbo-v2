import { sanitizeHtmlToSafeMarkup } from "../../../../lib/studio-html-sanitizer";
import { buildCanonicalPageComposition } from "../../../../lib/studio-canonical";
import type { StudioBlockTemplate, StudioPageDocument, StudioShell, StudioTheme } from "./studio-types";

export type PlatformPreviewAssets = {
  headMarkup: string;
  tailwindRuntimeSrc: string | null;
  /**
   * URL of the app's compiled platform CSS (Tailwind v4 output).
   * When set, the import target preview uses CDN-free mode:
   * links this CSS instead of cdn.tailwindcss.com and injects
   * canonical CSS vars at end of body instead of window.tailwind.config.
   */
  platformCssSrc?: string;
};

// ---------------------------------------------------------------------------
// Step 1 — CDN blocklist + stylesheet classification
// ---------------------------------------------------------------------------

/**
 * Substrings whose presence in a stylesheet href means the sheet should be
 * blocked from the target preview. Default policy: PRESERVE unless matched.
 */
export const TAILWIND_CDN_BLOCKLIST_PATTERNS: readonly string[] = [
  "cdn.tailwindcss.com",
  "@tailwindcss/browser",
  "tailwindcss.com",
  "tailwind.min.css",
  "tailwind.css",
  "studio-runtime.css",
  "lmnas-preview-runtime"
] as const;

/**
 * Known Tailwind first-party plugin names (v4 compatible).
 * Plugins in this set are pre-compiled into the platform CSS.
 * Unknown plugins are flagged as theme debt.
 */
export const KNOWN_TAILWIND_PLUGINS: ReadonlySet<string> = new Set([
  "typography",
  "forms",
  "container-queries",
  "aspect-ratio"
]);

/**
 * Classifies a single stylesheet href as "allow" or "block" for the target
 * preview. Policy is allow-by-default: only block when href matches a CDN/runtime
 * pattern or caller-supplied additional patterns.
 *
 * @param href               - The href attribute value of the <link> tag.
 * @param additionalPatterns - Extra substrings to treat as block-triggers.
 */
export function classifyStylesheetHref(
  href: string,
  additionalPatterns: readonly string[] = []
): "allow" | "block" {
  const normalized = href.toLowerCase().trim();
  const allPatterns: readonly string[] = [...TAILWIND_CDN_BLOCKLIST_PATTERNS, ...additionalPatterns];
  // Guard: skip empty patterns — an empty string matches every href via .includes("")
  const isBlocked = allPatterns.some(
    (pattern) => pattern.trim().length > 0 && normalized.includes(pattern.toLowerCase().trim())
  );
  return isBlocked ? "block" : "allow";
}

// ---------------------------------------------------------------------------
// Step 2 — Source Tailwind config extraction
// ---------------------------------------------------------------------------

/**
 * Extracts a source component's Tailwind config from raw HTML.
 *
 * Detection strategy (in priority order):
 *   1. <script id="tailwind-config">{ … }</script>
 *   2. <script id="lmnas-tailwind-runtime-config">…</script>
 *   3. Inline window.tailwind.config = { … }
 *   4. Inline tailwind.config = { … }
 *
 * Returns {} on any extraction or evaluation failure — never throws.
 */
export function extractSourceTailwindConfig(html: string): Record<string, unknown> {
  if (!html || html.trim().length === 0) {
    return {};
  }

  // Strategy 1 & 2: named script id blocks
  const idPatterns = [
    /id=["']tailwind-config["'][^>]*>([\s\S]*?)<\/script>/i,
    /id=["']lmnas-tailwind-runtime-config["'][^>]*>([\s\S]*?)<\/script>/i,
    /id=["']lmnas-preview-tailwind-config["'][^>]*>([\s\S]*?)<\/script>/i
  ];

  for (const pattern of idPatterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      const result = evalObjectLiteral(match[1].trim());
      if (result !== null) {
        return result;
      }
    }
  }

  // Strategy 3: window.tailwind.config = { … }
  const windowConfigMatch =
    /window\.tailwind(?:\.config)?\s*=\s*window\.tailwind(?:\.config)?\s*\|\|\s*\{\s*\};\s*window\.tailwind\.config\s*=\s*(\{[\s\S]*?\});/i.exec(html) ??
    /window\.tailwind\.config\s*=\s*(\{[\s\S]*?\});/i.exec(html);
  if (windowConfigMatch?.[1]) {
    const result = evalObjectLiteral(windowConfigMatch[1].trim());
    if (result !== null) {
      return result;
    }
  }

  // Strategy 4: tailwind.config = { … }
  const plainConfigMatch = /(?:^|[;\n])[ \t]*tailwind\.config\s*=\s*(\{[\s\S]*?\});/im.exec(html);
  if (plainConfigMatch?.[1]) {
    const result = evalObjectLiteral(plainConfigMatch[1].trim());
    if (result !== null) {
      return result;
    }
  }

  return {};
}

/** Safely evaluates a JS object literal. Returns null if evaluation fails. */
function evalObjectLiteral(literal: string): Record<string, unknown> | null {
  try {
    // eslint-disable-next-line no-new-func
    const value = new Function(`"use strict"; return (${literal})`)() as unknown;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Canonical CSS variables block (CDN-free token override)
// ---------------------------------------------------------------------------

/**
 * Builds the canonical CSS variable override block for the target preview.
 *
 * Returns a <style id="lmnas-canonical-vars"> block that re-declares all
 * StudioTheme token CSS variables using Tailwind v4 --color-* naming convention.
 * Injected at the END of <body> — last in cascade, always overrides source :root.
 *
 * @param theme - Canonical StudioTheme. If null, returns empty string.
 */
export function buildCanonicalCssVarsBlock(theme: StudioTheme | null): string {
  if (!theme || theme.tokens.length === 0) {
    return "";
  }

  const declarations = theme.tokens
    .map((token) => {
      const rawVar = token.cssVariable.startsWith("--") ? token.cssVariable : `--${token.cssVariable}`;
      const twVar = toTailwindVar(rawVar, token.category);
      return `${twVar}:${token.value};`;
    })
    .join("");

  return `<style id="lmnas-canonical-vars">:root{${declarations}}</style>`;
}

/** Maps a token CSS variable to its Tailwind v4 equivalent namespace. */
function toTailwindVar(cssVar: string, category: string): string {
  const name = cssVar.replace(/^--/, "");
  if (category === "color") {
    if (name.startsWith("color-")) return `--${name}`;
    return `--color-${name}`;
  }
  if (category === "typography") {
    if (name.startsWith("font-family-") || name.startsWith("font-"))
      return `--font-family-${name.replace(/^font-family-|^font-/, "")}`;
    return `--${name}`;
  }
  return `--${name}`;
}

// ---------------------------------------------------------------------------
// Step 3 — Plugin theme-debt detection (CDN-free)
// ---------------------------------------------------------------------------

function detectPluginThemeDebt(sourcePlugins: unknown[]): void {
  for (const plugin of sourcePlugins) {
    if (typeof plugin === "string" && !KNOWN_TAILWIND_PLUGINS.has(plugin)) {
      console.warn(
        `[LMNAs Import] Theme debt: unknown Tailwind plugin "${plugin}" ` +
          `is not pre-compiled into the platform CSS. ` +
          `Add @plugin "${plugin}" to platform CSS to resolve.`
      );
    }
  }
}

const DEFAULT_TAILWIND_RUNTIME_SRC = "https://cdn.tailwindcss.com?plugins=forms,container-queries";
const DEFAULT_NAVBAR_HTML =
  '<nav style="display:flex;justify-content:space-between;align-items:center;padding:14px 28px;background:#0f172a;color:#f8fafc;font-family:system-ui;border-bottom:1px solid #1e293b"><strong style="font-size:16px">LMNAs</strong><span style="font-size:12px;color:#94a3b8">Studio Shell</span></nav>';
const DEFAULT_FOOTER_HTML =
  '<footer style="padding:18px 28px;background:#0b1120;color:#64748b;font-family:system-ui;text-align:center;font-size:12px;border-top:1px solid #1e293b">LMNAs Studio Footer</footer>';

function stripPreviewRuntime(html: string): string {
  return html
    .replace(/<script\b[^>]*src=["'][^"']*(?:cdn\.tailwindcss\.com|@tailwindcss\/browser)[^"']*["'][^>]*>\s*<\/script>/gi, "")
    .replace(/<script\b[^>]*id=["'](?:tailwind-config|lmnas-tailwind-runtime-config|lmnas-preview-tailwind-config)["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?tailwind\.config\s*=[\s\S]*?<\/script>/gi, "");
}

function blockReferenceCandidates(block: StudioBlockTemplate): string[] {
  return [block.key, block.id].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function themeTokenValue(theme: StudioTheme | null, matchers: string[], fallback: string, fallbackColorIndex?: number): string {
  if (!theme) {
    return fallback;
  }

  const exactMatch = theme.tokens.find((token) => matchers.some((matcher) => token.key.toLowerCase().includes(matcher)));
  if (typeof exactMatch?.value === "string" && exactMatch.value.trim().length > 0) {
    return exactMatch.value.trim();
  }

  if (typeof fallbackColorIndex === "number") {
    const colorTokens = theme.tokens.filter((token) => token.category === "color" && token.value.trim().length > 0);
    const fallbackToken = colorTokens[fallbackColorIndex] ?? colorTokens[0];
    if (fallbackToken) {
      return fallbackToken.value.trim();
    }
  }

  return fallback;
}

function fontFamilyArray(theme: StudioTheme | null): string[] {
  const raw = themeTokenValue(theme, ["font-display", "typography.font.1", "font"], "Manrope, sans-serif");
  return raw
    .split(",")
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ""))
    .filter((entry) => entry.length > 0);
}

function buildTailwindRuntimeConfig(theme: StudioTheme | null): string {
  const primary = themeTokenValue(theme, ["primary", "accent"], "#135bec", 0);
  const backgroundLight = themeTokenValue(theme, ["background-light", "surface-light", "surface", "background", "bg"], "#f6f6f8", 1);
  const backgroundDark = themeTokenValue(theme, ["background-dark", "surface-dark", "background", "bg"], "#101622", 2);
  const textLight = themeTokenValue(theme, ["text", "foreground", "surface-text"], "#0f172a");
  const textDark = themeTokenValue(theme, ["text-dark", "foreground-dark", "surface-text-dark", "text", "foreground"], "#e2e8f0");
  const config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          primary,
          "background-light": backgroundLight,
          "background-dark": backgroundDark,
          "foreground-light": textLight,
          "foreground-dark": textDark
        },
        fontFamily: {
          display: fontFamilyArray(theme)
        },
        borderRadius: {
          DEFAULT: themeTokenValue(theme, ["radius.default", "radius"], "0.25rem"),
          lg: themeTokenValue(theme, ["radius.lg", "radius"], "0.5rem"),
          xl: themeTokenValue(theme, ["radius.xl", "radius"], "0.75rem"),
          full: themeTokenValue(theme, ["radius.full", "radius"], "9999px")
        }
      }
    }
  };

  return [
    "<script id=\"lmnas-preview-tailwind-config\">",
    `window.tailwind = window.tailwind || {}; window.tailwind.config = ${JSON.stringify(config)};`,
    "</script>"
  ].join("");
}

function buildThemeCssVars(theme: StudioTheme | null): string {
  if (!theme || theme.tokens.length === 0) {
    return "";
  }

  return theme.tokens
    .map((token) => {
      const variable = token.cssVariable.startsWith("--") ? token.cssVariable : `--${token.cssVariable}`;
      return `${variable}:${token.value};`;
    })
    .join("");
}

function toPreviewBodyHtml(input: string): string {
  if (input.trim().length === 0) {
    return "";
  }
  return extractBodyHtml(ensureHtmlDocument(sanitizeTargetHtml(input)));
}

export function ensureHtmlDocument(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "<!doctype html><html><head></head><body></body></html>";
  }
  if (/<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>${trimmed}</body></html>`;
}

export function extractBodyHtml(input: string): string {
  const bodyMatch = input.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (typeof bodyMatch?.[1] === "string") {
    return bodyMatch[1];
  }
  return input;
}

/**
 * Sanitizes imported HTML for use in the target preview.
 *
 * Selective version (POC Step 1):
 * - Only strips <link rel="stylesheet"> tags whose href is classified as "block".
 * - Preserves allowed sheets (fonts, CSS-var sheets, baseline resets).
 * - Also strips preview runtime scripts (Tailwind CDN, tailwind.config scripts).
 *
 * @param input      - Raw imported HTML string.
 * @param runtimeSrc - The host's own platform CSS src (added to block patterns).
 */
export function sanitizeTargetHtml(input: string, runtimeSrc?: string): string {
  const runtimePatterns: string[] = [];
  if (runtimeSrc) {
    const runtimePath = runtimeSrc.replace(/^https?:\/\/[^/]+/, "").split("?")[0]?.trim() ?? "";
    if (runtimePath.length > 0) {
      runtimePatterns.push(runtimePath);
    } else {
      const runtimeOrigin = runtimeSrc.replace(/^https?:\/\//, "").split("/")[0]?.trim() ?? "";
      if (runtimeOrigin.length > 0) {
        runtimePatterns.push(runtimeOrigin);
      }
    }
  }

  const runtimeStripped = stripPreviewRuntime(input);

  // Selectively strip only blocked stylesheets, preserve allowed ones
  const selectivelyStripped = runtimeStripped.replace(
    /<link([^>]+)rel=["'][^"']*stylesheet[^"']*["']([^>]*)>/gi,
    (fullMatch, before: string, after: string) => {
      const hrefMatch = /href=["']([^"']+)["']/i.exec(before + " " + after);
      if (!hrefMatch?.[1]) {
        return ""; // No href → strip (defensive)
      }
      const href = hrefMatch[1];
      const classification = classifyStylesheetHref(href, runtimePatterns);
      return classification === "block" ? "" : fullMatch;
    }
  );

  return sanitizeHtmlToSafeMarkup(
    extractBodyHtml(ensureHtmlDocument(selectivelyStripped)),
    "studio-preview"
  );
}

export function createStaticPlatformPreviewAssets(origin?: string): PlatformPreviewAssets {
  const href = origin ? `${origin.replace(/\/$/, "")}/studio-runtime.css` : "/studio-runtime.css";
  return {
    headMarkup: `<link rel="stylesheet" href="${href}">`,
    tailwindRuntimeSrc: DEFAULT_TAILWIND_RUNTIME_SRC
  };
}

export function buildPreviewPlaceholderDocument(title: string, description?: string): string {
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head>",
    "<body style=\"margin:0;background:#020617;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;\">",
    "<div style=\"text-align:center;padding:32px\">",
    `<h2 style=\"margin:0 0 8px;font-size:24px\">${title}</h2>`,
    description ? `<p style="margin:0;color:#94a3b8">${description}</p>` : "",
    "</div>",
    "</body></html>"
  ].join("");
}

export function buildPreviewThumbnailDocument(input: string): string {
  const documentHtml = ensureHtmlDocument(input);
  const thumbnailStyles = [
    "<style>",
    "html,body{margin:0;padding:0;overflow:hidden;height:100%}",
    "body{min-height:100%}",
    ".thumb-root{width:320%;transform:scale(.3125);transform-origin:top left;min-height:320%;}",
    ".thumb-root *{animation:none !important;transition:none !important;}",
    "</style>"
  ].join("");

  const withThumbnailStyles = documentHtml.includes("</head>")
    ? documentHtml.replace("</head>", `${thumbnailStyles}</head>`)
    : documentHtml.replace(/<html([^>]*)>/i, `<html$1><head>${thumbnailStyles}</head>`);

  if (/<body[^>]*>/i.test(withThumbnailStyles)) {
    return withThumbnailStyles
      .replace(/<body([^>]*)>/i, "<body$1><div class=\"thumb-root\">")
      .replace(/<\/body>/i, "</div></body>");
  }

  return [
    "<!doctype html><html><head><meta charset=\"utf-8\"/>",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>",
    thumbnailStyles,
    "</head><body>",
    `<div class="thumb-root">${extractBodyHtml(withThumbnailStyles)}</div>`,
    "</body></html>"
  ].join("");
}

export function resolvePlatformPreviewTheme(params: {
  themes: StudioTheme[];
  previewThemeId?: string | null;
  previewTheme?: StudioTheme | null;
  themeKey?: string | null;
}): StudioTheme | null {
  if (params.previewTheme) {
    return params.previewTheme;
  }
  if (params.previewThemeId) {
    const themeById = params.themes.find((theme) => theme.id === params.previewThemeId);
    if (themeById) {
      return themeById;
    }
  }
  if (params.themeKey) {
    const themeByKey = params.themes.find((theme) => theme.themeKey === params.themeKey);
    if (themeByKey) {
      return themeByKey;
    }
  }
  return params.themes.find((theme) => theme.status === "active") ?? params.themes[0] ?? null;
}

export function resolvePlatformShellPreview(params: {
  shells: StudioShell[];
  shellKey?: string | null;
}): { headerHtml: string; footerHtml: string } {
  const selectedShell = params.shellKey
    ? params.shells.find((shell) => shell.key === params.shellKey || shell.id === params.shellKey) ?? null
    : null;
  const activeFull = params.shells.find((shell) => shell.status === "active" && shell.role === "full");
  const activeNavbar = params.shells.find((shell) => shell.status === "active" && shell.role === "navbar");
  const activeFooter = params.shells.find((shell) => shell.status === "active" && shell.role === "footer");

  if (selectedShell?.role === "full") {
    return {
      headerHtml: selectedShell.previewHtml,
      footerHtml: ""
    };
  }

  if (selectedShell?.role === "navbar") {
    return {
      headerHtml: selectedShell.previewHtml,
      footerHtml: activeFooter?.previewHtml ?? DEFAULT_FOOTER_HTML
    };
  }

  if (selectedShell?.role === "footer") {
    return {
      headerHtml: activeNavbar?.previewHtml ?? DEFAULT_NAVBAR_HTML,
      footerHtml: selectedShell.previewHtml
    };
  }

  return {
    headerHtml: activeFull?.previewHtml ?? activeNavbar?.previewHtml ?? DEFAULT_NAVBAR_HTML,
    footerHtml: activeFull ? "" : activeFooter?.previewHtml ?? DEFAULT_FOOTER_HTML
  };
}

export function findBlockByReference(blocks: StudioBlockTemplate[], reference: string): StudioBlockTemplate | null {
  if (reference.trim().length === 0) {
    return null;
  }
  return blocks.find((block) => blockReferenceCandidates(block).includes(reference)) ?? null;
}

export function canonicalizeBlockOrder(blockOrder: string[], blocks: StudioBlockTemplate[]): string[] {
  return blockOrder.map((entry) => findBlockByReference(blocks, entry)?.key ?? entry);
}

export function buildPlatformTargetDocument(params: {
  bodyHtml: string;
  theme: StudioTheme | null;
  hostAssets: PlatformPreviewAssets;
  beforeBodyHtml?: string;
  afterBodyHtml?: string;
  additionalStylesheetHrefs?: string[];
  /** Source Tailwind config extracted from importMaster.sourceHtml (Step 2+3). */
  sourceTailwindConfig?: Record<string, unknown>;
}): string {
  // CDN-free: default to dark when no theme is loaded (matches studio aesthetic).
  // When theme is explicitly loaded, respect its darkMode flag.
  const htmlClass = params.hostAssets.platformCssSrc
    ? (params.theme === null || params.theme?.darkMode !== false ? "dark" : "")
    : (params.theme?.darkMode ? "dark" : "");

  const cssVars = buildThemeCssVars(params.theme);
  const cleanedBodyHtml = stripPreviewRuntime(params.bodyHtml);
  const cleanedBeforeBodyHtml = params.beforeBodyHtml ? toPreviewBodyHtml(params.beforeBodyHtml) : "";
  const cleanedAfterBodyHtml = params.afterBodyHtml ? toPreviewBodyHtml(params.afterBodyHtml) : "";
  const additionalStylesheets = Array.from(
    new Set(
      (params.additionalStylesheetHrefs ?? [])
        .filter((href): href is string => typeof href === "string" && href.trim().length > 0)
        .map((href) => href.trim())
    )
  )
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("");

  // CDN-free path: activated when platformCssSrc is set in hostAssets
  if (params.hostAssets.platformCssSrc) {
    const platformCssSrc = params.hostAssets.platformCssSrc;

    // Plugin theme-debt detection
    const sourceTailwindConfig = params.sourceTailwindConfig ?? {};
    const sourcePlugins: unknown[] = Array.isArray(sourceTailwindConfig["plugins"])
      ? (sourceTailwindConfig["plugins"] as unknown[])
      : [];
    detectPluginThemeDebt(sourcePlugins);

    // Canonical CSS vars block — injected at end of body (last in cascade)
    const canonicalVarsBlock = buildCanonicalCssVarsBlock(params.theme);

    const structuralStyle = [
      `<style>`,
      cssVars ? `:root{${cssVars}}` : "",
      `html,body{margin:0;padding:0;min-height:100%}`,
      `.lmnas-preview-shell{display:block}`,
      `.lmnas-target-main{display:block}`,
      `</style>`
    ].join("");

    return [
      `<!doctype html><html class="${htmlClass}" lang="en"><head>`,
      `<meta charset="utf-8"/>`,
      `<meta name="viewport" content="width=device-width,initial-scale=1"/>`,
      // CDN-free: only platform CSS governs styling.
      // Source stylesheets (Google Fonts, serif fonts, custom CSS) are intentionally
      // excluded — they carry source-specific fonts and colors that would override
      // the platform design system. Only studio-runtime.css applies.
      // 1. Structural (non-theme) styles
      structuralStyle,
      // 2. Platform compiled CSS — canonical @theme defaults
      `<link rel="stylesheet" href="${platformCssSrc}">`,
      `</head>`,
      `<body class="bg-background-light text-foreground-light dark:bg-background-dark dark:text-foreground-dark font-display antialiased">`,
      cleanedBeforeBodyHtml
        ? `<div class="lmnas-preview-shell">${cleanedBeforeBodyHtml}</div>`
        : "",
      cleanedBodyHtml,
      cleanedAfterBodyHtml
        ? `<div class="lmnas-preview-shell">${cleanedAfterBodyHtml}</div>`
        : "",
      // 3. Canonical vars override at very end of body — always wins
      canonicalVarsBlock,
      `</body></html>`
    ].join("");
  }

  // Legacy CDN path (page preview pipeline — unchanged)
  const runtimeSrc = params.hostAssets.tailwindRuntimeSrc ?? DEFAULT_TAILWIND_RUNTIME_SRC;
  const backgroundLight = themeTokenValue(params.theme, ["background-light", "surface-light", "surface", "background", "bg"], "#f6f6f8", 1);
  const backgroundDark = themeTokenValue(params.theme, ["background-dark", "surface-dark", "background", "bg"], "#101622", 2);
  const textLight = themeTokenValue(params.theme, ["text-light", "foreground-light", "text", "foreground"], "#0f172a");
  const textDark = themeTokenValue(params.theme, ["text-dark", "foreground-dark", "text", "foreground"], "#e2e8f0");

  return [
    `<!doctype html><html class="${htmlClass}" lang="en"><head>`,
    "<meta charset=\"utf-8\"/>",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>",
    params.hostAssets.headMarkup,
    additionalStylesheets,
    "<style>",
    `:root{${cssVars}}`,
    "html,body{margin:0;padding:0;min-height:100%}",
    `body{font-family:var(--font-display,\"Manrope\"),\"Segoe UI\",sans-serif;background:${backgroundLight};color:${textLight}}`,
    `html.dark body{background:${backgroundDark};color:${textDark}}`,
    ".lmnas-preview-shell{display:block}",
    ".lmnas-target-main{display:block}",
    "</style>",
    buildTailwindRuntimeConfig(params.theme),
    `<script src="${runtimeSrc}"><\/script>`,
    "</head>",
    `<body class="bg-background-light text-foreground-light dark:bg-background-dark dark:text-foreground-dark font-display antialiased">`,
    cleanedBeforeBodyHtml ? `<div class="lmnas-preview-shell">${cleanedBeforeBodyHtml}</div>` : "",
    cleanedBodyHtml,
    cleanedAfterBodyHtml ? `<div class="lmnas-preview-shell">${cleanedAfterBodyHtml}</div>` : "",
    "</body></html>"
  ].join("");
}

export function buildPlatformBlockPreviewDocument(params: {
  proposalHtml: string;
  theme: StudioTheme | null;
  hostAssets: PlatformPreviewAssets;
  additionalStylesheetHrefs?: string[];
  /** Source Tailwind config for plugin theme-debt detection (CDN-free path). */
  sourceTailwindConfig?: Record<string, unknown>;
}): string {
  const proposalBody = toPreviewBodyHtml(params.proposalHtml);
  return buildPlatformTargetDocument({
    bodyHtml: proposalBody.length > 0 ? `<main class="lmnas-target-main">${proposalBody}</main>` : "<main></main>",
    theme: params.theme,
    hostAssets: params.hostAssets,
    additionalStylesheetHrefs: params.additionalStylesheetHrefs,
    sourceTailwindConfig: params.sourceTailwindConfig
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function buildPlatformPagePreviewDocument(params: {
  page: StudioPageDocument | null;
  blocks: StudioBlockTemplate[];
  shells: StudioShell[];
  themes: StudioTheme[];
  hostAssets: PlatformPreviewAssets;
  previewThemeId?: string | null;
  previewTheme?: StudioTheme | null;
  fallbackHtml?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}): string {
  if (!params.page) {
    return buildPreviewPlaceholderDocument(params.emptyTitle ?? "No preview available", params.emptyDescription);
  }

  const composition = buildCanonicalPageComposition({
    page: {
      ...params.page,
      blockOrder: canonicalizeBlockOrder(params.page.blockOrder, params.blocks)
    },
    blocks: params.blocks,
    shells: params.shells,
    sourceUrl: "studio-preview"
  });
  const fallbackBody = params.fallbackHtml ? toPreviewBodyHtml(params.fallbackHtml) : "";
  const bodyHtml =
    composition.bodyHtml.trim().length > 0 && !composition.bodyHtml.includes("No blocks composed yet.")
      ? composition.bodyHtml
      : fallbackBody.length > 0
        ? fallbackBody
        : composition.bodyHtml;
  const theme = resolvePlatformPreviewTheme({
    themes: params.themes,
    previewThemeId: params.previewThemeId,
    previewTheme: params.previewTheme,
    themeKey: params.page.themeKey ?? null
  });
  const shell = resolvePlatformShellPreview({
    shells: params.shells,
    shellKey: params.page.shellKey ?? params.page.activeShellId ?? null
  });

  return buildPlatformTargetDocument({
    bodyHtml,
    theme,
    hostAssets: params.hostAssets,
    beforeBodyHtml: composition.headerHtml || shell.headerHtml,
    afterBodyHtml: composition.footerHtml || shell.footerHtml,
    additionalStylesheetHrefs: composition.stylesheetRefs
  });
}
