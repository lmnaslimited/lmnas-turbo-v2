import type { FAQBlock } from "@lmnas/blocks";
import type { BlogPost, Page } from "@lmnas/contracts";

type SeoOutput = {
  meta: {
    title?: string;
    description?: string;
    canonical?: string;
    robots?: string;
  };
  jsonLd: object[];
};

function buildFaqJsonLd(faq: FAQBlock) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
}

function joinBlogCanonical(slug: string): string {
  const canonicalBase = (process.env.BLOG_CANONICAL_BASE || "https://lmnas.com/blogs").replace(/\/+$/, "");
  return `${canonicalBase}/${slug.replace(/^\/+/, "")}`;
}

export function buildSeo(page: Page): SeoOutput {
  const jsonLd: object[] = [];
  const faqBlock = page.blocks.find((b) => b.type === "faq") as FAQBlock | undefined;
  if (faqBlock) {
    jsonLd.push(buildFaqJsonLd(faqBlock));
  }

  return {
    meta: {
      title: page.seo?.metaTitle,
      description: page.seo?.metaDescription,
      canonical: page.seo?.canonical,
      robots: page.seo?.robots
    },
    jsonLd
  };
}

export function buildBlogSeo(post: BlogPost): SeoOutput {
  return {
    meta: {
      title: post.seo.metaTitle,
      description: post.seo.metaDescription,
      canonical: joinBlogCanonical(post.slug),
      robots: post.seo.robots
    },
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.excerpt
      }
    ]
  };
}
