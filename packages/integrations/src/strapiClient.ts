import {
  blogPostSchema,
  navigationSchema,
  pageSchema,
  seoSchema,
  type BlogPost,
  type Navigation,
  type Page
} from "@lmnas/contracts";
import { blogPostFixture, footerNavigationFixture, homePageFixture, mainNavigationFixture } from "@lmnas/testkit";

type Options = { preview?: boolean };
type PublicationState = "LIVE" | "PREVIEW";
type PageAttributes = {
  slug: string;
  pageType: Page["pageType"];
  layoutKey: Page["layoutKey"];
  conversionConfig: Page["conversionConfig"];
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

const GET_PAGE_BY_SLUG_QUERY = `
  query GetPageBySlug($slug: String!, $state: PublicationState) {
    pages(filters: { slug: { eq: $slug } }, publicationState: $state) {
      data {
        id
        attributes {
          slug
          pageType
          layoutKey
          conversionConfig {
            primary
            product
            industry
          }
          blocks {
            __typename
            ... on ComponentBlocksHero {
              heading
              subheading
              ctaLabel
              ctaHref
            }
            ... on ComponentBlocksFaq {
              title
              items {
                question
                answer
              }
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
    }
  }
`;

const GET_NAVIGATION_BY_KEY_QUERY = `
  query GetNavigationByKey($key: String!, $state: PublicationState) {
    navigations(filters: { key: { eq: $key } }, publicationState: $state) {
      data {
        id
        attributes {
          key
          items
        }
      }
    }
  }
`;

const GET_BLOG_POSTS_QUERY = `
  query GetBlogPosts($state: PublicationState) {
    blogPosts(publicationState: $state, sort: "publishedAt:desc") {
      data {
        id
        attributes {
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
    }
  }
`;

const GET_BLOG_POST_BY_SLUG_QUERY = `
  query GetBlogPostBySlug($slug: String!, $state: PublicationState) {
    blogPosts(filters: { slug: { eq: $slug } }, publicationState: $state) {
      data {
        id
        attributes {
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
      ctaHref: block.ctaHref
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

function getPublicationState(options: Options): PublicationState {
  return options.preview ? "PREVIEW" : "LIVE";
}

async function requestStrapiGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const strapiUrl = process.env.STRAPI_URL || "http://localhost:1337";
  const token = process.env.STRAPI_API_TOKEN;
  const response = await fetch(`${strapiUrl}/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Strapi GraphQL returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || "Unknown GraphQL error");
  }

  if (!payload.data) {
    throw new Error("GraphQL response is missing data");
  }

  return payload.data;
}

export async function getPageBySlug(slug: string, options: Options = {}): Promise<Page> {
  const state = getPublicationState(options);
  const allowMockFallback =
    process.env.ENABLE_PAGE_MOCK_FALLBACK === "true" &&
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test");

  try {
    const data = await requestStrapiGraphql<{
      pages: { data: Array<{ id: number | string; attributes: PageAttributes }> };
    }>(GET_PAGE_BY_SLUG_QUERY, { slug, state });
    const first = data.pages.data[0];

    if (!first) {
      throw new PageNotFoundError(slug);
    }

    const normalizedPage = {
      id: Number(first.id),
      slug: first.attributes.slug,
      pageType: first.attributes.pageType,
      layoutKey: first.attributes.layoutKey,
      conversionConfig: first.attributes.conversionConfig,
      blocks: first.attributes.blocks.map((block) => normalizeStrapiBlock(block as Record<string, unknown>)),
      seo: first.attributes.seo
    };

    return pageSchema.parse(normalizedPage);
  } catch (error) {
    if (error instanceof PageNotFoundError) {
      throw error;
    }

    if (allowMockFallback) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[integrations] page_mock_fallback slug=${slug} preview=${state === "PREVIEW"}`);
      }

      if (slug === "home") {
        return homePageFixture;
      }
      return {
        ...homePageFixture,
        slug
      };
    }

    if (process.env.NODE_ENV !== "production") {
      console.error(`[integrations] strapi_unreachable slug=${slug} preview=${state === "PREVIEW"}`);
    }
    throw new StrapiUnreachableError();
  }
}

export async function getNavigationByKey(key: "main" | "footer", options: Options = {}): Promise<Navigation> {
  const state = getPublicationState(options);
  try {
    const data = await requestStrapiGraphql<{
      navigations: { data: Array<{ id: number | string; attributes: NavigationAttributes }> };
    }>(GET_NAVIGATION_BY_KEY_QUERY, { key, state });

    const first = data.navigations.data[0];
    if (!first) {
      throw new Error(`Navigation with key '${key}' not found`);
    }

    return navigationSchema.parse({
      id: Number(first.id),
      key: first.attributes.key,
      items: first.attributes.items
    });
  } catch {
    return key === "main" ? mainNavigationFixture : footerNavigationFixture;
  }
}

function normalizeBlogPost(raw: { id: number | string; attributes: BlogPostAttributes }): BlogPost {
  return blogPostSchema.parse({
    id: Number(raw.id),
    slug: raw.attributes.slug,
    title: raw.attributes.title,
    excerpt: raw.attributes.excerpt,
    body: raw.attributes.body,
    publishedAt: raw.attributes.publishedAt,
    seo: seoSchema.parse(raw.attributes.seo)
  });
}

export async function getBlogPosts(options: Options = {}): Promise<BlogPost[]> {
  const state = getPublicationState(options);
  try {
    const data = await requestStrapiGraphql<{
      blogPosts: { data: Array<{ id: number | string; attributes: BlogPostAttributes }> };
    }>(GET_BLOG_POSTS_QUERY, { state });
    return data.blogPosts.data.map(normalizeBlogPost);
  } catch {
    return [blogPostFixture];
  }
}

export async function getBlogPostBySlug(slug: string, options: Options = {}): Promise<BlogPost> {
  const state = getPublicationState(options);
  try {
    const data = await requestStrapiGraphql<{
      blogPosts: { data: Array<{ id: number | string; attributes: BlogPostAttributes }> };
    }>(GET_BLOG_POST_BY_SLUG_QUERY, { slug, state });
    const first = data.blogPosts.data[0];
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
