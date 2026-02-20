import type { FAQBlock } from "@lmnas/blocks";
import type { Page } from "@lmnas/contracts";

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
