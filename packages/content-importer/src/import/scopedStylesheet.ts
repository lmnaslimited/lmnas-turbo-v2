import { createHash } from "node:crypto";
import type { SanitizedDomRoot } from "./domSanitizer.js";

export type ScopedStylesheetInput = {
  domJson: SanitizedDomRoot;
  classMap: Record<string, string>;
  cssText: string;
  themeKey?: string;
};

export type ScopedStylesheetOutput = {
  wrapperId: string;
  stylesheetRef: string;
  css: string;
};

export function generateWrapperId(input: { domJson: SanitizedDomRoot; classMap: Record<string, string>; themeKey?: string }): string {
  const hashSource =
    stableStringify(input.domJson) + stableStringify(input.classMap) + stableStringify(input.themeKey ?? "default");

  const digest = createHash("sha256").update(hashSource).digest("hex").slice(0, 12);
  return `imported-${digest}`;
}

export function generateScopedStylesheet(input: ScopedStylesheetInput): ScopedStylesheetOutput {
  const wrapperId = generateWrapperId({
    domJson: input.domJson,
    classMap: input.classMap,
    themeKey: input.themeKey
  });

  const css = scopeCssText(input.cssText, wrapperId);

  return {
    wrapperId,
    stylesheetRef: `/generated/imported/${wrapperId}.css`,
    css
  };
}

export function scopeCssText(cssText: string, wrapperId: string): string {
  const normalized = cssText.trim();
  if (!normalized) {
    return "@layer components {\n}\n";
  }

  const flatRules = parseFlatCssRules(normalized);
  if (flatRules.length === 0) {
    return "@layer components {\n}\n";
  }

  const scopedRules = flatRules.map((rule) => {
    const scopedSelector = rule.selector
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => (part.startsWith(`#${wrapperId}`) ? part : `#${wrapperId} ${part}`))
      .join(", ");

    return `  ${scopedSelector} { ${rule.body.trim()} }`;
  });

  return `@layer components {\n${scopedRules.join("\n")}\n}\n`;
}

type CssRule = {
  selector: string;
  body: string;
};

function parseFlatCssRules(cssText: string): CssRule[] {
  const rules: CssRule[] = [];
  const pattern = /([^{}]+)\{([^{}]+)\}/g;
  let match: RegExpExecArray | null = pattern.exec(cssText);

  while (match) {
    const selector = match[1].trim();
    const body = match[2].trim().replace(/\s+/g, " ");
    if (selector && body && !selector.startsWith("@")) {
      rules.push({ selector, body });
    }
    match = pattern.exec(cssText);
  }

  return rules;
}

function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, val]) => [key, sortKeys(val)]));
  }

  return value;
}
