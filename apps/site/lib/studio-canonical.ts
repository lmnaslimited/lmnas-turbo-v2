import type { CSSProperties } from "react";
import type {
  StudioBlockTemplate,
  StudioPageDocument,
  StudioShell,
  StudioTheme
} from "../app/platform/onboarding/_lib/studio-types";
import {
  sanitizeDomToJson,
  sanitizeHtmlToSafeMarkup,
  serializeSanitizedDomToHtml,
  type SanitizedDomElementNode,
  type SanitizedDomNode,
  type SanitizedDomRoot
} from "./studio-html-sanitizer";

const DEFAULT_STYLESHEET_REF = "/studio-runtime.css";
const RUNTIME_ARTIFACT_PATTERNS = [
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?/i,
  /_next\/static/i,
  /<script\b/i
] as const;

function extractBodyHtmlFragment(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return typeof bodyMatch?.[1] === "string" ? bodyMatch[1] : trimmed;
}

function themeTokenValue(theme: StudioTheme | null, matchers: string[], fallback: string): string {
  if (!theme) {
    return fallback;
  }

  const match = theme.tokens.find((token) => matchers.some((matcher) => token.key.toLowerCase().includes(matcher)));
  return typeof match?.value === "string" && match.value.trim().length > 0 ? match.value.trim() : fallback;
}

function findFirstElementPath(root: SanitizedDomRoot): string | null {
  const visit = (nodes: SanitizedDomNode[], parentPath: string): string | null => {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (node.kind !== "element") {
        continue;
      }

      const pathKey = parentPath ? `${parentPath}.${index}` : `${index}`;
      return pathKey;
    }
    return null;
  };

  return visit(root.children, "");
}

function mergeClassNames(existing: string | undefined, extra: string | undefined): string | undefined {
  const merged = [existing, extra]
    .flatMap((value) => (typeof value === "string" ? value.split(/\s+/) : []))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (merged.length === 0) {
    return undefined;
  }
  return Array.from(new Set(merged)).join(" ");
}

function cloneAndMergeNode(node: SanitizedDomNode, pathKey: string, classMap: Record<string, string>): SanitizedDomNode {
  if (node.kind === "text") {
    return {
      kind: "text",
      text: node.text
    };
  }

  const mergedClass = mergeClassNames(node.attributes.class, classMap[pathKey]);
  const attributes = {
    ...node.attributes
  };
  if (mergedClass) {
    attributes.class = mergedClass;
  }

  return {
    kind: "element",
    tag: node.tag,
    attributes,
    children: node.children.map((child, index) => cloneAndMergeNode(child, `${pathKey}.${index}`, classMap))
  } satisfies SanitizedDomElementNode;
}

function resolveWrapperId(stylesheetRef: string | undefined): string | null {
  if (typeof stylesheetRef !== "string" || stylesheetRef.trim().length === 0) {
    return null;
  }
  const match = stylesheetRef.match(/\/generated\/imported\/([^/.]+)\.css$/i);
  return typeof match?.[1] === "string" && match[1].trim().length > 0 ? match[1].trim() : null;
}

export function containsRuntimeArtifacts(value: unknown): boolean {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }
  return RUNTIME_ARTIFACT_PATTERNS.some((pattern) => pattern.test(value));
}

export function firstRuntimeArtifact(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const match = RUNTIME_ARTIFACT_PATTERNS.find((pattern) => pattern.test(value));
  return match ? match.source : null;
}

export function createCanonicalBlockSnapshot(params: {
  html: string;
  sourceUrl: string;
  themeScopeClass?: string;
  stylesheetRef?: string;
}): Pick<StudioBlockTemplate, "blockType" | "domJson" | "classMap" | "stylesheetRef"> {
  const bodyHtml = extractBodyHtmlFragment(params.html);
  const domJson = sanitizeDomToJson(bodyHtml, params.sourceUrl);
  const rootPath = findFirstElementPath(domJson);
  const classMap =
    rootPath && params.themeScopeClass
      ? {
          [rootPath]: params.themeScopeClass
        }
      : {};

  return {
    blockType: "imported_dom_snapshot",
    domJson,
    classMap,
    stylesheetRef: params.stylesheetRef ?? DEFAULT_STYLESHEET_REF
  };
}

export function renderCanonicalBlockMarkup(block: Pick<StudioBlockTemplate, "domJson" | "classMap" | "stylesheetRef" | "blockType">): {
  bodyHtml: string;
  stylesheetRefs: string[];
} {
  if (!block.domJson) {
    return {
      bodyHtml: "",
      stylesheetRefs: []
    };
  }

  const mergedRoot: SanitizedDomRoot = {
    kind: "root",
    children: block.domJson.children.map((child, index) => cloneAndMergeNode(child, `${index}`, block.classMap ?? {}))
  };
  const wrapperId = resolveWrapperId(block.stylesheetRef);
  const bodyHtml = serializeSanitizedDomToHtml(mergedRoot);
  const wrappedHtml =
    wrapperId && bodyHtml.trim().length > 0
      ? `<section id="${wrapperId}" data-block-type="${block.blockType ?? "imported_dom_snapshot"}">${bodyHtml}</section>`
      : bodyHtml;

  return {
    bodyHtml: wrappedHtml,
    stylesheetRefs: block.stylesheetRef ? [block.stylesheetRef] : []
  };
}

