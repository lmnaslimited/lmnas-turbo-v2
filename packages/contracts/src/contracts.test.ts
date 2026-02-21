import { describe, expect, it } from "vitest";
import { blogPostSchema, navigationSchema, pageSchema } from "./index";

const validPage = {
  slug: "home",
  pageType: "home",
  layoutKey: "homeLayout",
  blocks: [
    {
      type: "hero",
      heading: "Welcome",
      subheading: "Sub",
      ctaLabel: "Start",
      ctaHref: "/start"
    }
  ],
  seo: {
    metaTitle: "Title",
    metaDescription: "Description",
    canonical: "http://localhost:3000",
    robots: "index,follow"
  },
  conversionConfig: {
    primary: "book",
    product: "platform",
    industry: "healthcare"
  }
};

describe("contracts", () => {
  it("requires conversionConfig on every page", () => {
    const withoutConversion = { ...validPage } as Record<string, unknown>;
    delete withoutConversion.conversionConfig;

    const parsed = pageSchema.safeParse(withoutConversion);
    expect(parsed.success).toBe(false);
  });

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

  it("accepts navigation with grouped depth <=2", () => {
    const parsed = navigationSchema.safeParse({
      key: "main",
      items: [{ label: "Products", children: [{ label: "CPQ", href: "/products/cpq" }] }]
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
});
