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

// Compatibility helpers for frontend preview.
// These generate HTML strings for the legacy iframe-based preview surfaces
// but utilize the canonical domJson as the source of truth.

export function renderCanonicalBlockMarkup(block: StudioBlockTemplate): { bodyHtml: string } {
  if (!block.domJson) {
    return { bodyHtml: "" };
  }
  return {
    bodyHtml: serializeSanitizedDomToHtml(block.domJson)
  };
}

export function buildCanonicalPageComposition(params: {
  page: StudioPageDocument;
  blocks: StudioBlockTemplate[];
  sourceUrl?: string;
}): { bodyHtml: string; stylesheetRefs: string[] } {
  const bodies: string[] = [];
  const stylesheets = new Set<string>();

  params.page.blockOrder.forEach((ref) => {
    const block = params.blocks.find((b) => b.id === ref || b.key === ref);
    if (block) {
      bodies.push(renderCanonicalBlockMarkup(block).bodyHtml);
      if (block.stylesheetRef) {
        stylesheets.add(block.stylesheetRef);
      }
    }
  });

  return {
    bodyHtml: bodies.join("\n"),
    stylesheetRefs: Array.from(stylesheets)
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
    "--color-primary": themeTokenValue(theme, ["primary", "accent"], "#135bec"),
    "--color-background-light": themeTokenValue(theme, ["background-light", "surface-light", "surface", "background", "bg"], "#f6f6f8"),
    "--color-background-dark": themeTokenValue(theme, ["background-dark", "surface-dark", "background", "bg"], "#101622"),
    "--color-foreground-light": themeTokenValue(theme, ["foreground-light", "text-light", "text", "foreground"], "#0f172a"),
    "--color-foreground-dark": themeTokenValue(theme, ["foreground-dark", "text-dark", "text", "foreground"], "#e2e8f0"),
    "--font-display": themeTokenValue(theme, ["font-display", "font", "typography.font.1"], "Manrope, sans-serif")
  };

  theme.tokens.forEach((token) => {
    if (token.cssVariable.startsWith("--") && token.value.trim().length > 0) {
      vars[token.cssVariable] = token.value.trim();
    }
  });

  return vars as CSSProperties;
}
