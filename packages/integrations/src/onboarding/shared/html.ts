export type AnchorCandidate = {
  href: string;
  label: string;
  selectorHint: string;
  htmlSnippet: string;
};

export type ButtonCandidate = {
  label: string;
  selectorHint: string;
  type: string;
  htmlSnippet: string;
};

export function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

export function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TRUSTED_CDN_PATTERNS = [
  /fonts\.googleapis\.com/i,
  /fonts\.gstatic\.com/i,
  /cdnjs\.cloudflare\.com/i,
  /unpkg\.com/i,
  /cdn\.jsdelivr\.net/i
];

function isTrustedCdnScript(scriptTag: string): boolean {
  const srcMatch = scriptTag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  if (srcMatch) {
    return TRUSTED_CDN_PATTERNS.some((pattern) => pattern.test(srcMatch[1]));
  }

  // Strip inline scripts that configure tailwind
  const idMatch = scriptTag.match(/\bid\s*=\s*["']([^"']+)["']/i);
  if (idMatch && idMatch[1].includes("tailwind")) {
    return false;
  }

  // Strip inline scripts that contain only tailwind.config assignment
  const bodyMatch = scriptTag.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  if (bodyMatch) {
    const body = bodyMatch[1].trim();
    if (/^tailwind\.config\s*=\s*\{/.test(body) && !/<script/i.test(body)) {
      return false;
    }
  }

  return false;
}

export function sanitizePreviewHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (match) => {
      return isTrustedCdnScript(match) ? match : "";
    })
    .replace(/\son\w+\s*=\s*['"][^'"]*['"]/gi, "")
    .replace(/javascript:/gi, "");
}

