import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ContentPlan } from "../contracts/contentPlan.schema.js";
import { createGraphqlClient, GraphqlOperationError, GraphqlRequestError } from "./graphqlClient.js";
import { buildOperations } from "./operationBuilder.js";
import { fetchIntrospection, type IntrospectionPayload, typeMap, unwrapType } from "./schema/introspection.js";

export type FindPageOptions = {
  slug: string;
  locale?: string;
  status?: "DRAFT" | "PUBLISHED";
};

export type UpsertOptions = {
  forceCreate?: boolean;
  forceUpdate?: boolean;
  strictUpsert?: boolean;
};

export type PageRepositoryOptions = {
  strapiUrl: string;
  strapiToken: string;
  graphqlPath?: string;
};

export type PageLookupResult = {
  id?: string;
  documentId?: string;
  page: Record<string, unknown>;
};

export async function createPageRepository(options: PageRepositoryOptions) {
  const client = createGraphqlClient({
    strapiUrl: options.strapiUrl,
    token: options.strapiToken,
    graphqlPath: options.graphqlPath
  });

  const introspection = await loadIntrospection(options);
  const ops = buildOperations(introspection);
  const inputFieldNames = resolvePageInputFieldNames(introspection, ops.create.mutation);

  async function findBySlug(input: FindPageOptions): Promise<PageLookupResult | undefined> {
    const data = await requestWithDiagnostics<Record<string, unknown>>(
      client,
      ops.findBySlug.operationName,
      ops.findBySlug.query,
      ops.findBySlug.variables(input)
    );
    const rows = ops.findBySlug.parse(data);
    const first = rows[0];
    if (!first) {
      return undefined;
    }

    const id = first.id != null ? String(first.id) : undefined;
    const documentId = typeof first.documentId === "string" ? first.documentId : undefined;

    return {
      id,
      documentId,
      page: first
    };
  }

  async function createPage(plan: ContentPlan): Promise<void> {
    const data = toPageInput(plan, inputFieldNames);
    await requestWithDiagnostics(client, ops.create.operationName, ops.create.mutation, ops.create.variables({
      data,
      publishState: plan.publish.state
    }));
  }

  async function updatePage(existing: PageLookupResult, plan: ContentPlan): Promise<void> {
    const identifierValue = ops.update.identifier === "documentId" ? existing.documentId : existing.id;
    if (!identifierValue) {
      throw new Error(`Update requires ${ops.update.identifier} but existing page did not include it`);
    }

    await requestWithDiagnostics(client, ops.update.operationName, ops.update.mutation, ops.update.variables({
      identifierValue,
      data: toPageInput(plan, inputFieldNames),
      publishState: plan.publish.state
    }));
  }

  async function upsertPage(plan: ContentPlan, upsertOptions: UpsertOptions = {}): Promise<void> {
    if (upsertOptions.forceCreate && upsertOptions.forceUpdate) {
      throw new Error("Invalid options: --force-create and --force-update cannot be used together");
    }

    const existing = upsertOptions.forceCreate
      ? undefined
      : await findBySlug({ slug: plan.page.slug, locale: plan.page.locale, status: "DRAFT" });

    if (!existing) {
      if (upsertOptions.forceUpdate) {
        throw new Error(`--force-update requested but no existing page found for slug=${plan.page.slug} locale=${plan.page.locale}`);
      }
      await createPage(plan);
      return;
    }

    try {
      await updatePage(existing, plan);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const is403 = /\(403\)|forbidden/i.test(message);
      if (!is403) {
        throw error;
      }

      console.warn(
        "[content-importer] update forbidden hint: If you are using a users-permissions JWT, it may not allow update. Use a Strapi API Token (Settings -> API Tokens) with Full access.",
        {
          operation: ops.update.operationName,
          endpoint: client.endpoint,
          tokenLength: options.strapiToken.length,
          mode: "PUT"
        }
      );

      if (upsertOptions.strictUpsert) {
        throw error;
      }

      console.warn("[content-importer] update forbidden, creating new Page entry instead");
      await createPage(plan);
    }
  }

  return {
    findBySlug,
    createPage,
    updatePage,
    upsertPage,
    schemaFacts: ops.facts
  };
}

