import {
  blogPostSchema,
  navigationSchema,
  pageSchema,
  seoSchema,
  type BlogPost,
  type Navigation,
  type Page
} from "@lmnas/contracts";
import { blogPostFixture, footerNavigationFixture, mainNavigationFixture } from "@lmnas/testkit";

type Options = { preview?: boolean };
type PublicationStatusV5 = "PUBLISHED" | "DRAFT";

type PageAttributes = {
  slug: string;
  pageType: Page["pageType"];
  layoutKey: Page["layoutKey"];
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
      blocks {
        __typename
        ... on ComponentBlocksHero {
          heading
          subheading
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
  const component = String(block.__typename || "");

  if (component === "ComponentBlocksHero") {
    return {
      type: "hero",
      heading: block.heading,
      subheading: block.subheading,
      ctaLabel: block.ctaLabel,
      ctaHref: block.ctaHref,
      conversionConfig: block.conversionConfig
    };
  }

  if (component === "ComponentBlocksFaq") {
    return {
      type: "faq",
      title: block.title,
      items: block.items
    };
  }

  return {
    type: "unknown"
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
  const strapiUrl = process.env.STRAPI_URL || "http://localhost:1337";
  const token = process.env.STRAPI_API_TOKEN;
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
        cache: preview ? "no-store" : "force-cache",
        ...(preview ? {} : { next: { revalidate: 60 } })
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

    return pageSchema.parse({
      id: normalized.id ? Number(normalized.id) : undefined,
      slug: normalized.slug,
      pageType: normalized.pageType,
      layoutKey: normalized.layoutKey,
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

export async function getNavigationByKey(key: "main" | "footer", options: Options = {}): Promise<Navigation> {
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
    return key === "main" ? mainNavigationFixture : footerNavigationFixture;
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
