import { describe, expect, it } from "vitest";
import { contentPlanSchema } from "../src/contracts/contentPlan.schema";

describe("contentPlan schema", () => {
  it("accepts a valid plan", () => {
    const parsed = contentPlanSchema.parse({
      page: {
        slug: "home",
        locale: "en",
        sourceUrl: "https://lmnas.com/en",
        pageType: "home",
        layoutKey: "homeLayout",
        conversionConfig: {
          intent: "book",
          eventName: "hero_primary_cta_click"
        },
        seo: {
          metaTitle: "Home",
          metaDescription: "Desc",
          canonical: "https://lmnas.com/en",
          robots: "index,follow"
        }
      },
      blocks: [{ __component: "blocks.hero", heading: "Hello" }],
      publish: { state: "draft" },
      source: { fetchedAt: new Date().toISOString(), schemaVersion: "content-plan.v1" }
    });

    expect(parsed.page.slug).toBe("home");
  });

  it("fails with blocks required", () => {
    const result = contentPlanSchema.safeParse({
      page: {
        slug: "home",
        locale: "en",
        sourceUrl: "https://lmnas.com/en",
        pageType: "home",
        layoutKey: "homeLayout",
        conversionConfig: {
          intent: "book",
          eventName: "hero_primary_cta_click"
        },
        seo: {
          metaTitle: "Home",
          metaDescription: "Desc",
          canonical: "https://lmnas.com/en",
          robots: "index,follow"
        }
      },
      blocks: [],
      publish: { state: "draft" },
      source: { fetchedAt: new Date().toISOString(), schemaVersion: "content-plan.v1" }
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("blocks required");
    }
  });
});
