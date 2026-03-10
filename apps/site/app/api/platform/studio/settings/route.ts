import type { StudioFidelityMode, StudioSettings } from "../../../../platform/onboarding/_lib/studio-types";
import { getStudioStore, replaceStore } from "../_lib/store";

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

export async function GET(): Promise<Response> {
  return Response.json({
    ok: true,
    data: getStudioStore().settings,
    source: "fallback"
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as SettingsPayload;
    const store = getStudioStore();
    const settings = buildSettings(payload, store.settings);
    replaceStore({
      ...store,
      settings
    });

    return Response.json({
      ok: true,
      data: settings,
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
