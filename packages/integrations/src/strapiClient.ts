import {
  blogPostSchema,
  navigationSchema,
  pageSchema,
  parseExitBinding,
  parseShellAssignment,
  seoSchema,
  type BlogPost,
  type ConversionConfig,
  type ExitBinding,
  type Navigation,
  type Page
} from "@lmnas/contracts";
import { blogPostFixture, footerNavigationFixture, mainNavigationFixture } from "@lmnas/testkit";
import { loadProjectEnv } from "./env/bootstrap";

type Options = { preview?: boolean };
type PublicationStatusV5 = "PUBLISHED" | "DRAFT";

type PageAttributes = {
  slug: string;
  pageType: Page["pageType"];
  layoutKey: Page["layoutKey"];
  conversionConfig: ConversionConfig;
  shellAssignment?: unknown;
  exitBindings?: unknown[];
  themeScope?: string;
  blocks: Array<Record<string, unknown>>;
  seo: Page["seo"];
};

type NavigationAttributes = {
  key: Navigation["key"];
  items: Navigation["items"];
};

type BlogPostAttributes = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  publishedAt?: string;
  seo: BlogPost["seo"];
};

type V4Node<T> = { id?: number | string; attributes: T };
type V5Node<T> = T & { id?: number | string; documentId?: string };

export class PageNotFoundError extends Error {
  constructor(slug: string) {
    super(`page_not_found:${slug}`);
    this.name = "PageNotFoundError";
  }
}

export class StrapiUnreachableError extends Error {
  constructor(message = "strapi_unreachable") {
    super(message);
    this.name = "StrapiUnreachableError";
  }
}

const GET_PAGE_BY_SLUG_QUERY_V5 = `
  query GetPageBySlugV5($slug: String!, $status: PublicationStatus) {
    pages(filters: { slug: { eq: $slug } }, status: $status) {
      documentId
      slug
      pageType
      layoutKey
      conversionConfig {
        intent
        eventName
        eventCategory
        campaignId
        utmDefaults
        destination
        benefitKey
      }
      shellAssignment {
        scope
        shellVariantId
        pageSlug
        navbarVariantId
        footerVariantId
      }
      exitBindings {
        id
        exitId
        locationType
        locationId
        label
      }
      themeScope
      blocks {
        __typename
        ... on ComponentBlocksHero {
          heading
          subheading
          productMapping
          primaryCta
          secondaryCta
          ctaLabel
          ctaHref
          conversionConfig {
            intent
            eventName
            eventCategory
            campaignId
            utmDefaults
            destination
            benefitKey
          }
        }
        ... on ComponentBlocksFaq {
          title
          items
        }
        ... on ComponentBlocksImportedDomSnapshot {
          domJson
          classMap
          stylesheetRef
        }
      }
      seo {
        metaTitle
        metaDescription
        canonical
        robots
      }
    }
  }
`;

const GET_NAVIGATION_BY_KEY_QUERY_V5 = `
  query GetNavigationByKeyV5($key: String!, $status: PublicationStatus) {
    navigations(filters: { key: { eq: $key } }, status: $status) {
      documentId
      key
      items
    }
  }
`;

const GET_BLOG_POSTS_QUERY_V5 = `
  query GetBlogPostsV5($status: PublicationStatus) {
    blogPosts(status: $status, sort: "publishedAt:desc") {
      documentId
      slug
      title
      excerpt
      body
      publishedAt
      seo {
        metaTitle
        metaDescription
        canonical
        robots
      }
    }
  }
`;

const GET_BLOG_POST_BY_SLUG_QUERY_V5 = `
  query GetBlogPostBySlugV5($slug: String!, $status: PublicationStatus) {
    blogPosts(filters: { slug: { eq: $slug } }, status: $status) {
      documentId
      slug
      title
      excerpt
      body
      publishedAt
      seo {
        metaTitle
        metaDescription
        canonical
        robots
      }
    }
  }
`;

