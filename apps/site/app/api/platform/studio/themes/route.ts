import type { StudioTheme, StudioThemeMode, StudioThemeStatus, StudioThemeToken } from "../../../../platform/onboarding/_lib/studio-types";
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

type StrapiSchemaSource = "canonical";

const CANONICAL_THEME_COLLECTION = "/api/studio-themes";

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
    .map((token, index) => {
      if (!token || typeof token !== "object" || Array.isArray(token)) {
        return null;
      }
      const row = token as Record<string, unknown>;
      
      // Be more lenient with token structure from extraction
      const key = typeof row.key === "string" && row.key.trim().length > 0 ? row.key.trim() : `token-${index + 1}`;
      const val = typeof row.value === "string" ? row.value.trim() : "";
      
      // But we still need a value to consider it a valid token
      if (val.length === 0) {
        return null;
      }

      const category = row.category;
      return {
        key,
        label: typeof row.label === "string" ? row.label : key,
        category:
          category === "color" || category === "typography" || category === "spacing" || category === "radius" || category === "shadow"
            ? category
            : "color",
        value: val,
        cssVariable: typeof row.cssVariable === "string" && row.cssVariable.startsWith("--") ? row.cssVariable : `--${key.replace(/[^a-z0-9-]+/gi, "-")}`,
        mapped: Boolean(row.mapped)
      } as StudioThemeToken;
    })
    .filter((token): token is StudioThemeToken => token !== null);
}

function normalizeThemeMode(value: unknown, darkMode: boolean): StudioThemeMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return darkMode ? "dark" : "system";
}

function normalizeTheme(value: unknown): StudioTheme {
  const row = (value ?? {}) as Record<string, unknown>;
  const idCandidate = row.documentId ?? row.id;
  const id =
    typeof idCandidate === "string" || typeof idCandidate === "number" ? String(idCandidate) : `theme-${Date.now()}`;
  const themeKeyCandidate = row.themeKey;
  const themeKey =
    typeof themeKeyCandidate === "string" && themeKeyCandidate.trim().length > 0 ? themeKeyCandidate.trim() : id;

  const darkMode = Boolean(row.darkMode);
  const themeMode = normalizeThemeMode(row.themeMode, darkMode);

  const tokens = normalizeTokens(row.tokens);
  console.log(`[Themes API] normalizeTheme: themeKey=${themeKey} tokensCount=${tokens.length}`);

  return {
    id,
    themeKey,
    name: typeof row.name === "string" && row.name.trim().length > 0 ? row.name.trim() : themeKey,
    status: row.status === "active" || row.status === "draft" ? row.status : "inactive",
    sourceRef: typeof row.sourceRef === "string" ? row.sourceRef : "unknown",
    themeScopeClass:
      typeof row.themeScopeClass === "string" && row.themeScopeClass.trim().length > 0 ? row.themeScopeClass.trim() : `theme-${themeKey}`,
    themeMode,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
    tokenCoverage: typeof row.tokenCoverage === "number" ? row.tokenCoverage : 0,
    themeDebt: typeof row.themeDebt === "string" ? row.themeDebt : "",
    darkMode: themeMode === "dark" || (themeMode === "system" && darkMode),
    tokens
  };
}

async function listThemesFromCollection(collectionPath: string): Promise<StudioTheme[]> {
  // Use status=draft to see Document Status (Draft/Published) in Strapi 5
  // But we don't filter our custom 'status' field here to see everything in the Studio
  const url = `${collectionPath}?pagination[pageSize]=100&sort=updatedAt:desc&status=draft`;
  const response = await requestStrapi<StrapiCollectionResponse>(url);

  const rows = Array.isArray(response.data) ? response.data : [];
  console.log(`[Themes API] listThemes: fetched ${rows.length} rows from ${url}`);

  return rows.map((row, idx) => {
    const unwrapped = unwrapStrapiEntity(row);
    const normalized = normalizeTheme(unwrapped);
    console.log(`[Themes API] listThemes: [${idx}] key=${normalized.themeKey} name=${normalized.name} tokens=${normalized.tokens.length}`);
    return normalized;
  });
}

async function resolveThemeMutationIdByKey(collectionPath: string, themeKey: string): Promise<string | null> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `${collectionPath}?filters[themeKey][$eq]=${encodeURIComponent(themeKey)}&pagination[pageSize]=1&status=draft`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  if (!existing) {
    return null;
  }
  return resolveEntityMutationId(existing);
}

async function setThemeStatusInCollection(collectionPath: string, themeKey: string, status: StudioThemeStatus): Promise<void> {
  const mutationId = await resolveThemeMutationIdByKey(collectionPath, themeKey);
  if (!mutationId) {
    return;
  }
  await requestStrapi(`${collectionPath}/${encodeURIComponent(mutationId)}`, {
    method: "PUT",
    body: { status }
  });
}

