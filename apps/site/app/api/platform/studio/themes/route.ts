import type { StudioTheme, StudioThemeToken } from "../../../../platform/onboarding/_lib/studio-types";
import { ALLOWED_THEME_SOURCES, isStudioThemeSourceType } from "../../../../platform/onboarding/theme/theme-input";
import { getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured, requestStrapi, StudioApiError, unwrapStrapiEntity } from "../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type ThemePostPayload = {
  theme?: unknown;
  mode?: "create" | "upsert";
  sourceType?: unknown;
};

type StrapiSchemaSource = "canonical" | "legacy";

const CANONICAL_THEME_COLLECTION = "/api/studio-themes";
const LEGACY_THEME_COLLECTION = "/api/theme-variants";

function toIsoDate(input?: unknown): string {
  if (typeof input !== "string" || input.length < 10) {
    return new Date().toISOString().slice(0, 10);
  }
  return input.slice(0, 10);
}

function resolveEntityMutationId(value: Record<string, unknown>): string | null {
  if (typeof value.documentId === "string" && value.documentId.length > 0) {
    return value.documentId;
  }
  if (typeof value.id === "string" || typeof value.id === "number") {
    return String(value.id);
  }
  return null;
}

function normalizeTokens(value: unknown): StudioThemeToken[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((token) => {
      if (!token || typeof token !== "object" || Array.isArray(token)) {
        return null;
      }
      const row = token as Record<string, unknown>;
      if (typeof row.key !== "string" || typeof row.value !== "string") {
        return null;
      }

      const category = row.category;
      return {
        key: row.key,
        label: typeof row.label === "string" ? row.label : row.key,
        category:
          category === "color" || category === "typography" || category === "spacing" || category === "radius" || category === "shadow"
            ? category
            : "color",
        value: row.value,
        cssVariable: typeof row.cssVariable === "string" ? row.cssVariable : row.key,
        mapped: Boolean(row.mapped)
      } as StudioThemeToken;
    })
    .filter((token): token is StudioThemeToken => token !== null);
}

function normalizeTheme(value: unknown): StudioTheme {
  const row = (value ?? {}) as Record<string, unknown>;
  const idCandidate = row.documentId ?? row.id;
  const id =
    typeof idCandidate === "string" || typeof idCandidate === "number" ? String(idCandidate) : `theme-${Date.now()}`;
  const themeKeyCandidate = row.themeKey;
  const themeKey =
    typeof themeKeyCandidate === "string" && themeKeyCandidate.trim().length > 0 ? themeKeyCandidate.trim() : id;

  return {
    id,
    themeKey,
    name: typeof row.name === "string" && row.name.trim().length > 0 ? row.name.trim() : themeKey,
    status: row.status === "active" || row.status === "draft" ? row.status : "inactive",
    sourceRef: typeof row.sourceRef === "string" ? row.sourceRef : "unknown",
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    tokenCoverage: typeof row.tokenCoverage === "number" ? row.tokenCoverage : 0,
    themeDebt: typeof row.themeDebt === "string" ? row.themeDebt : "",
    darkMode: Boolean(row.darkMode),
    tokens: normalizeTokens(row.tokens)
  };
}

async function listThemesFromCollection(collectionPath: string): Promise<StudioTheme[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(`${collectionPath}?pagination[pageSize]=100&sort=updatedAt:desc`);
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => normalizeTheme(unwrapStrapiEntity(row)));
}

async function listThemesFromStrapi(): Promise<{ themes: StudioTheme[]; schemaSource: StrapiSchemaSource }> {
  try {
    const canonicalThemes = await listThemesFromCollection(CANONICAL_THEME_COLLECTION);
    return {
      themes: canonicalThemes,
      schemaSource: "canonical"
    };
  } catch {
    const legacyThemes = await listThemesFromCollection(LEGACY_THEME_COLLECTION);
    return {
      themes: legacyThemes,
      schemaSource: "legacy"
    };
  }
}

