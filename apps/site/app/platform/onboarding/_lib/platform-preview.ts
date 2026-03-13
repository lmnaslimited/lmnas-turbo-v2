"use client";

import { useEffect, useState } from "react";
import type { StudioTheme } from "./studio-types";

export type PlatformPreviewAssets = {
  headMarkup: string;
  tailwindRuntimeSrc: string | null;
};

const DEFAULT_TAILWIND_RUNTIME_SRC = "https://cdn.tailwindcss.com?plugins=forms,container-queries";

function toAbsoluteAssetUrl(value: string, origin: string): string {
  if (value.startsWith("//")) {
    return `${window.location.protocol}${value}`;
  }
  if (value.startsWith("/")) {
    return `${origin}${value}`;
  }
  return value;
}

function buildHeadMarkup(): PlatformPreviewAssets {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return {
      headMarkup: "",
      tailwindRuntimeSrc: null
    };
  }

  const origin = window.location.origin;
  const parts: string[] = [];

  document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) {
      return;
    }
    const absoluteHref = toAbsoluteAssetUrl(href, origin);
    parts.push(`<link rel="stylesheet" href="${absoluteHref}">`);
  });

  document.querySelectorAll<HTMLStyleElement>("style").forEach((style) => {
    const text = style.textContent;
    if (!text || text.trim().length === 0) {
      return;
    }
    parts.push(`<style>${text}</style>`);
  });

  let runtimeSrc: string | null = null;
  document.querySelectorAll<HTMLScriptElement>("script[src]").forEach((script) => {
    const src = script.getAttribute("src");
    if (!src) {
      return;
    }
    if (!src.includes("cdn.tailwindcss.com") && !src.includes("@tailwindcss/browser")) {
      return;
    }
    if (runtimeSrc === null) {
      runtimeSrc = toAbsoluteAssetUrl(src, origin);
    }
  });

  return {
    headMarkup: parts.join("\n"),
    tailwindRuntimeSrc: runtimeSrc
  };
}

function themeTokenValue(theme: StudioTheme | null, matchers: string[], fallback: string): string {
  if (!theme) {
    return fallback;
  }
  const match = theme.tokens.find((token) => matchers.some((matcher) => token.key.toLowerCase().includes(matcher)));
  return typeof match?.value === "string" && match.value.trim().length > 0 ? match.value.trim() : fallback;
}

function fontFamilyArray(theme: StudioTheme | null): string[] {
  const raw = themeTokenValue(theme, ["font-display", "typography.font.1", "font"], "Manrope, sans-serif");
  return raw
    .split(",")
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ""))
    .filter((entry) => entry.length > 0);
}

function radiusValue(theme: StudioTheme | null, matcher: string, fallback: string): string {
  return themeTokenValue(theme, [matcher], fallback);
}

function buildTailwindRuntimeConfig(theme: StudioTheme | null): string {
  const config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          primary: themeTokenValue(theme, ["primary", "accent"], "#135bec"),
          "background-light": themeTokenValue(theme, ["background-light"], "#f6f6f8"),
          "background-dark": themeTokenValue(theme, ["background-dark", "background", "bg"], "#101622")
        },
        fontFamily: {
          display: fontFamilyArray(theme)
        },
        borderRadius: {
          DEFAULT: radiusValue(theme, "radius.default", "0.25rem"),
          lg: radiusValue(theme, "radius", "0.5rem"),
          xl: radiusValue(theme, "radius", "0.75rem"),
          full: radiusValue(theme, "radius.full", "9999px")
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

function stripPreviewRuntime(html: string): string {
  return html
    .replace(/<script\b[^>]*src=["'][^"']*(?:cdn\.tailwindcss\.com|@tailwindcss\/browser)[^"']*["'][^>]*>\s*<\/script>/gi, "")
    .replace(/<script\b[^>]*id=["'](?:tailwind-config|lmnas-tailwind-runtime-config|lmnas-preview-tailwind-config)["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?tailwind\.config\s*=[\s\S]*?<\/script>/gi, "");
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
  if (bodyMatch && typeof bodyMatch[1] === "string") {
    return bodyMatch[1];
  }
  return input;
}

export function sanitizeTargetHtml(input: string): string {
  return stripPreviewRuntime(input)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi, "");
}

export function buildPlatformTargetDocument(params: {
  bodyHtml: string;
  theme: StudioTheme | null;
  hostAssets: PlatformPreviewAssets;
  beforeBodyHtml?: string;
  afterBodyHtml?: string;
}): string {
  const htmlClass = params.theme?.darkMode ? "dark" : "";
  const cssVars = buildThemeCssVars(params.theme);
  const runtimeSrc = params.hostAssets.tailwindRuntimeSrc ?? DEFAULT_TAILWIND_RUNTIME_SRC;
  const cleanedBodyHtml = stripPreviewRuntime(params.bodyHtml);
  const cleanedBeforeBodyHtml = params.beforeBodyHtml ? stripPreviewRuntime(params.beforeBodyHtml) : "";
  const cleanedAfterBodyHtml = params.afterBodyHtml ? stripPreviewRuntime(params.afterBodyHtml) : "";
  const baseDocument = [
    `<!doctype html><html class="${htmlClass}" lang="en"><head>`,
    "<meta charset=\"utf-8\"/>",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>",
    params.hostAssets.headMarkup,
    `<style>:root{${cssVars}}html,body{margin:0;padding:0;min-height:100%}body{font-family:var(--font-display,\"Manrope\"),\"Segoe UI\",sans-serif}</style>`,
    buildTailwindRuntimeConfig(params.theme),
    `<script src="${runtimeSrc}"><\/script>`,
    "</head>",
    `<body class="bg-background-light dark:bg-background-dark font-display antialiased">`,
    cleanedBeforeBodyHtml,
    cleanedBodyHtml,
    cleanedAfterBodyHtml,
    "</body></html>"
  ].join("");

  return baseDocument;
}

export function usePlatformPreviewAssets(): PlatformPreviewAssets {
  const [assets, setAssets] = useState<PlatformPreviewAssets>({
    headMarkup: "",
    tailwindRuntimeSrc: null
  });

  useEffect(() => {
    setAssets(buildHeadMarkup());
  }, []);

  return assets;
}
