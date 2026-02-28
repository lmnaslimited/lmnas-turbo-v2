import { describe, expect, it } from "vitest";
import { blogPostSchema, heroContract, importedDomSnapshotContract, navigationSchema, pageSchema } from "./index";

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
      ctaHref: "/start",
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
});
