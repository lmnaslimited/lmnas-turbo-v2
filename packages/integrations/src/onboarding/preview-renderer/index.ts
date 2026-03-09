import type {
  OnboardingActionProposal,
  OnboardingBlockProposal,
  OnboardingShellCandidate,
  OnboardingSourceStyleProfile,
  OnboardingWidgetProposal
} from "@lmnas/contracts";
import {
  buildThemeScopeClass,
  extractFontLinks,
  extractIconFontLinks,
  extractStyleAssetsFromHtml,
  extractTailwindCdnScript,
  extractTailwindInlineConfig,
  hasFullHtmlDocument,
  hasTailwindUtilityClasses,
  sanitizePreviewHtml,
  stripTags,
  wrapSnippetAsPreviewDocument
} from "../shared/html";

export type StyledSourcePreview = {
  referencePreviewHtml: string;
  productionPreviewHtml: string;
  rawMarkupPreview?: string;
  baseUrl?: string;
  themeScopeClass: string;
  styleProfile: OnboardingSourceStyleProfile;
};

function resolveBaseUrl(sourceRef: string): string | undefined {
  try {
    const parsed = new URL(sourceRef);
    return `${parsed.origin}${parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`}`;
  } catch {
    return undefined;
  }
}

function injectHeadElements(html: string, headHtml: string): string {
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, (_match, attrs: string) => `<head${attrs}>${headHtml}`);
  }

  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, (_match, attrs: string) => `<html${attrs}><head>${headHtml}</head>`);
  }

  return `<!doctype html><html><head>${headHtml}</head><body>${html}</body></html>`;
}

function ensureBodyThemeClass(html: string, themeScopeClass: string): string {
  if (/<body[\s>]/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, (_match, attrs: string) => {
      const classMatch = attrs.match(/\bclass=["']([^"']*)["']/i);
      if (!classMatch) {
        return `<body${attrs} class="${themeScopeClass}">`;
      }

      const existing = classMatch[1];
      const nextClass = existing.includes(themeScopeClass) ? existing : `${existing} ${themeScopeClass}`.trim();
      return `<body${attrs.replace(classMatch[0], `class="${nextClass}"`)}>`;
    });
  }

  return html.replace(/<\/head>/i, `</head><body class="${themeScopeClass}">`) + "</body>";
}

export function buildStyledSourcePreview(params: {
  sourceHtml: string;
  sourceRef: string;
  themeKey: string;
}): StyledSourcePreview {
  const sanitizedHtml = sanitizePreviewHtml(params.sourceHtml);
  const themeScopeClass = buildThemeScopeClass(params.themeKey);
  const baseUrl = resolveBaseUrl(params.sourceRef);
  const styleAssets = extractStyleAssetsFromHtml(sanitizedHtml);
  const unresolvedStylesheetCount =
    baseUrl === undefined
      ? styleAssets.stylesheetLinks.filter((link) => /href=["']\//i.test(link)).length
      : 0;

  const styleProfile: OnboardingSourceStyleProfile = {
    appliedStrategy: "source_document",
    inlineStyleTagCount: styleAssets.styleTags.length,
    linkedStylesheetCount: styleAssets.stylesheetLinks.length,
    unresolvedStylesheetCount,
    fidelityNotes: []
  };

  if (styleAssets.styleTags.length === 0 && styleAssets.stylesheetLinks.length === 0) {
    styleProfile.fidelityNotes.push("No stylesheet tags found. Preview may rely on browser defaults.");
    styleProfile.appliedStrategy = "unstyled_fallback";
  }

  if (unresolvedStylesheetCount > 0) {
    styleProfile.fidelityNotes.push(
      `${unresolvedStylesheetCount} stylesheet link(s) use root-relative paths without a URL base and may not resolve.`
    );
  }

  const fontLinks = extractFontLinks(sanitizedHtml);
  const iconFontLinks = extractIconFontLinks(sanitizedHtml);
  const tailwindCdn = extractTailwindCdnScript(sanitizedHtml);
  const tailwindConfig = extractTailwindInlineConfig(sanitizedHtml);
  const needsTailwind = !tailwindCdn && hasTailwindUtilityClasses(sanitizedHtml);

  if (tailwindCdn) {
    styleProfile.fidelityNotes.push("Source includes Tailwind CDN. Using project's Tailwind setup for preview.");
  } else if (needsTailwind) {
    styleProfile.fidelityNotes.push("Source uses Tailwind utility classes. Using project's Tailwind setup for preview.");
  }

  if (fontLinks.length > 0) {
    styleProfile.fidelityNotes.push(`${fontLinks.length} Google Font(s) detected and preserved.`);
  }

  const allFontLinks = Array.from(new Set([...fontLinks, ...iconFontLinks]));

  // For full HTML documents, only inject the minimal preview-interaction overlay
  // – the source already has its own Tailwind CDN, config, fonts, etc.
  // For fragment/snippet HTML (no <html>/<body>), inject all resources via wrapSnippetAsPreviewDocument.
  const isFullDocument = hasFullHtmlDocument(sanitizedHtml);

  const previewOverlayStyles = isFullDocument
    ? [
      "<style>",
      ".lmnas-source-item{outline:2px solid transparent;outline-offset:2px;cursor:pointer;transition:outline-color .15s ease;}",
      ".lmnas-source-item:hover{outline-color:#5aa2ff;}",
      ".lmnas-source-item-active{outline-color:#0b66ff !important;box-shadow:0 0 0 2px rgba(11,102,255,.2);}",
      "</style>"
    ].join("")
    : [
      "<meta charset='utf-8'/>",
      "<meta name='viewport' content='width=device-width, initial-scale=1'/>",
      baseUrl ? `<base href="${baseUrl}">` : "",
      ...allFontLinks,
      tailwindConfig ?? "",
      "<style>",
      "body{margin:0;font-family:Manrope,Segoe UI,sans-serif;}",
      ".lmnas-source-item{outline:2px solid transparent;outline-offset:2px;cursor:pointer;transition:outline-color .15s ease;}",
      ".lmnas-source-item:hover{outline-color:#5aa2ff;}",
      ".lmnas-source-item-active{outline-color:#0b66ff !important;box-shadow:0 0 0 2px rgba(11,102,255,.2);}",
      "</style>"
    ]
      .filter(Boolean)
      .join("");

  const previewHtml = isFullDocument
    ? ensureBodyThemeClass(injectHeadElements(sanitizedHtml, previewOverlayStyles), themeScopeClass)
    : wrapSnippetAsPreviewDocument({
      snippetHtml: sanitizedHtml,
      sourceHtmlForStyles: sanitizedHtml,
      baseUrl,
      themeScopeClass
    });

  return {
    referencePreviewHtml: previewHtml,
    productionPreviewHtml: previewHtml,
    rawMarkupPreview: sanitizedHtml.slice(0, 10000),
    baseUrl,
    themeScopeClass,
    styleProfile
  };
}

export function buildDetectionThumbnailDocument(params: {
  snippetHtml: string;
  sourcePreviewHtml: string;
  themeScopeClass: string;
  baseUrl?: string;
}): string {
  return wrapSnippetAsPreviewDocument({
    snippetHtml: sanitizePreviewHtml(params.snippetHtml),
    sourceHtmlForStyles: params.sourcePreviewHtml,
    baseUrl: params.baseUrl,
    themeScopeClass: params.themeScopeClass,
    bodyClassName: "lmnas-preview-thumbnail"
  });
}

function renderSelectedSnippet(snippet: string | undefined, fallback: string): string {
  if (snippet && stripTags(snippet).trim().length > 0) {
    return sanitizePreviewHtml(snippet);
  }

  return fallback;
}

export function buildFinalAssemblyPreviewDocument(params: {
  sourcePreviewHtml: string;
  baseUrl?: string;
  themeScopeClass: string;
  shellCandidates: OnboardingShellCandidate[];
  blockProposals: OnboardingBlockProposal[];
  widgetProposals: OnboardingWidgetProposal[];
  actionProposals: OnboardingActionProposal[];
}): string {
  const navbar = params.shellCandidates.find((candidate) => candidate.type === "navbar");
  const utility = params.shellCandidates.find((candidate) => candidate.type === "utility_bar");
  const announcement = params.shellCandidates.find((candidate) => candidate.type === "announcement_bar");
  const footer = params.shellCandidates.find((candidate) => candidate.type === "footer");

  const blocksHtml = params.blockProposals
    .map((block) => {
      const title = block.displayName ?? block.id;
      return [
        "<section class='lmnas-assembly-block'>",
        `<div class='lmnas-assembly-block-meta'>${title} (${block.family})</div>`,
        renderSelectedSnippet(block.previewHtml ?? block.rawHtmlSnippet, `<div>${title}</div>`),
        "</section>"
      ].join("");
    })
    .join("");

  const widgetsHtml =
    params.widgetProposals.length > 0
      ? [
        "<aside class='lmnas-assembly-widgets'>",
        "<h4>Widgets</h4>",
        "<ul>",
        ...params.widgetProposals.map(
          (widget) =>
            `<li><strong>${widget.displayName ?? widget.name}</strong> <span>(${widget.widgetType})</span></li>`
        ),
        "</ul>",
        "</aside>"
      ].join("")
      : "";

  const actionsHtml =
    params.actionProposals.length > 0
      ? [
        "<aside class='lmnas-assembly-actions'>",
        "<h4>Actions</h4>",
        "<ul>",
        ...params.actionProposals.map(
          (action) =>
            `<li><strong>${action.displayName ?? action.label}</strong>: ${action.summary} (${action.actionType})</li>`
        ),
        "</ul>",
        "</aside>"
      ].join("")
      : "";

  const snippet = [
    "<div class='lmnas-assembly-root'>",
    renderSelectedSnippet(announcement?.previewHtml, ""),
    renderSelectedSnippet(utility?.previewHtml, ""),
    renderSelectedSnippet(navbar?.previewHtml, "<header class='lmnas-assembly-placeholder'>No navbar selected</header>"),
    "<main class='lmnas-assembly-main'>",
    blocksHtml || "<section class='lmnas-assembly-placeholder'>No blocks selected</section>",
    "</main>",
    widgetsHtml,
    actionsHtml,
    renderSelectedSnippet(footer?.previewHtml, "<footer class='lmnas-assembly-placeholder'>No footer selected</footer>"),
    "</div>"
  ].join("");

  return wrapSnippetAsPreviewDocument({
    snippetHtml: snippet,
    sourceHtmlForStyles: params.sourcePreviewHtml,
    baseUrl: params.baseUrl,
    themeScopeClass: params.themeScopeClass
  });
}
