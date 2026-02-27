import { readFile } from "node:fs/promises";
import type { ContentPlan } from "./contracts/contentPlan.schema.js";
import { validateContentPlan } from "./contracts/contentPlan.schema.js";
import { preflight } from "./strapi/graphqlClient.js";
import { createPageRepository, type UpsertOptions } from "./strapi/pageRepository.js";

export type PlanOptions = {
  slug: string;
  locale: string;
  url?: string;
  status?: "DRAFT" | "PUBLISHED";
  strapiUrl?: string;
  strapiToken?: string;
  graphqlPath?: string;
};

export type ApplyOptions = UpsertOptions & {
  strapiUrl?: string;
  strapiToken?: string;
  graphqlPath?: string;
};

export async function createImportPlan(options: PlanOptions): Promise<ContentPlan> {
  const env = resolveEnv(options);
  await preflight({ strapiUrl: env.strapiUrl, token: env.strapiToken, graphqlPath: env.graphqlPath });

  const repository = await createPageRepository(env);
  const existing = await repository.findBySlug({
    slug: options.slug,
    locale: options.locale,
    status: options.status
  });

  if (!existing) {
    if (options.url) {
      return createPlanFromUrl(options);
    }
    throw new Error(`No page found for slug=${options.slug} locale=${options.locale}`);
  }

  const page = existing.page;
  const slug = asNonEmptyString(page.slug, "page.slug");
  const locale = asNonEmptyString((page.locale as string | undefined) ?? options.locale, "page.locale");
  const pageType = normalizePageType(asNonEmptyString(page.pageType, "page.pageType"));
  const layoutKey = normalizeLayoutKey(asNonEmptyString(page.layoutKey, "page.layoutKey"));
  const conversionConfig = asRecord(page.conversionConfig, "page.conversionConfig");
  const seo = asRecord(page.seo, "page.seo");
  const blocks = normalizeBlocks(asBlockArray(page.blocks, "page.blocks"));

  const plan: ContentPlan = {
    page: {
      slug,
      locale,
      sourceUrl: options.url ?? `${env.strapiUrl.replace(/\/$/, "")}/${options.slug}`,
      pageType,
      layoutKey,
      conversionConfig: conversionConfig as ContentPlan["page"]["conversionConfig"],
      seo: seo as ContentPlan["page"]["seo"]
    },
    blocks,
    publish: {
      state: page.publishedAt ? "published" : "draft"
    },
    source: {
      fetchedAt: new Date().toISOString(),
      schemaVersion: "content-plan.v1"
    }
  };

  return validateContentPlan(plan);
}

export async function applyImportPlan(planInput: unknown, options: ApplyOptions = {}): Promise<void> {
  const env = resolveEnv(options);
  await preflight({ strapiUrl: env.strapiUrl, token: env.strapiToken, graphqlPath: env.graphqlPath });

  const plan = validateContentPlan(planInput);
  const repository = await createPageRepository(env);
  await repository.upsertPage(plan, {
    forceCreate: options.forceCreate,
    forceUpdate: options.forceUpdate,
    strictUpsert: options.strictUpsert ?? process.env.LMNAS_IMPORTER_STRICT_UPSERT === "true"
  });
}

export async function validatePlanFile(planPath: string): Promise<ContentPlan> {
  const raw = await readFile(planPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return validateContentPlan(parsed);
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, val]) => [key, sortKeys(val)]));
  }

  return value;
}

function normalizePageType(value: string): ContentPlan["page"]["pageType"] {
  if (["home", "product", "solution", "industry", "simple"].includes(value)) {
    return value as ContentPlan["page"]["pageType"];
  }
  throw new Error(`Invalid pageType from Strapi: ${value}`);
}

function normalizeLayoutKey(value: string): ContentPlan["page"]["layoutKey"] {
  if (["homeLayout", "productLayout", "solutionLayout", "industryLayout", "simpleLayout"].includes(value)) {
    return value as ContentPlan["page"]["layoutKey"];
  }
  throw new Error(`Invalid layoutKey from Strapi: ${value}`);
}

