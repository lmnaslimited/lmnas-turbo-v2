import { isLegacyWipeEnabled, wipeLegacyStudioEntries } from "../_lib/legacy-cleanup";
import { resetStore } from "../_lib/store";
import { isStrapiConfigured } from "../_lib/strapi";

function summarizeFallbackSnapshot(snapshot: ReturnType<typeof resetStore>): {
  themes: number;
  shells: number;
  blocks: number;
  pages: number;
} {
  return {
    themes: snapshot.themes.length,
    shells: snapshot.shells.length,
    blocks: snapshot.blocks.length,
    pages: snapshot.pages.length
  };
}

export async function POST(): Promise<Response> {
  if (isStrapiConfigured() && isLegacyWipeEnabled()) {
    try {
      const cleanup = await wipeLegacyStudioEntries();
      return Response.json({
        ok: true,
        data: {
          legacyBlockTemplatesBefore: cleanup.blockTemplates.before.length,
          legacyBlockTemplatesAfter: cleanup.blockTemplates.after.length,
          pagesWithLegacyBlocksBefore: cleanup.pages.before.filter((page) => page.legacyBlockCount > 0).length,
          pagesWithLegacyBlocksAfter: cleanup.pages.after.filter((page) => page.legacyBlockCount > 0).length,
          sterile: cleanup.sterile
        },
        source: "strapi",
        cleanup
      });
    } catch (error) {
      const snapshot = resetStore();
      return Response.json({
        ok: true,
        data: summarizeFallbackSnapshot(snapshot),
        source: "fallback",
        warning: "Strapi cleanup failed. Local fallback store was reset instead.",
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
