import type { StudioFidelityMode, StudioSettings, StudioTheme } from "../../../../platform/onboarding/_lib/studio-types";
import { createSeedStore, getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured, requestStrapi, unwrapStrapiEntity } from "../_lib/strapi";

type SettingsPayload = {
  fidelity?: {
    mode?: unknown;
    threshold?: unknown;
  };
};

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

const SETTINGS_MARKER_PREFIX = "[studio:fidelity-settings]";
const CANONICAL_THEME_COLLECTION = "/api/studio-themes";

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

function toIsoDate(input?: unknown): string {
  if (typeof input !== "string" || input.length < 10) {
    return new Date().toISOString().slice(0, 10);
  }
  return input.slice(0, 10);
}

function normalizeTokenCoverage(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function normalizeTheme(value: unknown): StudioTheme {
  const row = (value ?? {}) as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.length > 0 ? row.id : `theme-${Date.now()}`;
  return {
    id,
    themeKey: typeof row.themeKey === "string" && row.themeKey.length > 0 ? row.themeKey : id,
    name: typeof row.name === "string" && row.name.length > 0 ? row.name : "Theme",
    status: row.status === "active" || row.status === "draft" ? row.status : "inactive",
    sourceRef: typeof row.sourceRef === "string" ? row.sourceRef : "unknown",
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    tokenCoverage: normalizeTokenCoverage(row.tokenCoverage),
    themeDebt: typeof row.themeDebt === "string" ? row.themeDebt : "",
    darkMode: Boolean(row.darkMode),
    tokens: Array.isArray(row.tokens) ? (row.tokens as StudioTheme["tokens"]) : []
  };
}

async function listThemesFromStrapi(): Promise<StudioTheme[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(
    `${CANONICAL_THEME_COLLECTION}?pagination[pageSize]=200&sort=updatedAt:desc`
  );
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => normalizeTheme(unwrapStrapiEntity(row)));
}

async function resolveThemeMutationId(themeKey: string): Promise<string | null> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `${CANONICAL_THEME_COLLECTION}?filters[themeKey][$eq]=${encodeURIComponent(themeKey)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  if (!existing) {
    return null;
  }
  if (typeof existing.documentId === "string" && existing.documentId.length > 0) {
    return existing.documentId;
  }
  if (typeof existing.id === "number" || typeof existing.id === "string") {
    return String(existing.id);
  }
  return null;
}

function resolveActiveTheme(themes: StudioTheme[]): StudioTheme | null {
  return themes.find((theme) => theme.status === "active") ?? themes[0] ?? null;
}

function parseSettingsFromThemeDebt(themeDebt: string): StudioSettings | null {
  const markerLine = themeDebt
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(SETTINGS_MARKER_PREFIX));
  if (!markerLine) {
    return null;
  }

  const encoded = markerLine.slice(SETTINGS_MARKER_PREFIX.length).trim();
  if (encoded.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(encoded) as {
      mode?: unknown;
      threshold?: unknown;
    };
    const fallback: StudioSettings = {
      fidelity: {
        mode: "allow-below-threshold",
        threshold: 0.25
      }
    };
    return {
      fidelity: {
        mode: normalizeMode(parsed.mode, fallback.fidelity.mode),
        threshold: normalizeThreshold(parsed.threshold, fallback.fidelity.threshold)
      }
    };
  } catch {
    return null;
  }
}

function injectSettingsMarker(themeDebt: string, settings: StudioSettings): string {
  const lines = themeDebt
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0 && !line.trimStart().startsWith(SETTINGS_MARKER_PREFIX));
  const marker = `${SETTINGS_MARKER_PREFIX} ${JSON.stringify(settings.fidelity)}`;
  return [...lines, marker].join("\n");
}

function syncSettingsToFallback(settings: StudioSettings): void {
  const store = getStudioStore();
  replaceStore({
    ...store,
    settings
  });
}

async function persistSettingsToStrapi(settings: StudioSettings): Promise<{
  themeId: string;
  settings: StudioSettings;
}> {
  const themes = await listThemesFromStrapi();
  const activeTheme = resolveActiveTheme(themes);
  if (!activeTheme) {
    throw new Error("No active theme available in Strapi for settings persistence.");
  }

  const mutationId = await resolveThemeMutationId(activeTheme.themeKey);
  if (!mutationId) {
    throw new Error(`Unable to resolve canonical studio-theme mutation id for themeKey="${activeTheme.themeKey}".`);
  }

  await requestStrapi(`${CANONICAL_THEME_COLLECTION}/${encodeURIComponent(mutationId)}`, {
    method: "PUT",
    body: {
      themeKey: activeTheme.themeKey,
      name: activeTheme.name,
      status: activeTheme.status,
      sourceRef: activeTheme.sourceRef,
      tokenCoverage: activeTheme.tokenCoverage,
      themeDebt: injectSettingsMarker(activeTheme.themeDebt, settings),
      darkMode: activeTheme.darkMode,
      tokens: activeTheme.tokens
    }
  });

  return {
    themeId: mutationId,
    settings
  };
}

async function readSettingsFromStrapi(defaultSettings: StudioSettings): Promise<{
  settings: StudioSettings | null;
  themeId: string | null;
}> {
  const themes = await listThemesFromStrapi();
  const activeTheme = resolveActiveTheme(themes);
  if (!activeTheme) {
    return {
      settings: null,
      themeId: null
    };
  }
  const settingsFromThemeDebt = parseSettingsFromThemeDebt(activeTheme.themeDebt);
  return {
    settings: settingsFromThemeDebt ?? defaultSettings,
    themeId: activeTheme.id
  };
}

export async function GET(): Promise<Response> {
  if (isStrapiConfigured()) {
    try {
      const defaultSettings = createSeedStore().settings;
      const result = await readSettingsFromStrapi(defaultSettings);
      if (!result.settings || !result.themeId) {
        return Response.json(
          {
            ok: false,
            error: "Canonical studio settings require an active studio-theme in Strapi."
          },
          { status: 409 }
        );
      }

      return Response.json({
        ok: true,
        data: result.settings,
        source: "strapi",
        persistence: {
          themeId: result.themeId
        }
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

  const fallbackSettings = getStudioStore().settings;
  return Response.json({
    ok: true,
    data: fallbackSettings,
    source: "fallback"
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as SettingsPayload;

    if (isStrapiConfigured()) {
      try {
        const defaultSettings = createSeedStore().settings;
        const current = await readSettingsFromStrapi(defaultSettings);
        if (!current.themeId) {
          return Response.json(
            {
              ok: false,
              error: "Canonical studio settings require an active studio-theme in Strapi."
            },
            { status: 409 }
          );
        }

        const settings = buildSettings(payload, current.settings ?? defaultSettings);
        const persisted = await persistSettingsToStrapi(settings);
        return Response.json({
          ok: true,
          data: settings,
          source: "strapi",
          persistence: {
            themeId: persisted.themeId,
            marker: SETTINGS_MARKER_PREFIX
          }
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

    const store = getStudioStore();
    const settings = buildSettings(payload, store.settings);
    syncSettingsToFallback(settings);
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
