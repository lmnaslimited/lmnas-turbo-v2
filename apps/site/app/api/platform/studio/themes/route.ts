import type { StudioTheme, StudioThemeToken } from "../../../../platform/onboarding/_lib/studio-types";
import { getStudioStore, replaceStore } from "../_lib/store";
import { isStrapiConfigured, requestStrapi, StudioApiError, unwrapStrapiEntity } from "../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

function toIsoDate(input?: unknown): string {
  if (typeof input !== "string" || input.length < 10) {
    return new Date().toISOString().slice(0, 10);
  }
  return input.slice(0, 10);
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
  const id = typeof row.id === "string" && row.id.length > 0 ? row.id : `theme-${Date.now()}`;
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

async function listThemesFromStrapi(): Promise<StudioTheme[]> {
  const response = await requestStrapi<StrapiCollectionResponse>(
    "/api/theme-variants?pagination[pageSize]=100&sort=updatedAt:desc"
  );
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((row) => normalizeTheme(unwrapStrapiEntity(row)));
}

async function upsertThemeInStrapi(theme: StudioTheme): Promise<void> {
  const lookup = await requestStrapi<StrapiCollectionResponse>(
    `/api/theme-variants?filters[themeKey][$eq]=${encodeURIComponent(theme.themeKey)}&pagination[pageSize]=1`
  );
  const existing = Array.isArray(lookup.data) ? lookup.data[0] : undefined;
  const existingId =
    existing && typeof existing.documentId === "string"
      ? existing.documentId
      : existing && (typeof existing.id === "number" || typeof existing.id === "string")
        ? String(existing.id)
        : undefined;

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

  if (existingId !== undefined) {
    await requestStrapi(`/api/theme-variants/${encodeURIComponent(existingId)}`, {
      method: "PUT",
      body: payload
    });
    return;
  }

  await requestStrapi("/api/theme-variants", {
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

export async function GET(): Promise<Response> {
  if (isStrapiConfigured()) {
    try {
      const themes = await listThemesFromStrapi();
      if (themes.length > 0 && themes.some((theme) => theme.status === "active")) {
        return Response.json({
          ok: true,
          data: themes,
          source: "strapi"
        });
      }
    } catch {
      // Fallback below keeps workflow operable when Strapi is offline.
    }
  }

  return Response.json({
    ok: true,
    data: getStudioStore().themes,
    source: "fallback"
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as { theme?: unknown };
    const theme = normalizeTheme(payload.theme);

    if (isStrapiConfigured()) {
      try {
        await upsertThemeInStrapi(theme);
        const themes = await listThemesFromStrapi();
        return Response.json({
          ok: true,
          data: themes,
          source: "strapi"
        });
      } catch {
        const fallbackThemes = upsertThemeInFallback(theme);
        return Response.json({
          ok: true,
          data: fallbackThemes,
          source: "fallback"
        });
      }
    }

    const themes = upsertThemeInFallback(theme);
    return Response.json({
      ok: true,
      data: themes,
      source: "fallback"
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
