import type { StudioTheme } from "../../../../../platform/onboarding/_lib/studio-types";
import { isStudioThemeStatus } from "../../../../../platform/onboarding/_lib/studio-types";
import { getStudioStore, replaceStore } from "../../_lib/store";
import { isStrapiConfigured, requestStrapi, StudioApiError, unwrapStrapiEntity } from "../../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type StrapiSchemaSource = "canonical" | "legacy";

const CANONICAL_THEME_COLLECTION = "/api/studio-themes";

function resolveEntityMutationId(value: Record<string, unknown>): string | null {
  if (typeof value.documentId === "string" && value.documentId.length > 0) {
    return value.documentId;
  }
  if (typeof value.id === "string" || typeof value.id === "number") {
    return String(value.id);
  }
  return null;
}

function normalizeTheme(value: unknown): StudioTheme {
  const row = (value ?? {}) as Record<string, unknown>;
  const idCandidate = row.documentId ?? row.id;
  const statusCandidate = row.status;
  return {
    id: typeof idCandidate === "string" || typeof idCandidate === "number" ? String(idCandidate) : `theme-${Date.now()}`,
    themeKey: typeof row.themeKey === "string" ? row.themeKey : "default",
    name: typeof row.name === "string" ? row.name : "Theme",
    status: isStudioThemeStatus(statusCandidate) ? statusCandidate : "inactive",
    sourceRef: typeof row.sourceRef === "string" ? row.sourceRef : "unknown",
    createdAt: typeof row.createdAt === "string" ? row.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    tokenCoverage: typeof row.tokenCoverage === "number" ? row.tokenCoverage : 0,
    themeDebt: typeof row.themeDebt === "string" ? row.themeDebt : "",
    darkMode: Boolean(row.darkMode),
    tokens: Array.isArray(row.tokens) ? (row.tokens as StudioTheme["tokens"]) : []
  };
}

function toThemeMutationPayload(theme: StudioTheme, status: StudioTheme["status"]): Record<string, unknown> {
  return {
    themeKey: theme.themeKey,
    name: theme.name,
    status,
    sourceRef: theme.sourceRef,
    tokenCoverage: theme.tokenCoverage,
    themeDebt: theme.themeDebt,
    darkMode: theme.darkMode,
    tokens: theme.tokens
  };
}

async function listThemesFromCollection(collectionPath: string): Promise<Array<Record<string, unknown>>> {
  const all = await requestStrapi<StrapiCollectionResponse>(`${collectionPath}?pagination[pageSize]=200`);
  return Array.isArray(all.data) ? all.data : [];
}

async function activateThemeInCollection(
  collectionPath: string,
  themeId: string,
  themeKey?: string
): Promise<StudioTheme[]> {
  const rows = await listThemesFromCollection(collectionPath);
  const selected = rows.find((row) => {
    const current = unwrapStrapiEntity(row);
    if (String(current.id) === themeId || String(current.documentId ?? "") === themeId) {
      return true;
    }
    return themeKey !== undefined && current.themeKey === themeKey;
  });

  const selectedId = selected ? String((unwrapStrapiEntity(selected) as Record<string, unknown>).id) : themeId;

  for (const row of rows) {
    const current = unwrapStrapiEntity(row);
    const mutationId = resolveEntityMutationId(row);
    if (mutationId === null) {
      continue;
    }

    const nextStatus = String(current.id) === selectedId ? "active" : current.status === "draft" ? "draft" : "inactive";
    await requestStrapi(`${collectionPath}/${encodeURIComponent(mutationId)}`, {
      method: "PUT",
      body: toThemeMutationPayload(normalizeTheme(current), nextStatus)
    });
  }

  const refreshed = await listThemesFromCollection(collectionPath);
  return refreshed.map((row) => normalizeTheme(unwrapStrapiEntity(row)));
}

async function activateThemeInStrapi(
  themeId: string,
  themeKey?: string
): Promise<{ themes: StudioTheme[]; schemaSource: StrapiSchemaSource }> {
  const themes = await activateThemeInCollection(CANONICAL_THEME_COLLECTION, themeId, themeKey);
  return {
    themes,
    schemaSource: "canonical"
  };
}

function activateThemeInFallback(themeId: string, themeKey?: string): StudioTheme[] {
  const store = getStudioStore();
  const selected = store.themes.find((theme) => theme.id === themeId || (themeKey !== undefined && theme.themeKey === themeKey));
  const selectedId = selected?.id;
  const themes = store.themes.map((theme) => ({
    ...theme,
    status: (selectedId && theme.id === selectedId ? "active" : theme.status === "draft" ? "draft" : "inactive") as StudioTheme["status"],
    updatedAt: new Date().toISOString().slice(0, 10)
  }));
  if (!selectedId && themes.length > 0) {
    themes[0].status = "active";
  }
  replaceStore({
    ...store,
    themes
  });
  return themes;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as { id?: string; themeKey?: string };
    const themeId = payload.id?.trim();
    const themeKey = payload.themeKey?.trim();
    if (!themeId) {
      return Response.json(
        {
          ok: false,
          error: "Theme id is required."
        },
        { status: 400 }
      );
    }

    if (isStrapiConfigured()) {
      try {
        const { themes, schemaSource } = await activateThemeInStrapi(themeId, themeKey);
        return Response.json({
          ok: true,
          data: themes,
          source: "strapi",
          schemaSource
        });
      } catch (error) {
        return Response.json({
          ok: false,
          error: `Canonical studio-theme activation failed: ${error instanceof Error ? error.message : String(error)}`
        }, { status: 502 });
      }
    }

    const fallback = activateThemeInFallback(themeId, themeKey);
    return Response.json({
      ok: true,
      data: fallback,
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
