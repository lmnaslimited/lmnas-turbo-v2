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
});
