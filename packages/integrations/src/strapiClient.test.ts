import { beforeAll, afterAll, afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { getPageBySlug } from "./strapiClient";

const server = setupServer(
  http.get("http://localhost:1337/api/pages", () =>
    HttpResponse.json({
      data: [
        {
          id: 7,
          attributes: {
            slug: "home",
            blocks: [
              {
                __component: "blocks.hero",
                heading: "Hello",
                subheading: "Sub",
                ctaLabel: "Go",
                ctaHref: "/go"
              },
              {
                __component: "blocks.faq",
                title: "FAQ",
                items: [{ question: "Q", answer: "A" }]
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
          }
        }
      ]
    })
  )
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("strapiClient", () => {
  it("maps and validates Strapi responses", async () => {
    process.env.STRAPI_URL = "http://localhost:1337";

    const page = await getPageBySlug("home");

    expect(page.slug).toBe("home");
    expect(page.blocks[0]).toMatchObject({ type: "hero", heading: "Hello" });
    expect(page.conversionConfig.primary).toBe("book");
  });
});
