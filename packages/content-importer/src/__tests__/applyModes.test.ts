import { afterEach, describe, expect, it, vi } from "vitest";
import planFixture from "./fixtures/plan-home.json";
import introspectionFixture from "./fixtures/introspection.json";
import { applyImportPlan } from "../index.js";
import { createPageRepository } from "../strapi/pageRepository.js";

type GraphqlRequestBody = {
  operationName: string;
  query: string;
  variables?: Record<string, unknown>;
};

type Resolver = (body: GraphqlRequestBody, calls: GraphqlRequestBody[]) => Response;

const TEST_STRAPI_URL = "http://localhost:1337";
const TEST_STRAPI_TOKEN = "123456789012345678901234567890";
const TEST_GRAPHQL_PATH = "/graphql";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setupGraphqlMock(resolver: Resolver): GraphqlRequestBody[] {
  const calls: GraphqlRequestBody[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const raw = typeof init?.body === "string" ? init.body : "{}";
      const body = JSON.parse(raw) as GraphqlRequestBody;
      calls.push(body);
      return resolver(body, calls);
    })
  );

  return calls;
}

function ok(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function operationError(message: string): Response {
  return new Response(
    JSON.stringify({
      errors: [
        {
          message,
          path: ["mutation"]
        }
      ]
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" }
    }
  );
}

function findRows(rows: Array<Record<string, unknown>>): Response {
  return ok({ pages: rows });
}

function pageRow(input: { documentId: string; slug?: string; publishedAt?: string | null }): Record<string, unknown> {
  return {
    documentId: input.documentId,
    slug: input.slug ?? "home",
    pageType: "home",
    layoutKey: "homeLayout",
    publishedAt: input.publishedAt ?? null,
    conversionConfig: {
      intent: "book",
      eventName: "hero_primary_cta_click"
    },
    seo: {
      metaTitle: "Home",
      metaDescription: "Desc",
      canonical: "https://lmnas.com/en",
      robots: "index,follow"
    },
    blocks: [
      {
        __typename: "ComponentBlocksHero",
        heading: "Heading",
        ctaLabel: "Book",
        ctaHref: "/book"
      }
    ]
  };
}

function clonePlan(): typeof planFixture {
  return JSON.parse(JSON.stringify(planFixture)) as typeof planFixture;
}

function isSafeFind(body: GraphqlRequestBody): boolean {
  return body.operationName === "ImporterFindPageBySlugSafe";
}

function isFullFind(body: GraphqlRequestBody): boolean {
  return body.operationName === "ImporterFindPageBySlugFull";
}

describe("apply importer modes", () => {
  it("continues repair flow when full read fails on broken content", async () => {
    const calls = setupGraphqlMock((body) => {
      if (body.operationName === "Ping") {
        return ok({ __typename: "Query" });
      }

      if (isSafeFind(body)) {
        if (body.variables?.status === "DRAFT" && body.variables?.hasPublishedVersion === undefined) {
          return findRows([
            pageRow({
              documentId: "doc-draft",
              publishedAt: null
            })
          ]);
        }
        return findRows([]);
      }

      if (body.operationName === "ImporterUpdatePage") {
        return ok({ updatePage: { documentId: "doc-draft" } });
      }

      if (isFullFind(body)) {
        return operationError("Cannot return null for non-nullable field Page.conversionConfig.");
      }

      throw new Error(`Unexpected operation ${body.operationName}`);
    });

    const result = await applyImportPlan(clonePlan(), {
      strapiUrl: TEST_STRAPI_URL,
      strapiToken: TEST_STRAPI_TOKEN,
      graphqlPath: TEST_GRAPHQL_PATH
    });

    expect(result.action).toBe("updated");
    expect(calls.some((call) => call.operationName === "ImporterUpdatePage")).toBe(true);
    expect(calls.some((call) => call.operationName === "ImporterCreatePage")).toBe(false);
  });

  it("upsert creates when page does not exist", async () => {
    const calls = setupGraphqlMock((body) => {
      if (body.operationName === "Ping") {
        return ok({ __typename: "Query" });
      }
      if (isSafeFind(body)) {
        return findRows([]);
      }
      if (body.operationName === "ImporterCreatePage") {
        return ok({ createPage: { documentId: "doc-created" } });
      }
      if (isFullFind(body)) {
        return findRows([]);
      }
      throw new Error(`Unexpected operation ${body.operationName}`);
    });

    const result = await applyImportPlan(clonePlan(), {
      strapiUrl: TEST_STRAPI_URL,
      strapiToken: TEST_STRAPI_TOKEN,
      graphqlPath: TEST_GRAPHQL_PATH
    });

    expect(result.mode).toBe("upsert");
    expect(result.action).toBe("created");
    expect(result.finalSlug).toBe("home");
    expect(calls.filter((call) => call.operationName === "ImporterCreatePage")).toHaveLength(1);
    expect(calls.filter((call) => call.operationName === "ImporterUpdatePage")).toHaveLength(0);
  });

  it("upsert updates when page exists as published", async () => {
    const calls = setupGraphqlMock((body) => {
      if (body.operationName === "Ping") {
        return ok({ __typename: "Query" });
      }
      if (isSafeFind(body)) {
        if (body.variables?.status === "PUBLISHED" && body.variables?.hasPublishedVersion === undefined) {
          return findRows([
            pageRow({
              documentId: "doc-published",
              publishedAt: "2026-02-28T00:00:00.000Z"
            })
          ]);
        }
        return findRows([]);
      }
      if (body.operationName === "ImporterUpdatePage") {
        return ok({ updatePage: { documentId: "doc-published" } });
      }
      if (isFullFind(body)) {
        return findRows([]);
      }
      throw new Error(`Unexpected operation ${body.operationName}`);
    });

    const result = await applyImportPlan(clonePlan(), {
      strapiUrl: TEST_STRAPI_URL,
      strapiToken: TEST_STRAPI_TOKEN,
      graphqlPath: TEST_GRAPHQL_PATH
    });

    const updateCall = calls.find((call) => call.operationName === "ImporterUpdatePage");
    expect(updateCall?.variables?.documentId).toBe("doc-published");
    expect(calls.filter((call) => call.operationName === "ImporterCreatePage")).toHaveLength(0);
    expect(result.action).toBe("updated");
  });

  it("upsert updates when page exists as draft", async () => {
    const calls = setupGraphqlMock((body) => {
      if (body.operationName === "Ping") {
        return ok({ __typename: "Query" });
      }
      if (isSafeFind(body)) {
        if (body.variables?.status === "DRAFT" && body.variables?.hasPublishedVersion === undefined) {
          return findRows([
            pageRow({
              documentId: "doc-draft",
              publishedAt: null
            })
          ]);
        }
        return findRows([]);
      }
      if (body.operationName === "ImporterUpdatePage") {
        return ok({ updatePage: { documentId: "doc-draft" } });
      }
      if (isFullFind(body)) {
        return findRows([]);
      }
      throw new Error(`Unexpected operation ${body.operationName}`);
    });

    const result = await applyImportPlan(clonePlan(), {
      strapiUrl: TEST_STRAPI_URL,
      strapiToken: TEST_STRAPI_TOKEN,
      graphqlPath: TEST_GRAPHQL_PATH
    });

    const updateCall = calls.find((call) => call.operationName === "ImporterUpdatePage");
    expect(updateCall?.variables?.documentId).toBe("doc-draft");
    expect(calls.filter((call) => call.operationName === "ImporterCreatePage")).toHaveLength(0);
    expect(result.action).toBe("updated");
  });

  it("upsert prefers draft when both draft and published exist", async () => {
    const calls = setupGraphqlMock((body) => {
      if (body.operationName === "Ping") {
        return ok({ __typename: "Query" });
      }
      if (isSafeFind(body)) {
        if (body.variables?.status === "DRAFT" && body.variables?.hasPublishedVersion === undefined) {
          return findRows([
            pageRow({
              documentId: "doc-draft",
              publishedAt: null
            })
          ]);
        }

        if (body.variables?.status === "PUBLISHED" && body.variables?.hasPublishedVersion === undefined) {
          return findRows([
            pageRow({
              documentId: "doc-published",
              publishedAt: "2026-02-28T00:00:00.000Z"
            })
          ]);
        }

        return findRows([]);
      }
      if (body.operationName === "ImporterUpdatePage") {
        return ok({ updatePage: { documentId: "doc-draft" } });
      }
      if (isFullFind(body)) {
        return findRows([]);
      }
      throw new Error(`Unexpected operation ${body.operationName}`);
    });

    await applyImportPlan(clonePlan(), {
      strapiUrl: TEST_STRAPI_URL,
      strapiToken: TEST_STRAPI_TOKEN,
      graphqlPath: TEST_GRAPHQL_PATH
    });

    const updateCall = calls.find((call) => call.operationName === "ImporterUpdatePage");
    expect(updateCall?.variables?.documentId).toBe("doc-draft");
  });

  it("force-create auto-suffixes slug when page exists", async () => {
    const calls = setupGraphqlMock((body) => {
      if (body.operationName === "Ping") {
        return ok({ __typename: "Query" });
      }
      if (isSafeFind(body)) {
        if (body.variables?.status === "DRAFT" && body.variables?.hasPublishedVersion === undefined) {
          return findRows([
            pageRow({
              documentId: "doc-draft",
              publishedAt: null
            })
          ]);
        }
        return findRows([]);
      }
      if (body.operationName === "ImporterCreatePage") {
        return ok({ createPage: { documentId: "doc-created" } });
      }
      if (isFullFind(body)) {
        return findRows([]);
      }
      throw new Error(`Unexpected operation ${body.operationName}`);
    });

    const result = await applyImportPlan(clonePlan(), {
      strapiUrl: TEST_STRAPI_URL,
      strapiToken: TEST_STRAPI_TOKEN,
      graphqlPath: TEST_GRAPHQL_PATH,
      forceCreate: true,
      now: new Date("2026-02-28T12:34:56.789Z")
    });

    const createCall = calls.find((call) => call.operationName === "ImporterCreatePage");
    const slug = createCall?.variables?.data && typeof createCall.variables.data === "object"
      ? (createCall.variables.data as { slug?: string }).slug
      : undefined;

    expect(slug).toBe("home--import-20260228-123456789");
    expect(result.finalSlug).toBe("home--import-20260228-123456789");
    expect(calls.filter((call) => call.operationName === "ImporterUpdatePage")).toHaveLength(0);
  });

  it("force-update fails when missing", async () => {
    setupGraphqlMock((body) => {
      if (body.operationName === "Ping") {
        return ok({ __typename: "Query" });
      }
      if (isSafeFind(body)) {
        return findRows([]);
      }
      throw new Error(`Unexpected operation ${body.operationName}`);
    });

    await expect(
      applyImportPlan(clonePlan(), {
        strapiUrl: TEST_STRAPI_URL,
        strapiToken: TEST_STRAPI_TOKEN,
        graphqlPath: TEST_GRAPHQL_PATH,
        forceUpdate: true
      })
    ).rejects.toThrow("--force-update requested but page not found for slug");
  });

  it("force-replace deletes existing page before creating", async () => {
    const calls = setupGraphqlMock((body) => {
      if (body.operationName === "Ping") {
        return ok({ __typename: "Query" });
      }
      if (isSafeFind(body)) {
        if (body.variables?.status === "DRAFT" && body.variables?.hasPublishedVersion === undefined) {
          return findRows([
            pageRow({
              documentId: "doc-draft",
              publishedAt: null
            })
          ]);
        }
        return findRows([]);
      }
      if (body.operationName === "ImporterDeletePage") {
        return ok({ deletePage: { documentId: "doc-draft" } });
      }
      if (body.operationName === "ImporterCreatePage") {
        return ok({ createPage: { documentId: "doc-created" } });
      }
      if (isFullFind(body)) {
        return findRows([]);
      }
      throw new Error(`Unexpected operation ${body.operationName}`);
    });

    const result = await applyImportPlan(clonePlan(), {
      strapiUrl: TEST_STRAPI_URL,
      strapiToken: TEST_STRAPI_TOKEN,
      graphqlPath: TEST_GRAPHQL_PATH,
      forceReplace: true
    });

    const deleteCall = calls.find((call) => call.operationName === "ImporterDeletePage");
    const createCall = calls.find((call) => call.operationName === "ImporterCreatePage");
    expect(deleteCall).toBeTruthy();
    expect(createCall).toBeTruthy();
    expect(calls.indexOf(deleteCall as GraphqlRequestBody)).toBeLessThan(calls.indexOf(createCall as GraphqlRequestBody));
    expect(result.action).toBe("replaced");
  });

  it("force-create retries once with suffixed slug on unique constraint", async () => {
    let createAttempts = 0;
    const calls = setupGraphqlMock((body) => {
      if (body.operationName === "Ping") {
        return ok({ __typename: "Query" });
      }
      if (isSafeFind(body)) {
        return findRows([]);
      }
      if (body.operationName === "ImporterCreatePage") {
        createAttempts += 1;
        if (createAttempts === 1) {
          return operationError("slug must be unique");
        }
        return ok({ createPage: { documentId: "doc-created" } });
      }
      if (isFullFind(body)) {
        return findRows([]);
      }
      throw new Error(`Unexpected operation ${body.operationName}`);
    });

    const result = await applyImportPlan(clonePlan(), {
      strapiUrl: TEST_STRAPI_URL,
      strapiToken: TEST_STRAPI_TOKEN,
      graphqlPath: TEST_GRAPHQL_PATH,
      forceCreate: true,
      now: new Date("2026-02-28T12:34:56.789Z")
    });

    const createCalls = calls.filter((call) => call.operationName === "ImporterCreatePage");
    expect(createCalls).toHaveLength(2);

    const firstSlug = (createCalls[0]?.variables?.data as { slug?: string }).slug;
    const secondSlug = (createCalls[1]?.variables?.data as { slug?: string }).slug;

    expect(firstSlug).toBe("home");
    expect(secondSlug).toBe("home--import-20260228-123456789");
    expect(result.finalSlug).toBe("home--import-20260228-123456789");
  });

  it("defaults apply write state to draft even when plan requests published", async () => {
    const calls = setupGraphqlMock((body) => {
      if (body.operationName === "Ping") {
        return ok({ __typename: "Query" });
      }
      if (isSafeFind(body)) {
        return findRows([]);
      }
      if (body.operationName === "ImporterCreatePage") {
        return ok({ createPage: { documentId: "doc-created" } });
      }
      if (isFullFind(body)) {
        return findRows([]);
      }
      throw new Error(`Unexpected operation ${body.operationName}`);
    });

    const plan = clonePlan();
    plan.publish.state = "published";

    await applyImportPlan(plan, {
      strapiUrl: TEST_STRAPI_URL,
      strapiToken: TEST_STRAPI_TOKEN,
      graphqlPath: TEST_GRAPHQL_PATH
    });

    const createCall = calls.find((call) => call.operationName === "ImporterCreatePage");
    expect(createCall?.variables?.status).toBe("DRAFT");
  });

  it("allows explicit publish on apply", async () => {
    const calls = setupGraphqlMock((body) => {
      if (body.operationName === "Ping") {
        return ok({ __typename: "Query" });
      }
      if (isSafeFind(body)) {
        return findRows([]);
      }
      if (body.operationName === "ImporterCreatePage") {
        return ok({ createPage: { documentId: "doc-created" } });
      }
      if (isFullFind(body)) {
        return findRows([]);
      }
      throw new Error(`Unexpected operation ${body.operationName}`);
    });

    await applyImportPlan(clonePlan(), {
      strapiUrl: TEST_STRAPI_URL,
      strapiToken: TEST_STRAPI_TOKEN,
      graphqlPath: TEST_GRAPHQL_PATH,
      publishState: "published"
    });

    const createCall = calls.find((call) => call.operationName === "ImporterCreatePage");
    expect(createCall?.variables?.status).toBe("PUBLISHED");
  });

  it("loads introspection fixture for offline tests", () => {
    const queryType = introspectionFixture.data.__schema.queryType?.name;
    expect(queryType).toBeTruthy();
  });
});

const runIntegration =
  process.env.INTEGRATION_TEST_STRAPI === "1" &&
  Boolean(process.env.STRAPI_URL) &&
  Boolean(process.env.STRAPI_TOKEN);

describe.runIf(runIntegration)("integration apply", () => {
  it(
    "upserts and cleans up test page",
    async () => {
      const strapiUrl = process.env.STRAPI_URL as string;
      const strapiToken = process.env.STRAPI_TOKEN as string;
      const graphqlPath = process.env.STRAPI_GRAPHQL_PATH ?? "/graphql";
      const slug = `importer-test-${Date.now()}`;
      const plan = clonePlan();
      plan.page.slug = slug;

      await applyImportPlan(plan, {
        strapiUrl,
        strapiToken,
        graphqlPath
      });

      const repository = await createPageRepository({ strapiUrl, strapiToken, graphqlPath });
      const matches = await repository.findBySlugAllStatuses({ slug, locale: plan.page.locale });
      expect(matches.length).toBeGreaterThan(0);

      const seen = new Set<string>();
      for (const match of matches) {
        const identifier = match.documentId ?? match.id;
        if (!identifier || seen.has(identifier)) {
          continue;
        }
        seen.add(identifier);
        await repository.deletePage(match);
      }
    },
    45000
  );
});
