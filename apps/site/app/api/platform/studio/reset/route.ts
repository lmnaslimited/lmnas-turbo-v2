import { loadProjectEnv } from "../../../../lib/env";
import { resetCanonicalStudioSchema } from "../_lib/canonical-isolation";
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
  if (isStrapiConfigured()) {
    if (!isCanonicalIsolationEnabled()) {
      return Response.json(
        {
          ok: false,
          source: "strapi",
          error: "Canonical studio reset is disabled by local-dev guard. Re-enable canonical isolation to reset Strapi."
        },
        { status: 503 }
      );
    }

    try {
      const canonical = await resetCanonicalStudioSchema();
      return Response.json({
        ok: true,
        data: {
          canonicalCollectionsReset: canonical.collections.length,
          canonicalSterile: canonical.sterile
        },
        source: "strapi",
        canonical
      });
    } catch (error) {
      return Response.json({
        ok: false,
        source: "strapi",
        error: "Canonical studio reset failed in Strapi.",
        developerError: error instanceof Error ? error.message : String(error)
      }, { status: 502 });
    }
  }

  const snapshot = resetStore();
  return Response.json({
    ok: true,
    data: summarizeFallbackSnapshot(snapshot),
    source: "fallback"
  });
}
