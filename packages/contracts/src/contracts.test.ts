import { describe, expect, it } from "vitest";
import { pageSchema } from "./index";

const validPage = {
  slug: "home",
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
});
