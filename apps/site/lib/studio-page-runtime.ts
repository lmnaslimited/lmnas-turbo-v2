import { loadProjectEnv } from "../app/lib/env";
import { sanitizeDomToJson } from "./studio-html-sanitizer";

type ImportedDomSnapshotBlock = {
  type: "imported_dom_snapshot";
  domJson: ReturnType<typeof sanitizeDomToJson>;
  classMap: Record<string, string>;
  stylesheetRef: string;
};

type StudioPageStatus = "draft" | "published";

type StrapiCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type StudioPageSeoMetadata = {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
};

type StudioRuntimePageRecord = {
  id: string;
  name: string;
  slug: string;
  locale: string;
  status: StudioPageStatus;
  previewValid: boolean;
  blockSchemaValid: boolean;
  seoJsonLdValid: boolean;
  productMapping: string;
  industryMapping: string[];
  primaryCta: {
    text: string;
    url: string;
  };
  conversionConfig: {
    strategy: string;
  };
  seoMetadata: StudioPageSeoMetadata;
  previewHtml: string;
  publishedPreviewHtml: string;
};

function statusMatches(value: unknown, expected: StudioPageStatus | undefined): boolean {
  if (!expected) {
    return true;
  }
  return (value === "published" ? "published" : "draft") === expected;
}

export type StudioRuntimePage = {
  id: string;
  name: string;
  slug: string;
  locale: string;
  status: StudioPageStatus;
  seoMetadata: StudioPageSeoMetadata;
  canonicalPath: string;
  canonicalUrl: string;
  renderBlocks: ImportedDomSnapshotBlock[];
  jsonLd: object[];
};

export type StudioRuntimeRouteResult =
  | {
      state: "missing";
    }
  | {
      state: "blocked";
      page: Pick<StudioRuntimePage, "id" | "name" | "slug" | "locale" | "status" | "seoMetadata" | "canonicalPath" | "canonicalUrl">;
      issues: string[];
    }
  | {
      state: "ready";
      page: StudioRuntimePage;
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
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

function normalizeSeoMetadata(value: unknown): StudioPageSeoMetadata {
  const row = asObject(value);
  const canonicalUrl = asString(row.canonicalUrl).trim();
  return {
    metaTitle: asString(row.metaTitle).trim(),
    metaDescription: asString(row.metaDescription).trim(),
    ...(canonicalUrl.length > 0 ? { canonicalUrl } : {})
  };
}

function buildCanonicalPath(slug: string, locale: string): string {
  const normalizedSlug = slug.trim();
  const normalizedLocale = locale.trim() || "en";
  return normalizedSlug === "home" ? `/${normalizedLocale}` : `/${normalizedLocale}/${normalizedSlug.replace(/^\/+/, "")}`;
}

function resolveCanonicalBaseUrl(): string {
  loadProjectEnv();
  const configuredBase = process.env.SITE_CANONICAL_BASE?.trim();
  if (configuredBase && configuredBase.length > 0) {
    return configuredBase.replace(/\/$/, "");
  }
  return "https://lmnas.com";
}

function resolveCanonicalUrl(record: StudioRuntimePageRecord): string {
  return record.seoMetadata.canonicalUrl?.trim() || `${resolveCanonicalBaseUrl()}${buildCanonicalPath(record.slug, record.locale)}`;
}

function mapStudioRuntimePageRecord(value: Record<string, unknown>): StudioRuntimePageRecord | null {
  const row = unwrapStrapiEntity(value);
  const primaryCta = asObject(row.primaryCta);
  const conversionConfig = asObject(row.conversionConfig);
  const slug = asString(row.slug).trim();
  if (!slug) {
    return null;
  }

  return {
    id: row.id,
    name: asString(row.name).trim() || slug,
    slug,
    locale: asString(row.locale).trim() || "en",
    status: row.status === "published" ? "published" : "draft",
    previewValid: Boolean(row.previewValid),
    blockSchemaValid: Boolean(row.blockSchemaValid),
    seoJsonLdValid: Boolean(row.seoJsonLdValid),
    productMapping: asString(row.productMapping).trim(),
    industryMapping: asStringArray(row.industryMapping),
    primaryCta: {
      text: asString(primaryCta.text).trim(),
      url: asString(primaryCta.url).trim()
    },
    conversionConfig: {
      strategy: asString(conversionConfig.strategy).trim()
    },
    seoMetadata: normalizeSeoMetadata(row.seoMetadata),
    previewHtml: asString(row.previewHtml),
    publishedPreviewHtml: asString(row.publishedPreviewHtml)
  };
}

function selectRuntimeHtml(record: StudioRuntimePageRecord, preview: boolean): string {
  if (preview) {
    return record.previewHtml;
  }

  return record.publishedPreviewHtml.trim().length > 0 ? record.publishedPreviewHtml : record.previewHtml;
}

function evaluateRuntimeGovernance(record: StudioRuntimePageRecord, runtimeHtml: string): string[] {
  const issues: string[] = [];

  if (!record.previewValid) {
    issues.push("Preview acceptance is incomplete.");
  }
  if (!record.blockSchemaValid) {
    issues.push("Block schema validation failed.");
  }
  if (record.productMapping.length === 0) {
    issues.push("Product mapping is required.");
  }
  if (record.industryMapping.length === 0) {
    issues.push("Industry mapping is required.");
  }
  if (record.primaryCta.text.length === 0 || record.primaryCta.url.length === 0) {
    issues.push("Primary CTA is required.");
  }
  if (record.conversionConfig.strategy.length === 0) {
    issues.push("Conversion configuration is required.");
  }
  if (record.seoMetadata.metaTitle.length === 0 || record.seoMetadata.metaDescription.length === 0) {
    issues.push("SEO metadata is incomplete.");
  }
  if (!record.seoJsonLdValid) {
    issues.push("SEO JSON-LD validation is incomplete.");
  }
  if (extractBodyHtml(ensureHtmlDocument(runtimeHtml)).trim().length === 0) {
    issues.push("Runtime render model is empty.");
  }

  return issues;
}

function buildRuntimeJsonLd(record: StudioRuntimePageRecord, canonicalUrl: string): object[] {
  if (!record.seoJsonLdValid) {
    return [];
  }

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: record.seoMetadata.metaTitle || record.name,
      description: record.seoMetadata.metaDescription,
      url: canonicalUrl,
      inLanguage: record.locale,
      about: record.productMapping,
      potentialAction: {
        "@type": "ViewAction",
        name: record.primaryCta.text,
        target: record.primaryCta.url
      }
    }
  ];
}

