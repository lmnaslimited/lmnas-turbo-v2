"use client";

import React, { useMemo } from "react";
import { PageRenderer } from "@lmnas/renderer";
import type { StudioTheme } from "./studio-types";
import { sanitizeDomToJson } from "../../../../lib/studio-html-sanitizer";
import { buildStudioThemeCssVariables, themeIsDarkMode } from "../../../../lib/studio-canonical";

export type PlatformBlockPreviewProps = {
  html: string;
  sourceUrl?: string;
  theme: StudioTheme | null;
  family?: string;
  className?: string;
};

/**
 * Renders a single block proposal using the pure TSX path.
 * Converts raw HTML snippets into domJson on the fly for the preview.
 */
export function PlatformBlockPreview({
  html,
  sourceUrl,
  theme,
  family,
  className
}: PlatformBlockPreviewProps) {
  const rendererBlocks = useMemo(() => {
    // 1. Convert HTML snippet to domJson
    const domJson = sanitizeDomToJson(html || "<section></section>", sourceUrl || "about:blank");

    // 2. Prepare a single block for the renderer
    return [
      {
        type: "imported_dom_snapshot",
        domJson,
        classMap: {}, // We'll rely on the theme wrapper for global variables
        stylesheetRef: "/studio-runtime.css"
      }
    ];
  }, [html, sourceUrl]);

  const themeStyles = useMemo(() => buildStudioThemeCssVariables(theme), [theme]);
  const isDark = useMemo(() => themeIsDarkMode(theme), [theme]);

  // If no content, show placeholder
  if (!html || html.trim().length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-900 text-[10px] text-slate-500">
        Snippet empty
      </div>
    );
  }

  return (
    <div
      className={`lmnas-platform-preview-root h-full w-full overflow-hidden ${isDark ? "dark" : ""} ${className ?? ""}`}
      style={{
        ...themeStyles,
        margin: 0,
        padding: 0,
        backgroundColor: isDark ? "var(--color-background-dark, #101622)" : "var(--color-background-light, #f6f6f8)",
        color: isDark ? "var(--color-foreground-dark, #e2e8f0)" : "var(--color-foreground-light, #0f172a)"
      }}
    >
      <div className="h-full w-full flex flex-col p-0 bg-transparent">
        <PageRenderer blocks={rendererBlocks} preview={true} />
      </div>
    </div>
  );
}
