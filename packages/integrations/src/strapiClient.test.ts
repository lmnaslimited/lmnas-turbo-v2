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
                primary: "book",
                product: "platform",
                industry: "healthcare"
              },
              blocks: [
                {
                  __typename: "ComponentBlocksHero",
                  heading: "Hello",
                  subheading: "Sub",
                  ctaLabel: "Go",
                  ctaHref: "/go"
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

        const state = body.variables?.state;
        const status = body.variables?.status;
        const isPreview = state === "PREVIEW" || status === "DRAFT";
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
                  primary: "book",
                  product: "platform",
                  industry: "healthcare"
                },
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

  it("falls back to v4 GraphQL schema when v5 query shape is unavailable", async () => {
    server.use(
      http.post("http://localhost:1337/graphql", async ({ request }) => {
        const body = (await request.json()) as { query?: string };
        const query = body.query ?? "";

        if (query.includes("GetPageBySlugV5")) {
          return HttpResponse.json(
            {
              errors: [
                {
                  message: "Unknown argument \"status\" on field \"Query.pages\".",
                  extensions: { code: "GRAPHQL_VALIDATION_FAILED" }
                }
              ]
            },
            { status: 400 }
          );
        }

        if (query.includes("GetPageBySlugV4")) {
          return HttpResponse.json({
            data: {
              pages: {
                data: [
                  {
                    id: 1,
                    attributes: {
                      slug: "home",
                      pageType: "home",
                      layoutKey: "homeLayout",
                      conversionConfig: {
                        primary: "book",
                        product: "platform",
                        industry: "healthcare"
                      },
                      blocks: [],
                      seo: {
                        metaTitle: "Home",
                        metaDescription: "Home",
                        canonical: "https://lmnas.com",
                        robots: "index,follow"
                      }
                    }
                  }
                ]
              }
            }
          });
        }

        return HttpResponse.json({ data: {} });
      })
    );

    const page = await getPageBySlug("home");
    expect(page.slug).toBe("home");
  });
});