function normalizeStrapiBlock(block: Record<string, unknown>): Record<string, unknown> {
  const component = String(block.__component || block.__typename || "");

  if (component === "ComponentBlocksHero" || component === "blocks.hero") {
    const primaryCta = normalizePrimaryCta(block);
    const productMapping = normalizeProductMapping(block);

    return {
      type: "hero",
      heading: block.heading,
      subheading: block.subheading,
      productMapping,
      primaryCta,
      secondaryCta: normalizeSecondaryCta(block),
      ctaLabel: primaryCta.label,
      ctaHref: primaryCta.href,
      conversionConfig: normalizeHeroConversionConfig(block.conversionConfig)
    };
  }

  if (component === "ComponentBlocksFaq" || component === "blocks.faq") {
    return {
      type: "faq",
      title: block.title,
      items: block.items
    };
  }

  if (component === "ComponentBlocksImportedDomSnapshot" || component === "blocks.imported-dom-snapshot") {
    return {
      type: "imported_dom_snapshot",
      domJson: block.domJson,
      classMap: block.classMap,
      stylesheetRef: block.stylesheetRef
    };
  }

  return {
    type: "unknown"
  };
}

function normalizeHeroConversionConfig(value: unknown): Record<string, unknown> {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  const intent =
    source.intent === "book" || source.intent === "run_benefit" || source.intent === "download" || source.intent === "subscribe"
      ? source.intent
      : "book";

  const eventCategory =
    source.eventCategory === "conversion" ||
    source.eventCategory === "engagement" ||
    source.eventCategory === "navigation" ||
    source.eventCategory === "experiment"
      ? source.eventCategory
      : undefined;

  const campaignId = typeof source.campaignId === "string" && source.campaignId.trim().length > 0 ? source.campaignId : undefined;
  const benefitKey = typeof source.benefitKey === "string" && source.benefitKey.trim().length > 0 ? source.benefitKey : undefined;

  const utmDefaults =
    source.utmDefaults && typeof source.utmDefaults === "object" && !Array.isArray(source.utmDefaults)
      ? (source.utmDefaults as Record<string, unknown>)
      : undefined;

  const destination =
    source.destination && typeof source.destination === "object" && !Array.isArray(source.destination)
      ? (source.destination as Record<string, unknown>)
      : undefined;

  const normalized: Record<string, unknown> = {
    intent,
    eventName: typeof source.eventName === "string" && source.eventName.trim().length > 0 ? source.eventName : "hero_primary_cta_click",
    ...(eventCategory ? { eventCategory } : {})
  };

  if (campaignId) {
    normalized.campaignId = campaignId;
  }
  if (benefitKey) {
    normalized.benefitKey = benefitKey;
  }
  if (utmDefaults) {
    normalized.utmDefaults = Object.fromEntries(
      Object.entries(utmDefaults).filter(([, entry]) => typeof entry === "string" && entry.trim().length > 0)
    );
  }
  if (
    destination &&
    (destination.type === "url" || destination.type === "benefit" || destination.type === "asset" || destination.type === "form") &&
    typeof destination.value === "string" &&
    destination.value.trim().length > 0
  ) {
    normalized.destination = {
      type: destination.type,
      value: destination.value
    };
  }

  return normalized;
}

function normalizePrimaryCta(block: Record<string, unknown>): { label: string; href: string; exitId?: string } {
  const fromStructured = block.primaryCta;
  if (fromStructured && typeof fromStructured === "object" && !Array.isArray(fromStructured)) {
    const source = fromStructured as Record<string, unknown>;
    const label = typeof source.label === "string" && source.label.trim().length > 0 ? source.label : "Learn more";
    const href = typeof source.href === "string" && source.href.trim().length > 0 ? source.href : "/";
    const exitId = typeof source.exitId === "string" && source.exitId.trim().length > 0 ? source.exitId : undefined;
    return { label, href, ...(exitId ? { exitId } : {}) };
  }

  const label = typeof block.ctaLabel === "string" && block.ctaLabel.trim().length > 0 ? block.ctaLabel : "Learn more";
  const href = typeof block.ctaHref === "string" && block.ctaHref.trim().length > 0 ? block.ctaHref : "/";
  return { label, href };
}

function normalizeSecondaryCta(block: Record<string, unknown>) {
  const source = block.secondaryCta;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return undefined;
  }

  const secondary = source as Record<string, unknown>;
  if (typeof secondary.label !== "string" || typeof secondary.href !== "string") {
    return undefined;
  }

  const normalized = {
    label: secondary.label,
    href: secondary.href,
    ...(typeof secondary.exitId === "string" ? { exitId: secondary.exitId } : {})
  };

  return normalized;
}

