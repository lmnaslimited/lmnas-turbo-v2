import { describe, expect, it } from "vitest";
import { buildSeo } from "./index";
import { homePageFixture } from "@lmnas/testkit";

describe("seo-engine", () => {
  it("generates FAQPage JSON-LD when faq block exists", () => {
    const seo = buildSeo(homePageFixture);

    expect(seo.jsonLd).toHaveLength(1);
    expect(seo.jsonLd[0]).toMatchObject({
      "@type": "FAQPage"
    });
  });

  it("throws when required seo fields are missing", () => {
    const badPage = {
      ...homePageFixture,
      seo: {
        metaTitle: "Title",
        metaDescription: "Description"
      }
    };

    expect(() => buildSeo(badPage as never)).toThrow();
  });
});
