import { loadProjectEnv } from "../../../../lib/env";

export class StudioApiError extends Error {
  readonly status: number;
  readonly operatorMessage: string;
  readonly developerMessage?: string;

  constructor(params: { status: number; operatorMessage: string; developerMessage?: string }) {
    super(params.developerMessage ?? params.operatorMessage);
    this.status = params.status;
    this.operatorMessage = params.operatorMessage;
    this.developerMessage = params.developerMessage;
  }
}

type StrapiRequestInit = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown> | null;
  timeoutMs?: number;
};

type StrapiEntity = Record<string, unknown> & {
  id?: number | string;
  documentId?: string;
  attributes?: Record<string, unknown>;
};

const DEFAULT_TIMEOUT_MS = 12_000;

export function readStrapiConfig(): { url: string; token: string } | null {
  loadProjectEnv();
  const url = process.env.STRAPI_URL?.trim();
  const token = process.env.STRAPI_API_TOKEN?.trim();
  if (!url || !token) {
    return null;
  }
  return {
    url: url.replace(/\/$/, ""),
    token
  };
}

export function isStrapiConfigured(): boolean {
  return readStrapiConfig() !== null;
}

function normalizeErrorMessage(responseText: string): string {
  if (!responseText) {
    return "No error details returned by Strapi.";
  }
  return responseText.length > 900 ? `${responseText.slice(0, 900)}...` : responseText;
}

export async function requestStrapi<T = unknown>(path: string, init: StrapiRequestInit = {}): Promise<T> {
  const config = readStrapiConfig();
  if (!config) {
    throw new StudioApiError({
      status: 503,
      operatorMessage: "Strapi is not configured in this environment.",
      developerMessage: "Missing STRAPI_URL or STRAPI_API_TOKEN."
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.url}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${config.token}`
      },
      body: init.body ? JSON.stringify({ data: init.body }) : undefined,
      signal: controller.signal
    });

    if (!response.ok) {
      const details = normalizeErrorMessage(await response.text());
      throw new StudioApiError({
        status: response.status,
        operatorMessage: "Unable to complete this action in Strapi right now.",
        developerMessage: `strapi_${response.status}: ${details}`
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof StudioApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new StudioApiError({
        status: 504,
        operatorMessage: "The request to Strapi timed out. Please retry.",
        developerMessage: `strapi_timeout:${path}`
      });
    }

    throw new StudioApiError({
      status: 503,
      operatorMessage: "Unable to reach Strapi right now. Please retry.",
      developerMessage: error instanceof Error ? error.message : String(error)
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function unwrapStrapiEntity(entity: StrapiEntity): Record<string, unknown> & { id: string } {
  const attributes = (entity.attributes ?? entity) as Record<string, unknown>;
  const idValue = entity.documentId ?? entity.id ?? attributes.documentId ?? attributes.id;
  return {
    id: String(idValue ?? ""),
    ...attributes
  };
}

export function toQueryParams(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    search.set(key, String(value));
  });
  const query = search.toString();
  return query.length > 0 ? `?${query}` : "";
}
