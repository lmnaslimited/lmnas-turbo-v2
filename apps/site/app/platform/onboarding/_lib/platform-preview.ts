"use client";

import { useEffect, useState } from "react";
import {
  buildPlatformBlockPreviewDocument,
  buildPlatformPagePreviewDocument,
  buildPlatformTargetDocument,
  buildPreviewPlaceholderDocument,
  buildPreviewThumbnailDocument,
  canonicalizeBlockOrder,
  createStaticPlatformPreviewAssets,
  ensureHtmlDocument,
  extractBodyHtml,
  findBlockByReference,
  resolvePlatformPreviewTheme,
  resolvePlatformShellPreview,
  sanitizeTargetHtml,
  type PlatformPreviewAssets
} from "./platform-preview-shared";

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
    return createStaticPlatformPreviewAssets();
  }

  const origin = window.location.origin;
  const parts = [`<link rel="stylesheet" href="${origin}/studio-runtime.css">`];

  document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) {
      return;
    }
    const absoluteHref = toAbsoluteAssetUrl(href, origin);
    if (!parts.includes(`<link rel="stylesheet" href="${absoluteHref}">`)) {
      parts.push(`<link rel="stylesheet" href="${absoluteHref}">`);
    }
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

export function usePlatformPreviewAssets(): PlatformPreviewAssets {
  const [assets, setAssets] = useState<PlatformPreviewAssets>(createStaticPlatformPreviewAssets());

  useEffect(() => {
    setAssets(buildHeadMarkup());
  }, []);

  return assets;
}

export {
  buildPlatformBlockPreviewDocument,
  buildPlatformPagePreviewDocument,
  buildPlatformTargetDocument,
  buildPreviewPlaceholderDocument,
  buildPreviewThumbnailDocument,
  canonicalizeBlockOrder,
  createStaticPlatformPreviewAssets,
  ensureHtmlDocument,
  extractBodyHtml,
  findBlockByReference,
  resolvePlatformPreviewTheme,
  resolvePlatformShellPreview,
  sanitizeTargetHtml
};
export type { PlatformPreviewAssets };
