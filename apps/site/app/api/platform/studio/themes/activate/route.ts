import type { StudioTheme } from "../../../../../platform/onboarding/_lib/studio-types";
import { isStudioThemeStatus } from "../../../../../platform/onboarding/_lib/studio-types";
import { getStudioStore, replaceStore } from "../../_lib/store";
import { isStrapiConfigured, requestStrapi, StudioApiError, unwrapStrapiEntity } from "../../_lib/strapi";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

function normalizeTheme(value: unknown): StudioTheme {
  const row = (value ?? {}) as Record<string, unknown>;
  const statusCandidate = row.status;
  return {
    id: typeof row.id === "string" ? row.id : `theme-${Date.now()}`,
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

async function activateThemeInStrapi(themeId: string, themeKey?: string): Promise<StudioTheme[]> {
  const all = await requestStrapi<StrapiCollectionResponse>("/api/theme-variants?pagination[pageSize]=200");
  const rows = Array.isArray(all.data) ? all.data : [];
  const selected = rows.find((row) => {
    const current = unwrapStrapiEntity(row);
    if (current.id === themeId) {
      return true;
    }
    return themeKey !== undefined && current.themeKey === themeKey;
  });
  const selectedId = selected ? String((unwrapStrapiEntity(selected) as Record<string, unknown>).id) : themeId;

  for (const row of rows) {
    const current = unwrapStrapiEntity(row);
    const strapiId =
      typeof row.documentId === "string"
        ? row.documentId
        : typeof row.id === "number" || typeof row.id === "string"
          ? String(row.id)
          : undefined;
    if (strapiId === undefined) {
      continue;
    }
    const nextStatus = current.id === selectedId ? "active" : current.status === "draft" ? "draft" : "inactive";
    await requestStrapi(`/api/theme-variants/${encodeURIComponent(strapiId)}`, {
      method: "PUT",
      body: {
        ...(current as Record<string, unknown>),
        status: nextStatus
      }
    });
  }

  const refreshed = await requestStrapi<StrapiCollectionResponse>("/api/theme-variants?pagination[pageSize]=200");
  return (Array.isArray(refreshed.data) ? refreshed.data : []).map((row) => normalizeTheme(unwrapStrapiEntity(row)));
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
        const themes = await activateThemeInStrapi(themeId, themeKey);
        return Response.json({
          ok: true,
          data: themes,
          source: "strapi"
        });
      } catch {
        const fallback = activateThemeInFallback(themeId, themeKey);
        return Response.json({
          ok: true,
          data: fallback,
          source: "fallback"
        });
      }
    }

    const fallback = activateThemeInFallback(themeId, themeKey);
    return Response.json({
      ok: true,
      data: fallback,
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
