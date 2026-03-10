import { beforeAll, afterAll, afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { getBlogPostBySlug, getBlogPosts, getNavigationByKey, getPageBySlug, PageNotFoundError } from "./strapiClient";

const receivedVariables: Array<Record<string, unknown>> = [];

const server = setupServer(
  http.post("http://localhost:1337/graphql", async ({ request }) => {
    const body = (await request.json()) as { query?: string; variables?: Record<string, unknown> };
    const query = body.query ?? "";
    receivedVariables.push(body.variables ?? {});

    if (query.includes("GetPageBySlug")) {
      return HttpResponse.json({
        data: {
          pages: [
            {
              documentId: "page-home",
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
              exitBindings: [],
              themeScope: "theme-default",
              blocks: [
                {
                  __typename: "ComponentBlocksHero",
                  heading: "Hello",
                  subheading: "Sub",
                  productMapping: {
                    product: "lens-cpq",
                    industry: "complex-manufacturing"
                  },
                  primaryCta: {
                    label: "Go",
                    href: "/go",
                    exitId: "book_appointment_primary"
                  },
                  ctaLabel: "Go",
                  ctaHref: "/go",
                  conversionConfig: {
                    intent: "book",
                    eventName: "hero_primary_cta_click"
                  }
                },
                {
                  __typename: "ComponentBlocksFaq",
                  title: "FAQ",
                  items: [{ question: "Q", answer: "A" }]
                }
              ],
              seo: {
                metaTitle: "Title",
                metaDescription: "Description",
                canonical: "https://lmnas.com",
                robots: "index,follow"
              }
            }
          ]
        }
      });
    }

    if (query.includes("GetNavigationByKey")) {
      return HttpResponse.json({
        data: {
          navigations: [
            {
              documentId: "nav-main",
              key: "main",
              items: [{ label: "Products", children: [{ label: "CPQ", href: "/products/cpq" }] }]
            }
          ]
        }
      });
    }

    if (query.includes("GetBlogPosts")) {
      return HttpResponse.json({
        data: {
          blogPosts: [
            {
              documentId: "blog-first-post",
              slug: "first-post",
              title: "First Post",
              excerpt: "Ex",
              body: "Body",
              publishedAt: "2026-01-01T00:00:00.000Z",
              seo: {
                metaTitle: "First Post",
                metaDescription: "Ex",
                canonical: "https://lmnas.com/blogs/first-post",
                robots: "index,follow"
              }
            }
          ]
        }
      });
    }

    if (query.includes("GetBlogPostBySlug")) {
      return HttpResponse.json({
        data: {
          blogPosts: [
            {
              documentId: "blog-phase-0-baseline",
              slug: "phase-0-baseline",
              title: "Phase 0",
              excerpt: "Summary",
              body: "Body",
              publishedAt: "2026-01-02T00:00:00.000Z",
              seo: {
                metaTitle: "Phase 0",
                metaDescription: "Summary",
                canonical: "https://lmnas.com/blogs/phase-0-baseline",
                robots: "index,follow"
              }
            }
          ]
        }
      });
    }

    return HttpResponse.json({ data: {} });
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  receivedVariables.length = 0;
});
afterAll(() => server.close());

describe("strapiClient", () => {
  it("maps and validates page responses from GraphQL", async () => {
    process.env.STRAPI_URL = "http://localhost:1337";

    const page = await getPageBySlug("home");

    expect(page.slug).toBe("home");
    expect(page.pageType).toBe("home");
    expect(page.blocks[0]).toMatchObject({ type: "hero", heading: "Hello" });
    expect(receivedVariables[0]?.slug).toBe("home");
  });

  it("maps imported-dom-snapshot blocks from __component payloads", async () => {
    process.env.STRAPI_URL = "http://localhost:1337";

    server.use(
      http.post("http://localhost:1337/graphql", async ({ request }) => {
        const body = (await request.json()) as { query?: string };
        if (!(body.query ?? "").includes("GetPageBySlug")) {
          return HttpResponse.json({ data: {} });
        }

        return HttpResponse.json({
          data: {
            pages: [
              {
                documentId: "page-home",
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
                exitBindings: [],
                themeScope: "theme-default",
                blocks: [
                  {
                    __component: "blocks.imported-dom-snapshot",
                    domJson: {
                      kind: "root",
                      children: []
                    },
                    classMap: {
                      "0": "theme-default"
                    },
                    stylesheetRef: "/generated/imported/imported-abc123.css"
                  }
                ],
                seo: {
                  metaTitle: "Title",
                  metaDescription: "Description",
                  canonical: "https://lmnas.com",
                  robots: "index,follow"
                }
              }
            ]
          }
        });
      })
    );

    const page = await getPageBySlug("home");

    expect(page.blocks[0]).toEqual({
      type: "imported_dom_snapshot",
      domJson: {
        kind: "root",
        children: []
      },
      classMap: {
        "0": "theme-default"
      },
      stylesheetRef: "/generated/imported/imported-abc123.css"
    });
  });

  it("normalizes nullable hero conversion config fields from Strapi", async () => {
    process.env.STRAPI_URL = "http://localhost:1337";

    server.use(
      http.post("http://localhost:1337/graphql", async ({ request }) => {
        const body = (await request.json()) as { query?: string };
        if (!(body.query ?? "").includes("GetPageBySlug")) {
          return HttpResponse.json({ data: {} });
        }

        return HttpResponse.json({
          data: {
            pages: [
              {
                documentId: "page-home",
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
                exitBindings: [],
                themeScope: "theme-default",
                blocks: [
                  {
                    __typename: "ComponentBlocksHero",
                    heading: "Hello",
                    subheading: "Sub",
                    productMapping: {
                      product: "lens-cpq",
                      industry: "complex-manufacturing"
                    },
                    primaryCta: {
                      label: "Go",
                      href: "/go",
                      exitId: "book_appointment_primary"
                    },
                    conversionConfig: {
                      intent: "book",
                      eventName: "hero_primary_cta_click",
                      campaignId: null,
                      utmDefaults: null,
                      benefitKey: null
                    }
                  }
                ],
                seo: {
                  metaTitle: "Title",
                  metaDescription: "Description",
                  canonical: "https://lmnas.com",
                  robots: "index,follow"
                }
              }
            ]
          }
        });
      })
    );

    const page = await getPageBySlug("home");
    expect(page.blocks[0]).toMatchObject({
      type: "hero",
      heading: "Hello",
      conversionConfig: {
        intent: "book",
        eventName: "hero_primary_cta_click"
      }
    });
  });

  it("queries requested slug for nested routes", async () => {
    process.env.STRAPI_URL = "http://localhost:1337";

    await getPageBySlug("products/cpq");

    expect(receivedVariables[0]?.slug).toBe("products/cpq");
  });

  it("returns published data for LIVE and draft data for PREVIEW", async () => {
    process.env.STRAPI_URL = "http://localhost:1337";

    server.use(
      http.post("http://localhost:1337/graphql", async ({ request }) => {
        const body = (await request.json()) as { query?: string; variables?: Record<string, unknown> };
        if (!(body.query ?? "").includes("GetPageBySlug")) {
          return HttpResponse.json({ data: {} });
        }

        const status = body.variables?.status;
        const isPreview = status === "DRAFT";
        const metaTitle = isPreview ? "Home Draft" : "Home Published";

        return HttpResponse.json({
          data: {
            pages: [
              {
                documentId: "page-home",
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
                exitBindings: [],
                themeScope: "theme-default",
                blocks: [],
                seo: {
                  metaTitle,
                  metaDescription: "Description",
                  canonical: "https://lmnas.com",
                  robots: "index,follow"
                }
              }
            ]
          }
        });
      })
    );

    const published = await getPageBySlug("home", { preview: false });
    const draft = await getPageBySlug("home", { preview: true });

    expect(published.seo.metaTitle).toBe("Home Published");
    expect(draft.seo.metaTitle).toBe("Home Draft");
  });

  it("loads navigation by key from GraphQL", async () => {
    process.env.STRAPI_URL = "http://localhost:1337";

    const navigation = await getNavigationByKey("main");

    expect(navigation.key).toBe("main");
    expect(navigation.items[0].label).toBe("Products");
  });

  it("loads blog list and detail from GraphQL", async () => {
    process.env.STRAPI_URL = "http://localhost:1337";

    const posts = await getBlogPosts();
    const post = await getBlogPostBySlug("phase-0-baseline");

    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe("first-post");
    expect(post.slug).toBe("phase-0-baseline");
  });

  it("throws page_not_found when page query returns empty result", async () => {
    server.use(
      http.post("http://localhost:1337/graphql", async ({ request }) => {
        const body = (await request.json()) as { query?: string };
        if ((body.query ?? "").includes("GetPageBySlug")) {
          return HttpResponse.json({
            data: {
              pages: []
            }
          });
        }
        return HttpResponse.json({ data: {} });
      })
    );

    await expect(getPageBySlug("does-not-exist")).rejects.toBeInstanceOf(PageNotFoundError);
  });

  it("does not silently fallback to page mock when Strapi is unreachable", async () => {
    server.use(
      http.post("http://localhost:1337/graphql", () => HttpResponse.json({ errors: [{ message: "down" }] }, { status: 500 }))
    );

    await expect(getPageBySlug("home")).rejects.toThrow("strapi_unreachable");
  });

});
