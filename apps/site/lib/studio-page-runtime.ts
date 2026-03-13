import { loadProjectEnv } from "../app/lib/env";

type StudioPageStatus = "draft" | "published";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type StudioPageSeoMetadata = {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
};

export type StudioRuntimePage = {
  id: string;
  slug: string;
  locale: string;
  status: StudioPageStatus;
  seoMetadata: StudioPageSeoMetadata;
  html: string;
  bodyHtml: string;
};

function readStrapiConfig(): { url: string; token?: string } | null {
  loadProjectEnv();
  const url = process.env.STRAPI_URL?.trim();
  const token = process.env.STRAPI_API_TOKEN?.trim();
  if (!url) {
    return null;
  }
  return {
    url: url.replace(/\/$/, ""),
    ...(token ? { token } : {})
  };
}

function unwrapStrapiEntity(entity: Record<string, unknown>): Record<string, unknown> & { id: string } {
  const attributes =
    entity.attributes && typeof entity.attributes === "object" && !Array.isArray(entity.attributes)
      ? (entity.attributes as Record<string, unknown>)
      : entity;
  const idValue = entity.documentId ?? entity.id ?? attributes.documentId ?? attributes.id;
  return {
    id: String(idValue ?? ""),
    ...attributes
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function ensureHtmlDocument(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "<!doctype html><html><head></head><body></body></html>";
  }
  if (/<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>${trimmed}</body></html>`;
}

function extractBodyHtml(input: string): string {
  const bodyMatch = input.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (typeof bodyMatch?.[1] === "string") {
    return bodyMatch[1];
  }
  return input;
}

function stripScripts(input: string): string {
  return input.replace(/<script[\s\S]*?<\/script>/gi, "");
}

function normalizeSeoMetadata(value: unknown): StudioPageSeoMetadata {
  const row = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    metaTitle: asString(row.metaTitle),
    metaDescription: asString(row.metaDescription),
    ...(asString(row.canonicalUrl).trim().length > 0 ? { canonicalUrl: asString(row.canonicalUrl) } : {})
  };
}

function mapStudioRuntimePage(value: Record<string, unknown>, preview: boolean): StudioRuntimePage | null {
  const row = unwrapStrapiEntity(value);
  const slug = asString(row.slug).trim();
  const locale = asString(row.locale).trim() || "en";
  const previewHtml = asString(row.previewHtml);
  const publishedPreviewHtml = asString(row.publishedPreviewHtml);
  const html = preview ? previewHtml : publishedPreviewHtml;

  if (!slug || html.trim().length === 0) {
    return null;
  }

  return {
    id: row.id,
    slug,
    locale,
    status: row.status === "published" ? "published" : "draft",
    seoMetadata: normalizeSeoMetadata(row.seoMetadata),
    html,
    bodyHtml: stripScripts(extractBodyHtml(ensureHtmlDocument(html)))
  };
}

export async function loadStudioPageForRoute(params: {
  slug: string;
  locale: string;
  preview: boolean;
}): Promise<StudioRuntimePage | null> {
  const config = readStrapiConfig();
  if (!config) {
    return null;
  }

  const status = params.preview ? "draft" : "published";
  const query = `/api/studio-pages?filters[slug][$eq]=${encodeURIComponent(
    params.slug
  )}&pagination[pageSize]=20&sort=updatedAt:desc&status=${encodeURIComponent(status)}`;

  try {
    const response = await fetch(`${config.url}${query}`, {
      method: "GET",
      headers: {
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {})
      },
      cache: params.preview || process.env.NODE_ENV !== "production" ? "no-store" : "force-cache",
      ...(params.preview || process.env.NODE_ENV !== "production" ? {} : { next: { revalidate: 60 } })
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as StrapiCollectionResponse;
    const rows = Array.isArray(payload.data) ? payload.data : [];
    const exactLocaleMatch =
      rows.find((entry) => {
        const row = unwrapStrapiEntity(entry);
        return asString(row.locale) === params.locale;
      }) ?? null;
    const fallbackRow =
      exactLocaleMatch ??
      rows.find((entry) => {
        const row = unwrapStrapiEntity(entry);
        return asString(row.locale) === "en";
      }) ??
      rows[0] ??
      null;

    return fallbackRow ? mapStudioRuntimePage(fallbackRow, params.preview) : null;
  } catch {
    return null;
  }
}
