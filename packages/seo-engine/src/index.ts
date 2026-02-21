import type { FAQBlock } from "@lmnas/blocks";
import { seoSchema, type Page } from "@lmnas/contracts";

type SeoOutput = {
  meta: {
    title: string;
    description: string;
    canonical: string;
    robots: string;
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

function dedupeJsonLd(items: object[]): object[] {
  const seen = new Set<string>();
  const output: object[] = [];

  for (const item of items) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      output.push(item);
    }
  }

  return output;
}

export function buildSeo(page: Page): SeoOutput {
  const validatedSeo = seoSchema.parse(page.seo);
  const jsonLd: object[] = [];
  const faqBlock = page.blocks.find((b) => b.type === "faq") as FAQBlock | undefined;

  if (faqBlock) {
    jsonLd.push(buildFaqJsonLd(faqBlock));
  }

  return {
    meta: {
      title: validatedSeo.metaTitle,
      description: validatedSeo.metaDescription,
      canonical: validatedSeo.canonical,
      robots: validatedSeo.robots
    },
    jsonLd: dedupeJsonLd(jsonLd)
  };
}