function normalizeBlocks(blocks: Record<string, unknown>[]): ContentPlan["blocks"] {
  if (!Array.isArray(blocks)) {
    throw new Error("Invalid Strapi page response: blocks must be an array");
  }

  return blocks.map((block) => {
    if (!block || typeof block !== "object") {
      throw new Error("Invalid Strapi page response: block must be an object");
    }
    return block;
  });
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid ${field}: expected non-empty string`);
  }
  return value;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${field}: expected object`);
  }
  return value as Record<string, unknown>;
}

function asBlockArray(value: unknown, field: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${field}: expected array`);
  }
  return value as Record<string, unknown>[];
}

function resolveEnv(options: { strapiUrl?: string; strapiToken?: string; graphqlPath?: string }) {
  return {
    strapiUrl: options.strapiUrl ?? process.env.STRAPI_URL ?? "",
    strapiToken: options.strapiToken ?? process.env.STRAPI_TOKEN ?? "",
    graphqlPath: options.graphqlPath ?? process.env.STRAPI_GRAPHQL_PATH ?? "/graphql"
  };
}

async function createPlanFromUrl(options: PlanOptions): Promise<ContentPlan> {
  if (!options.url) {
    throw new Error("Cannot build URL plan without url");
  }

  const response = await fetch(options.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch URL for plan fallback: ${options.url} (${response.status})`);
  }

  const html = await response.text();
  const heading = extractHeading(html);
  const subheading = extractSubheading(html);
  const cta = extractCta(html);
  const title = extractTagContent(html, "title") ?? heading;
  const description = extractMetaDescription(html) ?? subheading;
  const canonical = extractCanonical(html) ?? options.url;
  const pageType = options.slug === "home" ? "home" : "simple";
  const layoutKey = options.slug === "home" ? "homeLayout" : "simpleLayout";

  const plan: ContentPlan = {
    page: {
      slug: options.slug,
      locale: options.locale,
      sourceUrl: options.url,
      pageType,
      layoutKey,
      conversionConfig: {
        intent: "book",
        eventName: "hero_primary_cta_click",
        eventCategory: "conversion",
        destination: {
          type: "url",
          value: options.url
        }
      },
      seo: {
        metaTitle: truncateText(title, 255),
        metaDescription: truncateText(description, 255),
        canonical,
        robots: "index,follow"
      }
    },
    blocks: [
      {
        __component: "blocks.hero",
        heading: truncateText(heading, 255),
        subheading: truncateText(subheading, 255),
        ctaLabel: truncateText(cta.label, 255),
        ctaHref: truncateText(cta.href, 255),
        conversionConfig: {
          intent: "book",
          eventName: "hero_primary_cta_click",
          eventCategory: "conversion",
          destination: {
            type: "url",
            value: cta.href.startsWith("http") ? cta.href : options.url
          }
        }
      }
    ],
    publish: {
      state: "draft"
    },
    source: {
      fetchedAt: new Date().toISOString(),
      schemaVersion: "content-plan.v1"
    }
  };

  return validateContentPlan(plan);
}

function extractHeading(html: string): string {
  const match =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ??
    html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) ??
    html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (!match) {
    throw new Error("Unable to derive heading from URL source");
  }
  return stripTags(match[1]);
}

function extractSubheading(html: string): string {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (match) {
    const text = stripTags(match[1]);
    if (text) {
      return text;
    }
  }
  return "Learn more";
}

function extractCta(html: string): { label: string; href: string } {
  const match = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!match) {
    return { label: "Learn more", href: "/" };
  }
  const href = match[1].trim() || "/";
  const label = stripTags(match[2]) || "Learn more";
  return { label, href };
}

function extractMetaDescription(html: string): string | undefined {
  const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  return match ? stripTags(match[1]) : undefined;
}

function extractCanonical(html: string): string | undefined {
  const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  return match ? match[1].trim() : undefined;
}

function extractTagContent(html: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([\\\\s\\\\S]*?)<\\/${tag}>`, "i");
  const match = html.match(regex);
  if (!match) {
    return undefined;
  }
  const text = stripTags(match[1]);
  return text || undefined;
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncateText(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 3)).trim()}...`;
}
