import type { Page } from "@lmnas/contracts";

export const homePageFixture: Page = {
  id: 1,
  slug: "home",
  pageType: "home",
  layoutKey: "homeLayout",
  blocks: [
    {
      type: "hero",
      heading: "Welcome to LMNAs",
      subheading: "Composable healthcare web platform",
      ctaLabel: "Get Started",
      ctaHref: "/start",
      conversionConfig: {
        intent: "book",
        eventName: "hero_primary_cta_click"
      }
    },
    {
      type: "faq",
      title: "Common Questions",
      items: [
        {
          question: "What is LMNAs Turbo v2?",
          answer: "A block-first web platform scaffold."
        },
        {
          question: "How do I preview drafts?",
          answer: "Use /preview?slug=home&token=local-preview-token"
        }
      ]
    }
  ],
  seo: {
    metaTitle: "LMNAs Home",
    metaDescription: "LMNAs platform home page",
    canonical: "http://localhost:3000",
    robots: "index,follow"
  }
};
