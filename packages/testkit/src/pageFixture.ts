import type { Page } from "@lmnas/contracts";

export const homePageFixture: Page = {
  id: 1,
  slug: "home",
  pageType: "home",
  layoutKey: "homeLayout",
  conversionConfig: {
    intent: "book",
    eventName: "page_primary_cta_click"
  },
  shellAssignment: {
    scope: "site",
    shellVariantId: "shell-default",
    navbarVariantId: "navbar-default",
    footerVariantId: "footer-default"
  },
  actionBindings: [],
  exitBindings: [],
  widgetDefinitions: [],
  widgetVariants: [],
  themeScope: "theme-default",
  blocks: [
    {
      type: "hero",
      heading: "Welcome to LMNAs",
      subheading: "Composable healthcare web platform",
      productMapping: {
        product: "lens-cpq",
        industry: "complex-manufacturing"
      },
      primaryCta: {
        label: "Get Started",
        href: "/start",
        exitId: "book_appointment_primary"
      },
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
