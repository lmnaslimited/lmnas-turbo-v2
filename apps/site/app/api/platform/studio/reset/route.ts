import { loadProjectEnv } from "../../../../lib/env";
import { resetCanonicalStudioSchema } from "../_lib/canonical-isolation";
import { isLegacyWipeEnabled, wipeLegacyStudioEntries } from "../_lib/legacy-cleanup";
import { resetStore } from "../_lib/store";
import { isStrapiConfigured } from "../_lib/strapi";

function summarizeFallbackSnapshot(snapshot: ReturnType<typeof resetStore>): {
  themes: number;
  shells: number;
  blocks: number;
  pages: number;
  widgets: number;
} {
  return {
    themes: snapshot.themes.length,
    shells: snapshot.shells.length,
    blocks: snapshot.blocks.length,
    pages: snapshot.pages.length,
    widgets: snapshot.widgets.length
  };
}

function isCanonicalIsolationEnabled(): boolean {
  loadProjectEnv();
  return process.env.STUDIO_ENABLE_CANONICAL_ISOLATION !== "0";
}

export async function POST(): Promise<Response> {
  if (isStrapiConfigured() && isCanonicalIsolationEnabled()) {
    try {
      const canonical = await resetCanonicalStudioSchema();
      const cleanup = isLegacyWipeEnabled() ? await wipeLegacyStudioEntries() : null;
      return Response.json({
        ok: true,
        data: {
          canonicalCollectionsReset: canonical.collections.length,
          canonicalSterile: canonical.sterile,
          ...(cleanup
            ? {
                legacyBlockTemplatesBefore: cleanup.blockTemplates.before.length,
                legacyBlockTemplatesAfter: cleanup.blockTemplates.after.length,
                pagesWithLegacyBlocksBefore: cleanup.pages.before.filter((page) => page.legacyBlockCount > 0).length,
                pagesWithLegacyBlocksAfter: cleanup.pages.after.filter((page) => page.legacyBlockCount > 0).length,
                legacySterile: cleanup.sterile
              }
            : {})
        },
        source: "strapi",
        canonical,
        ...(cleanup ? { cleanup } : {})
      });
    } catch (error) {
      const snapshot = resetStore();
      return Response.json({
        ok: true,
        data: summarizeFallbackSnapshot(snapshot),
        source: "fallback",
        warning: "Strapi canonical isolation failed. Local fallback store was reset instead.",
        developerError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const snapshot = resetStore();
  return Response.json({
    ok: true,
    data: summarizeFallbackSnapshot(snapshot),
    source: "fallback"
  });
}
