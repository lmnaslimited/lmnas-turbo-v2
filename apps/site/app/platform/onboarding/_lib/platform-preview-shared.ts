import { sanitizeHtmlToSafeMarkup } from "../../../../lib/studio-html-sanitizer";
import { buildCanonicalPageComposition } from "../../../../lib/studio-canonical";
import type { StudioBlockTemplate, StudioPageDocument, StudioShell, StudioTheme } from "./studio-types";

export type PlatformPreviewAssets = {
  headMarkup: string;
  tailwindRuntimeSrc: string | null;
};

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

export function sanitizeTargetHtml(input: string): string {
  const stripped = stripPreviewRuntime(input).replace(/<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi, "");
  return sanitizeHtmlToSafeMarkup(extractBodyHtml(ensureHtmlDocument(stripped)), "studio-preview");
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
}): string {
  const htmlClass = params.theme?.darkMode ? "dark" : "";
  const cssVars = buildThemeCssVars(params.theme);
  const runtimeSrc = params.hostAssets.tailwindRuntimeSrc ?? DEFAULT_TAILWIND_RUNTIME_SRC;
  const backgroundLight = themeTokenValue(params.theme, ["background-light", "surface-light", "surface", "background", "bg"], "#f6f6f8", 1);
  const backgroundDark = themeTokenValue(params.theme, ["background-dark", "surface-dark", "background", "bg"], "#101622", 2);
  const textLight = themeTokenValue(params.theme, ["text-light", "foreground-light", "text", "foreground"], "#0f172a");
  const textDark = themeTokenValue(params.theme, ["text-dark", "foreground-dark", "text", "foreground"], "#e2e8f0");
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
}): string {
  const proposalBody = toPreviewBodyHtml(params.proposalHtml);
  return buildPlatformTargetDocument({
    bodyHtml: proposalBody.length > 0 ? `<main class="lmnas-target-main">${proposalBody}</main>` : "<main></main>",
    theme: params.theme,
    hostAssets: params.hostAssets,
    additionalStylesheetHrefs: params.additionalStylesheetHrefs
  });
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