function normalizeProductMapping(block: Record<string, unknown>): { product: string; industry: string } {
  const source = block.productMapping;
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const mapping = source as Record<string, unknown>;
    const product = typeof mapping.product === "string" && mapping.product.trim().length > 0 ? mapping.product : "unmapped-product";
    const industry =
      typeof mapping.industry === "string" && mapping.industry.trim().length > 0 ? mapping.industry : "unmapped-industry";
    return { product, industry };
  }

  return {
    product: "unmapped-product",
    industry: "unmapped-industry"
  };
}

function getPublicationStatusV5(options: Options): PublicationStatusV5 {
  return options.preview ? "DRAFT" : "PUBLISHED";
}

function unwrapNode<T>(node: V4Node<T> | V5Node<T>): V5Node<T> {
  if (node && typeof node === "object" && "attributes" in node) {
    const v4Node = node as V4Node<T>;
    return {
      ...(v4Node.attributes as T),
      id: v4Node.id
    } as V5Node<T>;
  }

  return node as V5Node<T>;
}

function pickCollectionNodes<T>(payload: Record<string, unknown>, key: string): Array<V4Node<T> | V5Node<T>> {
  const root = payload[key] as unknown;
  if (Array.isArray(root)) {
    return root as Array<V4Node<T> | V5Node<T>>;
  }

  if (root && typeof root === "object" && Array.isArray((root as { data?: unknown[] }).data)) {
    return (root as { data: Array<V4Node<T> | V5Node<T>> }).data;
  }

  return [];
}

async function requestStrapiGraphql<T>(query: string, variables: Record<string, unknown>, preview = false): Promise<T> {
  loadProjectEnv();
  const strapiUrl = process.env.STRAPI_URL || "http://localhost:1337";
  const token = process.env.STRAPI_API_TOKEN;
  const bypassCache = preview || process.env.NODE_ENV !== "production";
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${strapiUrl}/graphql`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ query, variables }),
        cache: bypassCache ? "no-store" : "force-cache",
        ...(bypassCache ? {} : { next: { revalidate: 60 } })
      });

      if (!response.ok) {
        const details = await response.text();
        throw new StrapiUnreachableError(`strapi_unreachable:http_${response.status}${details ? `:${details}` : ""}`);
      }

      const payload = (await response.json()) as {
        data?: T;
        errors?: Array<{ message?: string }>;
      };

      if (payload.errors?.length) {
        throw new StrapiUnreachableError(`strapi_unreachable:graphql_${payload.errors[0]?.message || "unknown"}`);
      }

      if (!payload.data) {
        throw new StrapiUnreachableError("strapi_unreachable:missing_data");
      }

      return payload.data;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
      }
    }
  }

  throw lastError instanceof StrapiUnreachableError ? lastError : new StrapiUnreachableError();
}

type StrapiErrorLogDetails = {
  message: string;
  httpStatus?: string;
  responseBody?: string;
};

function getStrapiErrorLogDetails(error: unknown): StrapiErrorLogDetails {
  const message = error instanceof Error ? error.message : String(error);
  const details: StrapiErrorLogDetails = { message };

  const httpMatch = message.match(/strapi_unreachable:http_(\d+)(?::(.*))?/);
  if (httpMatch) {
    details.httpStatus = httpMatch[1];
    if (httpMatch[2]) {
      details.responseBody = httpMatch[2];
    }
  }

  return details;
}

export async function getPageBySlug(slug: string, options: Options = {}): Promise<Page> {
  const loadPage = async (): Promise<Page> => {
    const data = (await requestStrapiGraphql<Record<string, unknown>>(
      GET_PAGE_BY_SLUG_QUERY_V5,
      {
        slug,
        status: getPublicationStatusV5(options)
      },
      options.preview
    )) as Record<string, unknown>;

    const first = pickCollectionNodes<PageAttributes>(data, "pages")[0];

    if (!first) {
      throw new PageNotFoundError(slug);
    }

    const normalized = unwrapNode<PageAttributes>(first);
    const parsedShellAssignment = normalized.shellAssignment ? parseShellAssignment(normalized.shellAssignment) : undefined;
    const parsedExitBindings: ExitBinding[] = Array.isArray(normalized.exitBindings)
      ? normalized.exitBindings.map((binding, index) => {
          if (binding && typeof binding === "object" && !Array.isArray(binding)) {
            const record = binding as Record<string, unknown>;
            return parseExitBinding({
              ...record,
              id: typeof record.id === "string" ? record.id : String(record.id ?? `exit-binding-${index + 1}`)
            });
          }
          return parseExitBinding(binding);
        })
      : [];

    return pageSchema.parse({
      id: normalized.id ? Number(normalized.id) : undefined,
      slug: normalized.slug,
      pageType: normalized.pageType,
      layoutKey: normalized.layoutKey,
      conversionConfig: normalized.conversionConfig,
      shellAssignment: parsedShellAssignment,
      exitBindings: parsedExitBindings,
      themeScope: typeof normalized.themeScope === "string" ? normalized.themeScope : undefined,
      blocks: normalized.blocks.map((block) => normalizeStrapiBlock(block as Record<string, unknown>)),
      seo: normalized.seo
    });
  };

  try {
    return await loadPage();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      const details = getStrapiErrorLogDetails(error);
      console.warn("[integrations] strapi_error", {
        slug,
        preview: options.preview === true,
        message: details.message,
        ...(details.httpStatus ? { httpStatus: details.httpStatus } : {}),
        ...(details.responseBody ? { responseBody: details.responseBody } : {})
      });
    }

    if (error instanceof PageNotFoundError) {
      throw error;
    }

    if (error instanceof StrapiUnreachableError) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[integrations] ${error.message} slug=${slug} preview=${options.preview === true}`);
      }
      throw error;
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn(`[integrations] strapi_unreachable slug=${slug} preview=${options.preview === true}`);
    }

    throw new StrapiUnreachableError();
  }
}

