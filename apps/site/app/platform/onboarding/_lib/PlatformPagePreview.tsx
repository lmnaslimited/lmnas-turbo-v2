"use client";

import React, { useMemo } from "react";
import { PageRenderer } from "@lmnas/renderer";
import type { StudioPageDocument, StudioBlockTemplate, StudioShell, StudioTheme } from "./studio-types";
import { buildStudioThemeCssVariables, themeIsDarkMode } from "../../../../lib/studio-canonical";
import { findBlockByReference, resolvePlatformShellPreview } from "./platform-preview-shared";

export type PlatformPagePreviewProps = {
  page: StudioPageDocument | null;
  blocks: StudioBlockTemplate[];
  shells: StudioShell[];
  themes: StudioTheme[];
  previewThemeId?: string | null;
  previewTheme?: StudioTheme | null;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
};

/**
 * Pure TSX page preview component.
 * Renders Studio pages using the platform's native PageRenderer + block-registry,
 * without any injected CDN scripts or string-based HTML documents.
 */
export function PlatformPagePreview({
  page,
  blocks,
  shells,
  themes,
  previewThemeId,
  previewTheme,
  emptyTitle,
  emptyDescription,
  className
}: PlatformPagePreviewProps) {
  // 1. Resolve theme
  const activeTheme = useMemo(() => {
    return (
      previewTheme ??
      themes.find((t) => t.id === previewThemeId) ??
      themes.find((t) => t.themeKey === page?.themeKey) ??
      themes.find((t) => t.status === "active") ??
      themes[0] ??
      null
    );
  }, [previewTheme, themes, previewThemeId, page?.themeKey]);

  // 2. Resolve Shell
  const shellPreview = useMemo(() => {
    return resolvePlatformShellPreview({
      shells,
      shellKey: page?.shellKey
    });
  }, [shells, page?.shellKey]);

  // 3. Collect blocks in order and map to renderer format
  const rendererBlocks = useMemo(() => {
    if (!page?.blockOrder) return [];
    return page.blockOrder
      .map((blockKey) => findBlockByReference(blocks, blockKey))
      .filter((b): b is StudioBlockTemplate => b !== null)
      .map((block) => ({
        // PageRenderer expects `type`, StudioBlockTemplate stores `blockType`
        type: block.blockType ?? "imported_dom_snapshot",
        domJson: block.domJson,
        classMap: block.classMap ?? {},
        stylesheetRef: block.stylesheetRef ?? "/studio-runtime.css"
      }));
  }, [page?.blockOrder, blocks]);

  // Empty state
  if (!page) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-8 bg-slate-950 text-slate-400">
        <h2 className="text-xl font-bold text-slate-200">{emptyTitle ?? "No preview available"}</h2>
        {emptyDescription && <p className="mt-2">{emptyDescription}</p>}
      </div>
    );
  }

  // 4. Theme CSS variables (uses buildStudioThemeCssVariables from studio-canonical)
  const themeStyles = buildStudioThemeCssVariables(activeTheme);
  const isDark = themeIsDarkMode(activeTheme);

  return (
    <div
      data-testid="studio-page-preview-tsx"
      className={`lmnas-platform-preview-root ${isDark ? "dark" : ""} ${className ?? ""}`}
      style={themeStyles}
    >
      {/* Shell Header */}
      {shellPreview.headerHtml && (
        <div className="lmnas-preview-shell" dangerouslySetInnerHTML={{ __html: shellPreview.headerHtml }} />
      )}

      <main className="lmnas-target-main">
        {rendererBlocks.length > 0 ? (
          <PageRenderer blocks={rendererBlocks} preview={true} />
        ) : (
          <div className="p-20 text-center text-slate-500 border border-dashed border-white/10 rounded-xl m-4">
            Empty Page Composition
          </div>
        )}
      </main>

      {/* Shell Footer */}
      {shellPreview.footerHtml && (
        <div className="lmnas-preview-shell" dangerouslySetInnerHTML={{ __html: shellPreview.footerHtml }} />
      )}
    </div>
  );
}