function buildRenderBlocks(record: StudioRuntimePageRecord, runtimeHtml: string, canonicalUrl: string): ImportedDomSnapshotBlock[] {
  const bodyHtml = extractBodyHtml(ensureHtmlDocument(runtimeHtml));
  return [
    {
      type: "imported_dom_snapshot",
      domJson: sanitizeDomToJson(bodyHtml, canonicalUrl),
      classMap: {},
      stylesheetRef: "/studio-runtime.css"
    }
  ];
}

export async function loadStudioPageForRoute(params: {
  slug: string;
  locale: string;
  preview: boolean;
}): Promise<StudioRuntimeRouteResult> {
  const config = readStrapiConfig();
  if (!config) {
    return { state: "missing" };
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
      return { state: "missing" };
    }

    const payload = (await response.json()) as StrapiCollectionResponse;
    const rows = Array.isArray(payload.data) ? payload.data : [];
    const filteredRows = rows.filter((entry) => {
      const row = unwrapStrapiEntity(entry);
      return statusMatches(row.status, status);
    });
    const selectedRow =
      filteredRows.find((entry) => {
        const row = unwrapStrapiEntity(entry);
        return asString(row.locale).trim() === params.locale;
      }) ??
      filteredRows.find((entry) => {
        const row = unwrapStrapiEntity(entry);
        return asString(row.locale).trim() === "en";
      }) ??
      filteredRows[0] ??
      null;

    if (!selectedRow) {
      return { state: "missing" };
    }

    const record = mapStudioRuntimePageRecord(selectedRow);
    if (!record) {
      return { state: "missing" };
    }

    const canonicalPath = buildCanonicalPath(record.slug, record.locale);
    const canonicalUrl = resolveCanonicalUrl(record);
    const runtimeHtml = selectRuntimeHtml(record, params.preview);
    const issues = evaluateRuntimeGovernance(record, runtimeHtml);

    if (issues.length > 0) {
      return {
        state: "blocked",
        page: {
          id: record.id,
          name: record.name,
          slug: record.slug,
          locale: record.locale,
          status: record.status,
          seoMetadata: record.seoMetadata,
          canonicalPath,
          canonicalUrl
        },
        issues
      };
    }

    return {
      state: "ready",
      page: {
        id: record.id,
        name: record.name,
        slug: record.slug,
        locale: record.locale,
        status: record.status,
        seoMetadata: record.seoMetadata,
        canonicalPath,
        canonicalUrl,
        renderBlocks: buildRenderBlocks(record, runtimeHtml, canonicalUrl),
        jsonLd: buildRuntimeJsonLd(record, canonicalUrl)
      }
    };
  } catch {
    return { state: "missing" };
  }
}