export function extractFontLinks(html: string): string[] {
  return Array.from(
    html.matchAll(/<link\b[^>]*href=["'][^"']*fonts\.googleapis\.com[^"']*["'][^>]*>/gi)
  ).map((match) => match[0]);
}

export function extractIconFontLinks(html: string): string[] {
  return Array.from(
    html.matchAll(/<link\b[^>]*href=["'][^"']*(?:fonts\.googleapis\.com\/css2\?family=Material|material-icons|fontawesome)[^"']*["'][^>]*>/gi)
  ).map((match) => match[0]);
}

export function extractTailwindCdnScript(html: string): string | undefined {
  const match = html.match(/<script\b[^>]*src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>\s*<\/script>/i);
  return match ? match[0] : undefined;
}

export function extractTailwindInlineConfig(html: string): string | undefined {
  const match = html.match(/<script\b[^>]*>[\s\S]*?tailwind\.config\s*=\s*\{[\s\S]*?\}\s*<\/script>/i);
  return match ? match[0] : undefined;
}

export function hasTailwindUtilityClasses(html: string): boolean {
  const tailwindPatterns = [
    /\bclass=["'][^"']*\b(?:flex|grid|hidden|block|inline|relative|absolute|fixed)\b/,
    /\bclass=["'][^"']*\b(?:bg-|text-|border-|rounded-|p-|m-|w-|h-|gap-|max-w-)/,
    /\bclass=["'][^"']*\b(?:font-bold|font-medium|font-light|font-semibold)\b/,
    /\bclass=["'][^"']*\b(?:items-center|justify-center|justify-between)\b/
  ];
  return tailwindPatterns.some((pattern) => pattern.test(html));
}

export function hasFullHtmlDocument(html: string): boolean {
  return /<html[\s>]/i.test(html) || /<body[\s>]/i.test(html);
}

export function buildThemeScopeClass(themeKey: string): string {
  const normalized = slugify(themeKey || "default");
  return `theme-${normalized.length > 0 ? normalized : "default"}`;
}

export function extractStyleAssetsFromHtml(html: string): {
  styleTags: string[];
  stylesheetLinks: string[];
} {
  const safeHtml = sanitizePreviewHtml(html);
  const styleTags = Array.from(safeHtml.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)).map((match) => match[0]);
  const stylesheetLinks = Array.from(
    safeHtml.matchAll(/<link\b[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi)
  ).map((match) => match[0]);

  return {
    styleTags,
    stylesheetLinks
  };
}

export function wrapSnippetAsPreviewDocument(params: {
  snippetHtml: string;
  sourceHtmlForStyles: string;
  baseUrl?: string;
  themeScopeClass?: string;
  bodyClassName?: string;
}): string {
  const styles = extractStyleAssetsFromHtml(params.sourceHtmlForStyles);
  const fontLinks = extractFontLinks(params.sourceHtmlForStyles);
  const iconFontLinks = extractIconFontLinks(params.sourceHtmlForStyles);
  const tailwindConfig = extractTailwindInlineConfig(params.sourceHtmlForStyles);
  const baseTag = params.baseUrl ? `<base href="${escapeHtmlAttribute(params.baseUrl)}">` : "";
  const themeClass = params.themeScopeClass ?? "theme-default";
  const bodyClassName = params.bodyClassName ?? "";

  // Deduplicate font links (some may also be in stylesheetLinks)
  const allFontLinks = Array.from(new Set([...fontLinks, ...iconFontLinks]));

  // Determine if source was dark-mode
  const isDark = /class=["'][^"']*\bdark\b/i.test(params.sourceHtmlForStyles) ||
    /<html[^>]*class=["'][^"']*\bdark\b/i.test(params.sourceHtmlForStyles);

  return [
    "<!doctype html>",
    `<html${isDark ? ' class="dark"' : ""}>`,
    "<head>",
    "<meta charset='utf-8'/>",
    "<meta name='viewport' content='width=device-width, initial-scale=1'/>",
    baseTag,
    ...allFontLinks,
    ...styles.stylesheetLinks,
    tailwindConfig ?? "",
    ...styles.styleTags,
    "<style>",
    "body{margin:0;padding:0;font-family:Manrope,Segoe UI,sans-serif;}",
    ".lmnas-preview-root{min-height:100%;}",
    ".lmnas-preview-thumbnail{padding:8px;}",
    ".lmnas-source-item{outline:2px solid transparent;outline-offset:2px;cursor:pointer;transition:outline-color .15s ease;}",
    ".lmnas-source-item:hover{outline-color:#5aa2ff;}",
    ".lmnas-source-item-active{outline-color:#0b66ff !important;box-shadow:0 0 0 2px rgba(11,102,255,.2);}",
    "</style>",
    "</head>",
    `<body class="${escapeHtmlAttribute(`${themeClass} ${bodyClassName}`.trim())}">`,
    "<div class='lmnas-preview-root'>",
    params.snippetHtml,
    "</div>",
    "</body>",
    "</html>"
  ].join("");
}

export function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return undefined;
  }

  const value = stripTags(match[1]);
  return value.length > 0 ? value : undefined;
}

export function extractSections(html: string): string[] {
  const matches = Array.from(html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/gi)).map((match) => match[0]);
  if (matches.length > 0) {
    return matches;
  }

  const articleMatches = Array.from(html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)).map((match) => match[0]);
  if (articleMatches.length > 0) {
    return articleMatches;
  }

  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    return [bodyMatch[1]];
  }

  return [html];
}

export function extractAnchors(html: string): AnchorCandidate[] {
  const matches = Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));

  return matches
    .map((match, index) => {
      const href = match[1].trim();
      const label = stripTags(match[2]);
      if (!href || !label) {
        return undefined;
      }

      return {
        href,
        label,
        selectorHint: `a[href='${href}']`,
        htmlSnippet: match[0]
      };
    })
    .filter((value): value is AnchorCandidate => Boolean(value));
}

export function extractButtons(html: string): ButtonCandidate[] {
  const matches = Array.from(html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi));

  return matches
    .map((match, index) => {
      const attrs = match[1] ?? "";
      const buttonType = attrs.match(/type=["']([^"']+)["']/i)?.[1] ?? "button";
      const label = stripTags(match[2]);

      if (!label) {
        return undefined;
      }

      return {
        label,
        selectorHint: `button:nth-of-type(${index + 1})`,
        type: buttonType,
        htmlSnippet: match[0]
      };
    })
    .filter((value): value is ButtonCandidate => Boolean(value));
}

export function includesAny(input: string, terms: string[]): boolean {
  const normalized = input.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}
