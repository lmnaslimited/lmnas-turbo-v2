import type { StudioFidelityMode, StudioSettings } from "../../../../platform/onboarding/_lib/studio-types";
import { createSeedStore, getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured } from "../_lib/strapi";
import {
  persistStudioSettingsToStrapi,
  readStudioSettingsFromStrapi
} from "../_lib/canonical-settings";

type SettingsPayload = {
  fidelity?: {
    mode?: unknown;
    threshold?: unknown;
  };
};

function normalizeMode(value: unknown, fallback: StudioFidelityMode): StudioFidelityMode {
  return value === "disallow-below-threshold" || value === "allow-below-threshold" ? value : fallback;
}

function normalizeThreshold(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return Number(value.toFixed(4));
}

function buildSettings(payload: SettingsPayload, current: StudioSettings): StudioSettings {
  return {
    fidelity: {
      mode: normalizeMode(payload.fidelity?.mode, current.fidelity.mode),
      threshold: normalizeThreshold(payload.fidelity?.threshold, current.fidelity.threshold)
    }
  };
}

function syncSettingsToFallback(settings: StudioSettings): void {
  const store = getStudioStore();
  replaceStore({
    ...store,
    settings
  });
}

export async function GET(): Promise<Response> {
  if (isStrapiConfigured()) {
    try {
      const defaults = createSeedStore().settings;
      const settings = await readStudioSettingsFromStrapi(defaults);
      syncSettingsToFallback(settings);
      return Response.json({
        ok: true,
        data: settings,
        source: "strapi"
      });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error: "Canonical studio settings could not be read from Strapi.",
          developerError: error instanceof Error ? error.message : String(error)
        },
        { status: 502 }
      );
    }
  }

  return Response.json({
    ok: true,
    data: getStudioStore().settings,
    source: "fallback"
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as SettingsPayload;
    const current = getStudioStore().settings;
    const next = buildSettings(payload, current);

    if (isStrapiConfigured()) {
      try {
        const settings = await persistStudioSettingsToStrapi(next);
        syncSettingsToFallback(settings);
        return Response.json({
          ok: true,
          data: settings,
          source: "strapi"
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: "Canonical studio settings could not be persisted to Strapi.",
            developerError: error instanceof Error ? error.message : String(error)
          },
          { status: 502 }
        );
      }
    }

    syncSettingsToFallback(next);
    return Response.json({
      ok: true,
      data: next,
      source: "fallback"
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 400 }
    );
  }
}
