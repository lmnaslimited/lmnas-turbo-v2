import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pageSchema } from "@lmnas/contracts";
import { heroBlockSchema } from "@lmnas/blocks";
import { manifestBlockTypes } from "@lmnas/block-registry";

export type SourceKind = "url" | "html";

export type ImportPlan = {
  page: {
    slug: string;
    locale: string;
    title?: string;
    pageType: string;
    layoutKey: string;
    seo?: {
      metaTitle: string;
      metaDescription: string;
      canonical: string;
      robots: string;
    };
  };
  blocks: Array<{
    type: "hero";
    data: HeroPlanData;
  }>;
  source: {
    kind: SourceKind;
    value: string;
    fetchedAt: string;
    fingerprint: string;
  };
};

export type HeroPlanData = {
  heading: string;
  subheading: string;
  ctaLabel: string;
  ctaHref: string;
  conversionConfig: {
    intent: "book" | "run_benefit" | "download" | "subscribe";
    eventName: string;
    eventCategory?: "conversion" | "engagement" | "navigation" | "experiment";
    campaignId?: string;
    utmDefaults?: {
      source?: string;
      medium?: string;
      campaign?: string;
      content?: string;
      term?: string;
    };
    destination?: {
      type: "url" | "benefit" | "asset" | "form";
      value: string;
    };
    benefitKey?: string;
  };
};

const heroPlanSchema = heroBlockSchema;

export type PlanOptions = {
  slug: string;
  locale: string;
  url?: string;
  htmlPath?: string;
};

export type ApplyOptions = {
  strapiUrl?: string;
  strapiToken?: string;
};

export async function loadHtmlSource(options: PlanOptions): Promise<{ html: string; source: ImportPlan["source"] }>{
  if (options.url) {
    const response = await fetch(options.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${options.url} (status ${response.status})`);
    }
    const html = await response.text();
    return {
      html,
      source: buildSource("url", options.url, html)
    };
  }

  if (!options.htmlPath) {
    throw new Error("Either --url or --html must be provided");
  }

  const html = await readFile(options.htmlPath, "utf8");
  return {
    html,
    source: buildSource("html", options.htmlPath, html)
  };
}

export async function createImportPlan(options: PlanOptions): Promise<ImportPlan> {
  const { html, source } = await loadHtmlSource(options);
  const heroData = extractHero(html, options.url);

  const heroBlock = heroPlanSchema.parse({
    type: "hero",
    ...heroData
  });
  const { type: _type, ...heroBlockData } = heroBlock;

  assertAllowlisted("hero");

  const pageType = options.slug === "home" ? "home" : "simple";
  const layoutKey = options.slug === "home" ? "homeLayout" : "simpleLayout";
  const title = extractTitle(html) ?? heroData.heading;
  const seo = buildSeo(html, options.url, heroData, title, options.slug);

  const plan: ImportPlan = {
    page: {
      slug: options.slug,
      locale: options.locale,
      title,
      pageType,
      layoutKey,
      seo
    },
    blocks: [
      {
        type: "hero",
        data: heroBlockData
      }
    ],
    source
  };

  assertPlanShape(plan);
  pageSchema.parse({
    slug: plan.page.slug,
    pageType: plan.page.pageType,
    layoutKey: plan.page.layoutKey,
    blocks: [heroBlock],
    seo: plan.page.seo
      ? {
          metaTitle: plan.page.seo.metaTitle,
          metaDescription: plan.page.seo.metaDescription,
          canonical: plan.page.seo.canonical,
          robots: plan.page.seo.robots
        }
      : {
          metaTitle: heroData.heading,
          metaDescription: heroData.subheading,
          canonical: options.url ?? `https://lmnas.com/${options.slug}`,
          robots: "index,follow"
        }
  });

  return plan;
}

export async function applyImportPlan(plan: ImportPlan, options: ApplyOptions = {}): Promise<void> {
  const validatedPlan = assertPlanShape(plan);

  for (const block of validatedPlan.blocks) {
    assertAllowlisted(block.type);
    heroPlanSchema.parse({ type: block.type, ...(block.data as HeroPlanData) });
  }

  const payload = buildStrapiPayload(validatedPlan);
  const strapiUrl = options.strapiUrl ?? process.env.STRAPI_URL ?? "http://localhost:1337";
  const strapiToken = options.strapiToken ?? process.env.STRAPI_TOKEN ?? "";

  const existingId = await findExistingPageId(strapiUrl, strapiToken, validatedPlan.page.slug, validatedPlan.page.locale);

  if (existingId) {
    await writeStrapiPage(strapiUrl, strapiToken, payload, existingId);
  } else {
    await writeStrapiPage(strapiUrl, strapiToken, payload);
  }
}

export function assertAllowlisted(type: string): void {
  if (!manifestBlockTypes.includes(type as (typeof manifestBlockTypes)[number])) {
    throw new Error(`Block type not allowlisted by manifest: ${type}`);
  }
}