async function enforceSingleActiveThemeInCollection(collectionPath: string): Promise<StudioTheme[]> {
  const themes = await listThemesFromCollection(collectionPath);
  const activeThemes = themes.filter((theme) => theme.status === "active");
  if (activeThemes.length <= 1) {
    return themes;
  }

  const keeper = activeThemes[0];
  await Promise.all(
    activeThemes
      .filter((theme) => theme.themeKey !== keeper.themeKey)
      .map((theme) => setThemeStatusInCollection(collectionPath, theme.themeKey, "inactive"))
  );
  return listThemesFromCollection(collectionPath);
}

async function activateThemeInCollection(collectionPath: string, themeKey: string): Promise<void> {
  const themes = await listThemesFromCollection(collectionPath);
  await Promise.all(
    themes.map((theme) =>
      setThemeStatusInCollection(collectionPath, theme.themeKey, theme.themeKey === themeKey ? "active" : theme.status === "draft" ? "draft" : "inactive")
    )
  );
}

async function listThemesFromStrapi(): Promise<{ themes: StudioTheme[]; schemaSource: StrapiSchemaSource }> {
  const canonicalThemes = await listThemesFromCollection(CANONICAL_THEME_COLLECTION);
  return {
    themes: canonicalThemes,
    schemaSource: "canonical"
  };
}

async function upsertThemeInCollection(collectionPath: string, keyField: string, theme: StudioTheme): Promise<void> {
  // Query by themeKey across ALL document statuses
  const url = `${collectionPath}?filters[${encodeURIComponent(keyField)}][$eq]=${encodeURIComponent(theme.themeKey)}&pagination[pageSize]=1&status=draft`;
  const lookup = await requestStrapi<StrapiCollectionResponse>(url);
  
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  const existingId = existing ? resolveEntityMutationId(existing) : null;
  console.log(`[Themes API] upsert: lookup for ${theme.themeKey} found existingId: ${existingId}`);

  const payload = {
    themeKey: theme.themeKey,
    name: theme.name,
    status: theme.status,
    sourceRef: theme.sourceRef,
    themeScopeClass: theme.themeScopeClass,
    themeMode: theme.themeMode,
    tokenCoverage: theme.tokenCoverage,
    themeDebt: theme.themeDebt,
    darkMode: theme.themeMode === "dark" || (theme.themeMode === "system" && theme.darkMode),
    tokens: theme.tokens
  };

  if (existingId !== null) {
    console.log(`[Themes API] upsert: perform PUT for ${existingId}`);
    await requestStrapi(`${collectionPath}/${encodeURIComponent(existingId)}`, {
      method: "PUT",
      body: payload
    });
    return;
  }

  console.log(`[Themes API] upsert: perform POST for ${theme.themeKey}`);
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
    console.log("[Themes API] GET: Using Strapi backend");
    try {
      const { schemaSource } = await listThemesFromStrapi();
      const themes = await enforceSingleActiveThemeInCollection(CANONICAL_THEME_COLLECTION);
      return Response.json({
        ok: true,
        data: themes,
        source: "strapi",
        schemaSource
      });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error: `Canonical studio-theme load failed: ${error instanceof Error ? error.message : String(error)}`
        },
        { status: 502 }
      );
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
    console.log("[Themes API] POST payload received:", JSON.stringify(payload, null, 2));

    if (payload.sourceType !== undefined && !isStudioThemeSourceType(payload.sourceType)) {
      console.warn("[Themes API] Invalid sourceType:", payload.sourceType);
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

    if (theme.tokens.length === 0) {
      console.warn("[Themes API] Validation failed: tokens.length is 0. Payload theme:", JSON.stringify(payload.theme, null, 2));
      return Response.json(
        {
          ok: false,
          error: "Theme must have at least one token to be valid.",
          code: "theme.tokens_empty"
        },
        { status: 400 }
      );
    }

    if (isStrapiConfigured()) {
      console.log("[Themes API] POST: Using Strapi backend");
      try {
        const existingThemes = await listThemesFromCollection(CANONICAL_THEME_COLLECTION);
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
        if (theme.status === "active") {
          await activateThemeInCollection(CANONICAL_THEME_COLLECTION, theme.themeKey);
        }
        const themes = await enforceSingleActiveThemeInCollection(CANONICAL_THEME_COLLECTION);
        return Response.json({
          ok: true,
          data: themes,
          source: "strapi",
          schemaSource: "canonical"
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: `Canonical studio-theme persistence failed: ${error instanceof Error ? error.message : String(error)}`
          },
          { status: 502 }
        );
      }
    }
    console.log("[Themes API] POST: Strapi NOT configured, using Fallback store");
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
