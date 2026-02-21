import { pageSchema, strapiPageResponseSchema, type Page } from "@lmnas/contracts";
import { homePageFixture } from "@lmnas/testkit";

type Options = { preview?: boolean };

function normalizeStrapiBlock(block: Record<string, unknown>): Record<string, unknown> {
  const component = String(block.__component || "");

  if (component.endsWith("hero")) {
    return {
      type: "hero",
      heading: block.heading,
      subheading: block.subheading,
      ctaLabel: block.ctaLabel,
      ctaHref: block.ctaHref
    };
  }

  if (component.endsWith("faq")) {
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

export async function getPageBySlug(slug: string, options: Options = {}): Promise<Page> {
  const strapiUrl = process.env.STRAPI_URL || "http://localhost:1337";
  const token = process.env.STRAPI_API_TOKEN;
  const state = options.preview ? "preview" : "live";
  const url = `${strapiUrl}/api/pages?filters[slug][$eq]=${encodeURIComponent(slug)}&publicationState=${state}&populate[blocks][populate]=*&populate[seo]=*`;

  try {
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Strapi returned ${response.status}`);
    }

    const rawJson = await response.json();
    const parsedResponse = strapiPageResponseSchema.parse(rawJson);
    const first = parsedResponse.data[0];

    if (!first) {
      throw new Error(`Page with slug '${slug}' not found`);
    }

    const normalizedPage = {
      id: first.id,
      slug: first.attributes.slug,
      blocks: first.attributes.blocks.map((block) => normalizeStrapiBlock(block as Record<string, unknown>)),
      seo: first.attributes.seo
    };

    return pageSchema.parse(normalizedPage);
  } catch {
    if (slug === "home") {
      return homePageFixture;
    }
    return {
      ...homePageFixture,
      slug
    };
  }
}
