import { describe, expect, it } from "vitest";
import {
  actionBindingSchema,
  blogPostSchema,
  heroContract,
  importedDomSnapshotContract,
  navigationSchema,
  onboardingAnalysisSchema,
  pageSchema,
  parseExitDefinition
} from "./index";

const validPage = {
  slug: "home",
  pageType: "home",
  layoutKey: "homeLayout",
  conversionConfig: {
    intent: "book",
    eventName: "page_primary_cta_click"
  },
  shellAssignment: {
    scope: "page",
    shellVariantId: "shell-default",
    navbarVariantId: "navbar-default",
    footerVariantId: "footer-default"
  },
  blocks: [
    {
      type: "hero",
      heading: "Welcome",
      subheading: "Sub",
      productMapping: {
        product: "lens-cpq",
        industry: "complex-manufacturing"
      },
      primaryCta: {
        label: "Start",
        href: "/start",
        exitId: "book_appointment_primary"
      },
      conversionConfig: {
        intent: "book",
        eventName: "hero_primary_cta_click"
      }
    }
  ],
  seo: {
    metaTitle: "Title",
    metaDescription: "Description",
    canonical: "http://localhost:3000",
    robots: "index,follow"
  }
};

describe("contracts", () => {
  it("requires canonical and robots seo fields", () => {
    const missingSeo = {
      ...validPage,
      seo: {
        metaTitle: "ok",
        metaDescription: "ok"
      }
    };

    const parsed = pageSchema.safeParse(missingSeo);
    expect(parsed.success).toBe(false);
  });

  it("requires page-level conversion configuration", () => {
    const missingConversionConfig = {
      ...validPage,
      conversionConfig: undefined
    };

    const parsed = pageSchema.safeParse(missingConversionConfig);
    expect(parsed.success).toBe(false);
  });

  it("accepts navigation with grouped depth <=2", () => {
    const parsed = navigationSchema.safeParse({
      key: "main",
      items: [
        {
          label: "Products",
          destination: {
            type: "internal",
            value: "/products"
          },
          children: [{ label: "CPQ", destination: { type: "internal", value: "/products/cpq" }, children: [] }]
        }
      ]
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts blog posts with seo metadata", () => {
    const parsed = blogPostSchema.safeParse({
      slug: "phase-0-baseline",
      title: "Phase 0 Baseline",
      excerpt: "Summary",
      body: "Body",
      seo: {
        metaTitle: "Phase 0 Baseline",
        metaDescription: "Summary",
        canonical: "https://lmnas.com/blogs/phase-0-baseline",
        robots: "index,follow"
      }
    });
    expect(parsed.success).toBe(true);
  });

  it("exports hero block contract metadata", () => {
    expect(heroContract.type).toBe("hero");
    expect(heroContract.meta.strapi.schemaPath).toBe("services/strapi/src/components/blocks/hero.json");
  });

  it("exports imported dom snapshot contract metadata", () => {
    expect(importedDomSnapshotContract.type).toBe("imported_dom_snapshot");
    expect(importedDomSnapshotContract.meta.strapi.schemaPath).toBe(
      "services/strapi/src/components/blocks/imported-dom-snapshot.json"
    );
  });

  it("parses onboarding analysis payload", () => {
    const parsed = onboardingAnalysisSchema.safeParse({
      intake: {
        sourceType: "url",
        sourceValue: "https://example.com",
        slug: "home",
        locale: "en",
        themeKey: "default"
      },
      source: {
        sourceRef: "https://example.com",
        title: "Example",
        previewHtml: "<section>Preview</section>"
      },
      shellCandidates: [
        {
          id: "navbar-candidate-1",
          type: "navbar",
          selectorHint: "<nav>",
          confidence: 0.9,
          menuItems: [],
          editableFields: ["navItemLabel"],
          ctaLabels: ["Book Appointment"],
          previewHtml: "<nav>...</nav>"
        }
      ],
      blockProposals: [
        {
          id: "block-1",
          family: "hero",
          selectorHint: "section.hero",
          confidence: 0.8,
          editableFields: ["heading"],
          ctaLabels: ["Book Appointment"],
          actionIds: ["action-book"],
          segmentation: "keep",
          rawHtmlSnippet: "<section class='hero'>...</section>"
        }
      ],
      widgetProposals: [
        {
          id: "widget-booking",
          name: "Booking Popup",
          widgetType: "booking_popup",
          selectorHint: "button.book",
          confidence: 0.78,
          editableFields: ["heading", "buttonText"],
          triggerLabels: ["Book Appointment"],
          associatedActionIds: ["action-book"]
        }
      ],
      actionProposals: [
        {
          id: "action-book",
          label: "Book Appointment",
          selectorHint: "a[href='/book']",
          confidence: 0.9,
          actionType: "open_widget",
          sourceSurface: "block",
          sourceItemId: "block-1",
          destination: {
            kind: "widget",
            value: "widget-booking"
          },
          suggestedExitId: "book_appointment_primary",
          summary: "Open booking widget"
        }
      ],
      exitProposals: [
        {
          id: "book_appointment_primary",
          name: "Book Appointment",
          eventName: "exit_book_appointment_primary",
          selectorHint: "a[href='/book']",
          confidence: 0.95,
          state: "active",
          frontendAdapterType: "redirect",
          backendAdapterType: "n8n_webhook",
          workflowTarget: {
            kind: "n8n_webhook",
            value: "https://n8n.example.com/webhook/book"
          },
          sourceActionId: "action-book",
          suggestedBinding: {
            locationType: "block",
            locationId: "block-1"
          }
        }
      ],
      theme: {
        themeKey: "default",
        tokenFirstMatchRatio: 0.75,
        arbitraryValueCount: 2,
        themeDebtSummary: "2 arbitrary values should be tokenized"
      },
      fidelityWarnings: []
    });

    expect(parsed.success).toBe(true);
  });

  it("requires action targets for action binding contract", () => {
    const parsed = actionBindingSchema.safeParse({
      id: "action-binding-1",
      label: "Book Appointment",
      actionType: "open_widget",
      locationType: "block",
      locationId: "block-1"
    });

    expect(parsed.success).toBe(false);
  });

  it("parses governed exit definition", () => {
    const parsed = parseExitDefinition({
      id: "book_appointment_primary",
      name: "Book Appointment",
      state: "active",
      eventName: "exit_book_appointment_primary",
      payloadSchema: {
        format: "json-schema",
        schema: {
          type: "object"
        }
      },
      frontendAdapterType: "redirect",
      backendAdapterType: "n8n_webhook",
      workflowTarget: {
        kind: "n8n_webhook",
        value: "https://n8n.example.com/webhook/book"
      },
      fallbackBehavior: "show_contact_sales",
      successBehavior: "show_confirmation",
      failureBehavior: "show_retry",
      analyticsMapping: {
        click: "exit_book_appointment_primary"
      },
      policy: {
        environmentAllowlist: ["dev", "prod"],
        roleAllowlist: []
      }
    });

    expect(parsed.id).toBe("book_appointment_primary");
  });
});