async function loadIntrospection(options: PageRepositoryOptions): Promise<IntrospectionPayload> {
  const filePath = path.join(process.cwd(), "src/strapi/schema/introspection.json");
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as IntrospectionPayload;
  } catch {
    return fetchIntrospection({
      strapiUrl: options.strapiUrl,
      strapiToken: options.strapiToken,
      graphqlPath: options.graphqlPath
    });
  }
}

function toPageInput(plan: ContentPlan, inputFields: Set<string>): Record<string, unknown> {
  const data = {
    slug: plan.page.slug,
    locale: plan.page.locale,
    pageType: plan.page.pageType,
    layoutKey: plan.page.layoutKey,
    conversionConfig: plan.page.conversionConfig,
    seo: plan.page.seo,
    blocks: plan.blocks.map(toMutationBlock)
  };

  return Object.fromEntries(Object.entries(data).filter(([key]) => inputFields.has(key)));
}

function toMutationBlock(block: Record<string, unknown>): Record<string, unknown> {
  const typename = typeof block.__typename === "string" ? block.__typename : undefined;
  const component = typeof block.__component === "string" ? block.__component : undefined;
  const resolvedTypename = typename ?? (component ? componentToTypename(component) : undefined);
  const body = Object.fromEntries(Object.entries(block).filter(([key]) => key !== "__typename" && key !== "__component"));
  return resolvedTypename ? { __typename: resolvedTypename, ...body } : body;
}

function typenameToComponent(typename: string): string {
  const withoutPrefix = typename.replace(/^Component/, "");
  const parts = withoutPrefix
    .split(/(?=[A-Z])/)
    .map((item) => item.toLowerCase())
    .filter(Boolean);
  if (parts.length < 2) {
    return typename;
  }
  const [group, ...rest] = parts;
  return `${group}.${rest.join("-")}`;
}

function componentToTypename(component: string): string {
  const [group, name] = component.split(".");
  if (!group || !name) {
    return component;
  }
  const groupPart = capitalize(group);
  const namePart = name
    .split("-")
    .map((part) => capitalize(part))
    .join("");
  return `Component${groupPart}${namePart}`;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function requestWithDiagnostics<TData>(
  client: ReturnType<typeof createGraphqlClient>,
  operationName: string,
  query: string,
  variables: Record<string, unknown>
): Promise<TData> {
  try {
    return await client.request<TData>(operationName, query, variables);
  } catch (error) {
    if (error instanceof GraphqlRequestError) {
      throw new Error(
        `Operation ${operationName} failed on ${client.endpoint} (status ${error.status}). Response: ${error.body.slice(0, 1000)}`
      );
    }

    if (error instanceof GraphqlOperationError) {
      const topErrors = error.errors.slice(0, 2);
      throw new Error(
        `Operation ${operationName} failed on ${client.endpoint}. GraphQL errors: ${JSON.stringify(topErrors)}`
      );
    }

    throw error;
  }
}

function resolvePageInputFieldNames(introspection: IntrospectionPayload, createMutation: string): Set<string> {
  const map = typeMap(introspection);
  const mutationTypeName = introspection.data.__schema.mutationType?.name;
  if (!mutationTypeName) {
    return new Set(["slug", "pageType", "layoutKey", "conversionConfig", "seo", "blocks"]);
  }

  const mutationType = map.get(mutationTypeName);
  const createField = mutationType?.fields?.find((field) => createMutation.includes(`${field.name}(`));
  const dataArg = createField?.args?.find((arg) => arg.name === "data");
  const inputTypeName = dataArg ? unwrapType(dataArg.type).name : undefined;
  const inputType = inputTypeName ? map.get(inputTypeName) : undefined;
  const fields = inputType?.inputFields?.map((field) => field.name);

  if (!fields || fields.length === 0) {
    return new Set(["slug", "pageType", "layoutKey", "conversionConfig", "seo", "blocks"]);
  }

  return new Set(fields);
}
