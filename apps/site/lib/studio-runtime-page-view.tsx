import React from "react";
import { PageRenderer } from "@lmnas/renderer";
import type { StudioRuntimePage } from "./studio-page-runtime";

export function StudioRuntimePageView({ page, preview }: { page: StudioRuntimePage; preview: boolean }) {
  return (
    <div
      data-testid="studio-runtime-page"
      data-studio-runtime="governed"
      className={`${page.theme.themeScopeClass}${page.theme.darkMode ? " dark" : ""}`}
      style={page.theme.cssVars}
    >
      <PageRenderer blocks={page.renderBlocks} preview={preview} />
      {page.jsonLd.map((entry, index) => (
        <script key={`studio-runtime-jsonld-${index + 1}`} type="application/ld+json">
          {JSON.stringify(entry)}
        </script>
      ))}
    </div>
  );
}

export function StudioRuntimeBlockedView({ issues, preview }: { issues: string[]; preview: boolean }) {
  return (
    <main data-testid="studio-runtime-blocked">
      <h1>{preview ? "Studio preview is blocked" : "Studio page is blocked"}</h1>
      <ul>
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </main>
  );
}