export async function getNavigationByKey(key: "main" | "footer" | "utility", options: Options = {}): Promise<Navigation> {
  try {
    const data = (await requestStrapiGraphql<Record<string, unknown>>(
      GET_NAVIGATION_BY_KEY_QUERY_V5,
      {
        key,
        status: getPublicationStatusV5(options)
      },
      options.preview
    )) as Record<string, unknown>;

    const first = pickCollectionNodes<NavigationAttributes>(data, "navigations")[0];
    if (!first) {
      throw new Error(`Navigation with key '${key}' not found`);
    }

    const normalized = unwrapNode<NavigationAttributes>(first);
    return navigationSchema.parse({
      id: normalized.id ? Number(normalized.id) : undefined,
      key: normalized.key,
      items: normalized.items
    });
  } catch {
    if (key === "main") {
      return mainNavigationFixture;
    }
    if (key === "footer") {
      return footerNavigationFixture;
    }
    return {
      key: "utility",
      items: []
    };
  }
}

function normalizeBlogPost(raw: V4Node<BlogPostAttributes> | V5Node<BlogPostAttributes>): BlogPost {
  const normalized = unwrapNode<BlogPostAttributes>(raw);

  return blogPostSchema.parse({
    id: normalized.id ? Number(normalized.id) : undefined,
    slug: normalized.slug,
    title: normalized.title,
    excerpt: normalized.excerpt,
    body: normalized.body,
    publishedAt: normalized.publishedAt,
    seo: seoSchema.parse(normalized.seo)
  });
}

export async function getBlogPosts(options: Options = {}): Promise<BlogPost[]> {
  try {
    const data = (await requestStrapiGraphql<Record<string, unknown>>(
      GET_BLOG_POSTS_QUERY_V5,
      {
        status: getPublicationStatusV5(options)
      },
      options.preview
    )) as Record<string, unknown>;

    return pickCollectionNodes<BlogPostAttributes>(data, "blogPosts").map(normalizeBlogPost);
  } catch {
    return [blogPostFixture];
  }
}

export async function getBlogPostBySlug(slug: string, options: Options = {}): Promise<BlogPost> {
  try {
    const data = (await requestStrapiGraphql<Record<string, unknown>>(
      GET_BLOG_POST_BY_SLUG_QUERY_V5,
      {
        slug,
        status: getPublicationStatusV5(options)
      },
      options.preview
    )) as Record<string, unknown>;

    const first = pickCollectionNodes<BlogPostAttributes>(data, "blogPosts")[0];
    if (!first) {
      throw new Error(`Blog post with slug '${slug}' not found`);
    }

    return normalizeBlogPost(first);
  } catch {
    if (slug === blogPostFixture.slug) {
      return blogPostFixture;
    }

    return {
      ...blogPostFixture,
      slug,
      seo: {
        ...blogPostFixture.seo,
        canonical: `https://lmnas.com/blogs/${slug}`
      }
    };
  }
}
