import { describe, expect, it } from "vitest";
import { buildBlogSeo, buildSeo } from "./index";
import { blogPostFixture, homePageFixture } from "@lmnas/testkit";

describe("seo-engine", () => {
  it("generates FAQPage JSON-LD when faq block exists", () => {
    const seo = buildSeo(homePageFixture);

    expect(seo.jsonLd).toHaveLength(1);
    expect(seo.jsonLd[0]).toMatchObject({
      "@type": "FAQPage"
    });
  });

  it("builds canonical from BLOG_CANONICAL_BASE for blog seo", () => {
    process.env.BLOG_CANONICAL_BASE = "https://lmnas.com/blogs";

    const seo = buildBlogSeo(blogPostFixture);

    expect(seo.meta.canonical).toBe("https://lmnas.com/blogs/phase-0-baseline");
    expect(seo.jsonLd[0]).toMatchObject({
      "@type": "Article"
    });
  });
});