export function buildStrapiPayload(plan: ImportPlan): { data: Record<string, unknown> } {
  const hero = plan.blocks[0].data;

  const data: Record<string, unknown> = {
    slug: plan.page.slug,
    locale: plan.page.locale,
    pageType: plan.page.pageType,
    layoutKey: plan.page.layoutKey,
    blocks: [
      {
        __component: "blocks.hero",
        heading: hero.heading,
        subheading: hero.subheading,
        ctaLabel: hero.ctaLabel,
        ctaHref: hero.ctaHref,
        conversionConfig: hero.conversionConfig
      }
    ]
  };

  if (plan.page.seo) {
    data.seo = plan.page.seo;
  }

  return { data };
}

function buildSource(kind: SourceKind, value: string, html: string): ImportPlan["source"] {
  return {
    kind,
    value,
    fetchedAt: new Date().toISOString(),
    fingerprint: createHash("sha256").update(html).digest("hex")
  };
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return undefined;
  }
  const title = stripTags(match[1]);
  return title || undefined;
}

function extractHero(html: string, sourceUrl?: string): HeroPlanData {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1Match) {
    throw new Error("Unable to locate hero heading (h1)");
  }
  const heading = stripTags(h1Match[1]);

  const afterH1 = html.slice(h1Match.index ? h1Match.index + h1Match[0].length : 0);
  const pMatch = afterH1.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!pMatch) {
    throw new Error("Unable to locate hero subheading (p)");
  }
  const subheading = stripTags(pMatch[1]);

  const anchorMatch = afterH1.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!anchorMatch) {
    throw new Error("Unable to locate hero CTA (a[href])");
  }

  const ctaHref = anchorMatch[1];
  const ctaLabel = stripTags(anchorMatch[2]);

  const conversionConfig = {
    intent: "book" as const,
    eventName: "hero_primary_cta_click",
    destination: sourceUrl ? { type: "url" as const, value: sourceUrl } : undefined
  };

  return {
    heading,
    subheading,
    ctaLabel,
    ctaHref,
    conversionConfig
  };
}

function stripTags(input: string): string {
  const withoutTags = input.replace(/<[^>]+>/g, " ");
  return decodeHtml(withoutTags).replace(/\s+/g, " ").trim();
}

function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function buildSeo(
  html: string,
  sourceUrl: string | undefined,
  hero: HeroPlanData,
  title: string,
  slug?: string
): ImportPlan["page"]["seo"] {
  const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);

  const metaTitle = title || hero.heading;
  const metaDescription = descriptionMatch ? stripTags(descriptionMatch[1]) : hero.subheading;
  const fallbackSlug = slug === "home" ? "" : slug ?? "";
  const canonical = canonicalMatch
    ? canonicalMatch[1]
    : sourceUrl ?? `https://lmnas.com/${fallbackSlug}`.replace(/\/$/, "");

  return {
    metaTitle,
    metaDescription,
    canonical,
    robots: "index,follow"
  };
}

async function findExistingPageId(
  strapiUrl: string,
  token: string,
  slug: string,
  locale: string
): Promise<number | null> {
  const query = new URLSearchParams({
    "filters[slug][$eq]": slug,
    locale
  });

  const response = await fetch(`${strapiUrl}/api/pages?${query.toString()}`, {
    headers: buildHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`Strapi lookup failed (${response.status})`);
  }

  const payload = (await response.json()) as { data?: Array<{ id?: number }> };
  const first = payload.data?.[0];
  if (!first?.id) {
    return null;
  }

  return first.id;
}

async function writeStrapiPage(
  strapiUrl: string,
  token: string,
  payload: { data: Record<string, unknown> },
  id?: number
): Promise<void> {
  const url = id ? `${strapiUrl}/api/pages/${id}` : `${strapiUrl}/api/pages`;
  const method = id ? "PUT" : "POST";

  const response = await fetch(url, {
    method,
    headers: buildHeaders(token),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Strapi write failed (${response.status}): ${body}`);
  }
}

function buildHeaders(token: string): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export function stableStringify(value: unknown): string {
  const sorted = sortKeys(value);
  return JSON.stringify(sorted, null, 2) + "\n";
}

function assertPlanShape(value: unknown): ImportPlan {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid plan: expected object");
  }

  const plan = value as ImportPlan;
  if (!plan.page || !plan.blocks || !plan.source) {
    throw new Error("Invalid plan: missing page, blocks, or source");
  }

  if (!plan.page.slug || !plan.page.locale || !plan.page.pageType || !plan.page.layoutKey) {
    throw new Error("Invalid plan: missing required page fields");
  }

  if (!Array.isArray(plan.blocks) || plan.blocks.length === 0) {
    throw new Error("Invalid plan: blocks must be a non-empty array");
  }

  if (!plan.source.kind || !plan.source.value || !plan.source.fetchedAt || !plan.source.fingerprint) {
    throw new Error("Invalid plan: source is incomplete");
  }

  if (plan.page.seo) {
    const { metaTitle, metaDescription, canonical, robots } = plan.page.seo;
    if (!metaTitle || !metaDescription || !canonical || !robots) {
      throw new Error("Invalid plan: seo is incomplete");
    }
  }

  return plan;
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