function shellMarkup(shellHtml: string | undefined, sourceUrl: string): string {
  if (typeof shellHtml !== "string" || shellHtml.trim().length === 0) {
    return "";
  }
  return sanitizeHtmlToSafeMarkup(extractBodyHtmlFragment(shellHtml), sourceUrl);
}

function blockMatchesReference(block: StudioBlockTemplate, reference: string): boolean {
  return [block.key, block.id].some((candidate) => candidate === reference);
}

export function buildCanonicalPageComposition(params: {
  page: StudioPageDocument;
  blocks: StudioBlockTemplate[];
  shells?: StudioShell[];
  sourceUrl: string;
}): {
  bodyHtml: string;
  headerHtml: string;
  footerHtml: string;
  stylesheetRefs: string[];
  missingBlockKeys: string[];
} {
  const stylesheets = new Set<string>();
  const missingBlockKeys: string[] = [];
  const sections = params.page.blockOrder
    .map((reference) => {
      const block = params.blocks.find((candidate) => blockMatchesReference(candidate, reference));
      if (!block) {
        missingBlockKeys.push(reference);
        return "";
      }

      const rendered = renderCanonicalBlockMarkup({
        blockType: block.blockType,
        domJson: block.domJson,
        classMap: block.classMap,
        stylesheetRef: block.stylesheetRef
      });
      rendered.stylesheetRefs.forEach((href) => stylesheets.add(href));
      if (rendered.bodyHtml.trim().length > 0) {
        return rendered.bodyHtml;
      }
      return sanitizeHtmlToSafeMarkup(block.previewHtml, params.sourceUrl);
    })
    .filter((entry) => entry.trim().length > 0);

  const selectedShell = params.shells?.find((shell) => shell.key === params.page.shellKey || shell.id === params.page.shellKey) ?? null;
  const activeNavbar = params.shells?.find((shell) => shell.status === "active" && shell.role === "navbar") ?? null;
  const activeFooter = params.shells?.find((shell) => shell.status === "active" && shell.role === "footer") ?? null;
  const headerHtml =
    selectedShell?.role === "full" || selectedShell?.role === "navbar"
      ? shellMarkup(selectedShell.previewHtml, params.sourceUrl)
      : shellMarkup(activeNavbar?.previewHtml, params.sourceUrl);
  const footerHtml =
    selectedShell?.role === "full" || selectedShell?.role === "footer"
      ? selectedShell?.role === "full"
        ? ""
        : shellMarkup(selectedShell.previewHtml, params.sourceUrl)
      : shellMarkup(activeFooter?.previewHtml, params.sourceUrl);

  return {
    bodyHtml:
      sections.join("\n") ||
      "<section style=\"padding:48px;font-family:system-ui\"><h2>No blocks composed yet.</h2><p>Add reusable blocks before previewing this page.</p></section>",
    headerHtml,
    footerHtml,
    stylesheetRefs: Array.from(stylesheets),
    missingBlockKeys
  };
}

export function themeIsDarkMode(theme: StudioTheme | null): boolean {
  if (!theme) {
    return false;
  }
  return theme.themeMode === "dark" || (theme.themeMode !== "light" && theme.darkMode);
}

export function buildStudioThemeCssVariables(theme: StudioTheme | null): CSSProperties {
  if (!theme) {
    return {};
  }

  const vars: Record<string, string> = {
    "--theme-primary": themeTokenValue(theme, ["primary", "accent"], "#135bec"),
    "--theme-background-light": themeTokenValue(theme, ["background-light", "surface-light", "surface", "background", "bg"], "#f6f6f8"),
    "--theme-background-dark": themeTokenValue(theme, ["background-dark", "surface-dark", "background", "bg"], "#101622"),
    "--theme-foreground-light": themeTokenValue(theme, ["foreground-light", "text-light", "text", "foreground"], "#0f172a"),
    "--theme-foreground-dark": themeTokenValue(theme, ["foreground-dark", "text-dark", "text", "foreground"], "#e2e8f0"),
    "--theme-font-display": themeTokenValue(theme, ["font-display", "font", "typography.font.1"], "Manrope, sans-serif")
  };

  theme.tokens.forEach((token) => {
    if (token.cssVariable.startsWith("--") && token.value.trim().length > 0) {
      vars[token.cssVariable] = token.value.trim();
    }
  });

  return vars as CSSProperties;
}
