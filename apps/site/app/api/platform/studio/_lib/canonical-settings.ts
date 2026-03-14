import type { StudioFidelityMode, StudioSettings } from "../../../../platform/onboarding/_lib/studio-types";
import { requestStrapi } from "./strapi";

type StrapiSingleResponse = {
  data?: Record<string, unknown> | null;
};

export const CANONICAL_SETTINGS_ENDPOINT = "/api/studio-setting";

function normalizeMode(value: unknown, fallback: StudioFidelityMode): StudioFidelityMode {
  return value === "disallow-below-threshold" || value === "allow-below-threshold" ? value : fallback;
}

function normalizeThreshold(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, Number(value.toFixed(4))));
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.min(1, Math.max(0, Number(parsed.toFixed(4))));
    }
  }
  return fallback;
}

export function normalizeStudioSettingsRecord(value: unknown, fallback: StudioSettings): StudioSettings {
  const row = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    fidelity: {
      mode: normalizeMode(row.fidelityMode, fallback.fidelity.mode),
      threshold: normalizeThreshold(row.fidelityThreshold, fallback.fidelity.threshold)
    }
  };
}

export function buildStudioSettingsPayload(settings: StudioSettings): Record<string, unknown> {
  return {
    fidelityMode: settings.fidelity.mode,
    fidelityThreshold: settings.fidelity.threshold
  };
}

export async function readStudioSettingsFromStrapi(fallback: StudioSettings): Promise<StudioSettings> {
  const response = await requestStrapi<StrapiSingleResponse>(CANONICAL_SETTINGS_ENDPOINT);
  if (!response.data) {
    throw new Error("Canonical studio-setting record is missing.");
  }
  return normalizeStudioSettingsRecord(response.data, fallback);
}

export async function persistStudioSettingsToStrapi(settings: StudioSettings): Promise<StudioSettings> {
  await requestStrapi(CANONICAL_SETTINGS_ENDPOINT, {
    method: "PUT",
    body: buildStudioSettingsPayload(settings)
  });
  return settings;
}