async function upsertThemeInCollection(collectionPath: string, keyField: string, theme: StudioTheme): Promise<void> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `${collectionPath}?filters[${encodeURIComponent(keyField)}][$eq]=${encodeURIComponent(theme.themeKey)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  const existingId = existing ? resolveEntityMutationId(existing) : null;

  const payload = {
    themeKey: theme.themeKey,
    name: theme.name,
    status: theme.status,
    sourceRef: theme.sourceRef,
    tokenCoverage: theme.tokenCoverage,
    themeDebt: theme.themeDebt,
    darkMode: theme.darkMode,
    tokens: theme.tokens
  };

  if (existingId !== null) {
    await requestStrapi(`${collectionPath}/${encodeURIComponent(existingId)}`, {
      method: "PUT",
      body: payload
    });
    return;
  }

  await requestStrapi(collectionPath, {
    method: "POST",
    body: payload
  });
}

function upsertThemeInFallback(theme: StudioTheme): StudioTheme[] {
  const store = getStudioStore();
  const themes = [...store.themes];
  const index = themes.findIndex((candidate) => candidate.id === theme.id || candidate.themeKey === theme.themeKey);
  const next = {
    ...theme,
    updatedAt: new Date().toISOString().slice(0, 10),
    createdAt: index >= 0 ? themes[index].createdAt : theme.createdAt
  };

  if (index >= 0) {
    themes[index] = next;
  } else {
    themes.unshift(next);
  }

  if (next.status === "active") {
    themes.forEach((candidate) => {
      if (candidate.id !== next.id) {
        candidate.status = candidate.status === "draft" ? "draft" : "inactive";
      }
    });
  }

  replaceStore({
    ...store,
    themes
  });
  return themes;
}

function findDuplicateTheme(themes: StudioTheme[], theme: StudioTheme): StudioTheme | null {
  const normalizedName = theme.name.trim().toLowerCase();
  return (
    themes.find((candidate) => candidate.themeKey === theme.themeKey && candidate.id !== theme.id) ??
    themes.find((candidate) => candidate.name.trim().toLowerCase() === normalizedName && candidate.id !== theme.id) ??
    null
  );
}

export async function GET(): Promise<Response> {
  if (isStrapiConfigured()) {
    try {
      const { themes, schemaSource } = await listThemesFromStrapi();
      if (themes.length > 0) {
        return Response.json({
          ok: true,
          data: themes,
          source: "strapi",
          schemaSource
        });
      }
    } catch {
      // Fallback below keeps workflow operable when Strapi is offline.
    }
  }

  return Response.json({
    ok: true,
    data: getStudioStore().themes,
    source: "fallback",
    schemaSource: "fallback"
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as ThemePostPayload;
    if (payload.sourceType !== undefined && !isStudioThemeSourceType(payload.sourceType)) {
      return Response.json(
        {
          ok: false,
          error: `Unsupported theme source type. Allowed values: ${ALLOWED_THEME_SOURCES.join(", ")}.`,
          code: "theme.source_type_invalid"
        },
        { status: 400 }
      );
    }

    const theme = normalizeTheme(payload.theme);
    const mode = payload.mode === "create" ? "create" : "upsert";

    if (isStrapiConfigured()) {
      try {
        const { themes: existingThemes } = await listThemesFromStrapi();
        if (mode === "create") {
          const duplicateTheme = findDuplicateTheme(existingThemes, theme);
          if (duplicateTheme) {
            return Response.json(
              {
                ok: false,
                error: `A theme with key "${duplicateTheme.themeKey}" already exists.`,
                code: "theme.duplicate",
                duplicateThemeId: duplicateTheme.id
              },
              { status: 409 }
            );
          }
        }

        await upsertThemeInCollection(CANONICAL_THEME_COLLECTION, "themeKey", theme);
        const themes = await listThemesFromCollection(CANONICAL_THEME_COLLECTION);
        return Response.json({
          ok: true,
          data: themes,
          source: "strapi",
          schemaSource: "canonical"
        });
      } catch {
        try {
          await upsertThemeInCollection(LEGACY_THEME_COLLECTION, "themeKey", theme);
          const themes = await listThemesFromCollection(LEGACY_THEME_COLLECTION);
          return Response.json({
            ok: true,
            data: themes,
            source: "strapi",
            schemaSource: "legacy",
            warning: "Theme persisted via legacy collection fallback. Run schema migration to canonical studio-themes."
          });
        } catch {
          if (mode === "create") {
            const duplicateTheme = findDuplicateTheme(getStudioStore().themes, theme);
            if (duplicateTheme) {
              return Response.json(
                {
                  ok: false,
                  error: `A theme with key "${duplicateTheme.themeKey}" already exists.`,
                  code: "theme.duplicate",
                  duplicateThemeId: duplicateTheme.id
                },
                { status: 409 }
              );
            }
          }

          const fallbackThemes = upsertThemeInFallback(theme);
          return Response.json({
            ok: true,
            data: fallbackThemes,
            source: "fallback",
            schemaSource: "fallback"
          });
        }
      }
    }

    if (mode === "create") {
      const duplicateTheme = findDuplicateTheme(getStudioStore().themes, theme);
      if (duplicateTheme) {
        return Response.json(
          {
            ok: false,
            error: `A theme with key "${duplicateTheme.themeKey}" already exists.`,
            code: "theme.duplicate",
            duplicateThemeId: duplicateTheme.id
          },
          { status: 409 }
        );
      }
    }

    const themes = upsertThemeInFallback(theme);
    return Response.json({
      ok: true,
      data: themes,
      source: "fallback",
      schemaSource: "fallback"
    });
  } catch (error) {
    if (error instanceof StudioApiError) {
      return Response.json(
        {
          ok: false,
          error: error.operatorMessage,
          developerError: error.developerMessage
        },
        { status: error.status }
      );
    }

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 400 }
    );
  }
}
