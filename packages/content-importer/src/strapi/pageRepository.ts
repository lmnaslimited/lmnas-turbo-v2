import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ContentPlan } from "../contracts/contentPlan.schema.js";
import { createGraphqlClient, GraphqlOperationError, GraphqlRequestError } from "./graphqlClient.js";
import { buildOperations } from "./operationBuilder.js";
import { fetchIntrospection, type IntrospectionPayload, typeMap, unwrapType } from "./schema/introspection.js";

export type FindPageOptions = {
  slug: string;
  locale?: string;
  status?: string;
  hasPublishedVersion?: boolean;
};

export type ApplyMode = "upsert" | "force-create" | "force-update" | "force-replace";

export type UpsertOptions = {
  forceCreate?: boolean;
  forceUpdate?: boolean;
  forceReplace?: boolean;
  strictUpsert?: boolean;
  now?: Date;
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
  status: "draft" | "published" | "unknown";
  queryStatus?: string;
  hasPublishedVersion?: boolean;
};

export type UpsertResult = {
  mode: ApplyMode;
  action: "created" | "updated" | "replaced";
  finalSlug: string;
  documentId?: string;
  status: "draft" | "published" | "unknown";
  existing: {
    found: boolean;
    status?: PageLookupResult["status"];
    count: number;
  };
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
  const supportsStatusArg = ops.facts.pagesQueryField.args.some((arg) => arg.name === "status");
  const supportsHasPublishedVersionArg = ops.facts.pagesQueryField.args.some((arg) => arg.name === "hasPublishedVersion");
  const statusCandidates = resolveStatusCandidates(ops.statusValues);

  async function findBySlug(input: FindPageOptions): Promise<PageLookupResult | undefined> {
    const data = await requestWithDiagnostics<Record<string, unknown>>(
      client,
      ops.findBySlugFull.operationName,
      ops.findBySlugFull.query,
      ops.findBySlugFull.variables(input)
    );

    const rows = ops.findBySlugFull.parse(data);
    const first = rows[0];
    if (!first) {
      return undefined;
    }

    return toLookup(first, {
      status: input.status,
      hasPublishedVersion: input.hasPublishedVersion
    });
  }

  async function findBySlugSafe(input: FindPageOptions): Promise<PageLookupResult | undefined> {
    const data = await requestWithDiagnostics<Record<string, unknown>>(
      client,
      ops.findBySlugSafe.operationName,
      ops.findBySlugSafe.query,
      ops.findBySlugSafe.variables(input)
    );

    const rows = ops.findBySlugSafe.parse(data);
    const first = rows[0];
    if (!first) {
      return undefined;
    }

    return toLookup(first, {
      status: input.status,
      hasPublishedVersion: input.hasPublishedVersion
    });
  }

  async function findBySlugAllStatuses(
    input: Pick<FindPageOptions, "slug" | "locale">,
    options?: { suppressResolvedLog?: boolean }
  ): Promise<PageLookupResult[]> {
    const statuses: Array<string | undefined> = supportsStatusArg ? statusCandidates : [undefined];
    const hasPublishedVersionValues: Array<boolean | undefined> = supportsHasPublishedVersionArg
      ? [undefined, true, false]
      : [undefined];

    const merged = new Map<string, PageLookupResult>();

    for (const status of statuses) {
      for (const hasPublishedVersion of hasPublishedVersionValues) {
        const data = await requestWithDiagnostics<Record<string, unknown>>(
          client,
          ops.findBySlugSafe.operationName,
          ops.findBySlugSafe.query,
          ops.findBySlugSafe.variables({
            slug: input.slug,
            locale: input.locale,
            status,
            hasPublishedVersion
          })
        );

        const rows = ops.findBySlugSafe.parse(data);
        for (const row of rows) {
          const lookup = toLookup(row, { status, hasPublishedVersion });
          const key = toLookupKey(lookup);
          if (!merged.has(key)) {
            merged.set(key, lookup);
          }
        }
      }
    }

    const matches = Array.from(merged.values()).sort(compareLookupPriority);

    if (!options?.suppressResolvedLog && process.env.NODE_ENV !== "production") {
      const selected = matches[0];
      const existingId = selected?.documentId ?? selected?.id;
      console.warn("[content-importer] existing page id resolved", {
        slug: input.slug,
        locale: input.locale,
        existingId
      });
    }

    return matches;
  }

  async function createPage(plan: ContentPlan, slugOverride?: string): Promise<string> {
    const finalSlug = slugOverride ?? plan.page.slug;
    const writePlan = finalSlug === plan.page.slug ? plan : { ...plan, page: { ...plan.page, slug: finalSlug } };
    const data = toPageInput(writePlan, inputFieldNames);

    await requestWithDiagnostics(client, ops.create.operationName, ops.create.mutation, ops.create.variables({
      data,
      publishState: plan.publish.state
    }));

    return finalSlug;
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

  async function deletePage(existing: PageLookupResult): Promise<void> {
    const identifierValue = ops.delete.identifier === "documentId" ? existing.documentId : existing.id;
    if (!identifierValue) {
      throw new Error(`Delete requires ${ops.delete.identifier} but existing page did not include it`);
    }

    await requestWithDiagnostics(client, ops.delete.operationName, ops.delete.mutation, ops.delete.variables({ identifierValue }));
  }

  async function upsertPage(plan: ContentPlan, upsertOptions: UpsertOptions = {}): Promise<UpsertResult> {
    const mode = resolveApplyMode(upsertOptions);
    const now = upsertOptions.now ?? new Date();

    console.log("[content-importer] SAFE read mode enabled (repair-safe).");
    const matches = await findBySlugAllStatuses({
      slug: plan.page.slug,
      locale: plan.page.locale
    });

    const preferred = matches[0];

    console.log(
      `[content-importer] apply mode=${mode} slug=${plan.page.slug} existing=${preferred ? "yes" : "no"}${
        preferred ? ` status=${preferred.status}` : ""
      }`
    );

    if (mode === "force-update") {
      if (!preferred) {
        throw new Error(`--force-update requested but page not found for slug=${plan.page.slug} locale=${plan.page.locale}`);
      }

      await updatePage(preferred, plan);
      await verifyWithFullRead(plan.page.slug, plan.page.locale);
      const metadata = await resolveWriteMetadata(plan.page.slug, plan.page.locale, preferred);
      return {
        mode,
        action: "updated",
        finalSlug: plan.page.slug,
        documentId: metadata.documentId,
        status: metadata.status,
        existing: {
          found: true,
          status: preferred.status,
          count: matches.length
        }
      };
    }

    if (mode === "force-replace") {
      if (preferred) {
        await deleteMatches(matches, deletePage, ops.delete.identifier);
      }

      const finalSlug = await createPage(plan);
      await verifyWithFullRead(finalSlug, plan.page.locale);
      const metadata = await resolveWriteMetadata(finalSlug, plan.page.locale, preferred);
      return {
        mode,
        action: preferred ? "replaced" : "created",
        finalSlug,
        documentId: metadata.documentId,
        status: metadata.status,
        existing: {
          found: Boolean(preferred),
          status: preferred?.status,
          count: matches.length
        }
      };
    }

    if (mode === "force-create") {
      const result = await createForForceCreate({
        plan,
        now,
        createPage,
        slugExists: matches.length > 0
      });

      await verifyWithFullRead(result.finalSlug, plan.page.locale);
      const metadata = await resolveWriteMetadata(result.finalSlug, plan.page.locale, preferred);

      return {
        mode,
        action: "created",
        finalSlug: result.finalSlug,
        documentId: metadata.documentId,
        status: metadata.status,
        existing: {
          found: matches.length > 0,
          status: preferred?.status,
          count: matches.length
        }
      };
    }

    if (!preferred) {
      try {
        const finalSlug = await createPage(plan);
        await verifyWithFullRead(finalSlug, plan.page.locale);
        const metadata = await resolveWriteMetadata(finalSlug, plan.page.locale, preferred);
        return {
          mode,
          action: "created",
          finalSlug,
          documentId: metadata.documentId,
          status: metadata.status,
          existing: {
            found: false,
            count: 0
          }
        };
      } catch (error) {
        if (isSlugUniqueViolation(error)) {
          throw new Error(
            `Create failed because slug '${plan.page.slug}' already exists. Use default upsert, --force-update, or --force-create.`
          );
        }

        throw error;
      }
    }

    await updatePage(preferred, plan);
    await verifyWithFullRead(plan.page.slug, plan.page.locale);
    const metadata = await resolveWriteMetadata(plan.page.slug, plan.page.locale, preferred);
    return {
      mode,
      action: "updated",
      finalSlug: plan.page.slug,
      documentId: metadata.documentId,
      status: metadata.status,
      existing: {
        found: true,
        status: preferred.status,
        count: matches.length
      }
    };
  }

  async function verifyWithFullRead(slug: string, locale: string): Promise<void> {
    try {
      await findBySlug({
        slug,
        locale
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        "[content-importer] Full read failed due to invalid content state; proceeding with repair using plan.json.",
        {
          operation: ops.findBySlugFull.operationName,
          endpoint: client.endpoint,
          error: message
        }
      );
    }
  }

  async function resolveWriteMetadata(slug: string, locale: string, fallback?: PageLookupResult): Promise<{
    documentId?: string;
    status: "draft" | "published" | "unknown";
  }> {
    const matches = await findBySlugAllStatuses({ slug, locale }, { suppressResolvedLog: true });
    const selected = matches[0] ?? fallback;
    return {
      documentId: selected?.documentId ?? selected?.id,
      status: selected?.status ?? "unknown"
    };
  }

  return {
    findBySlug,
    findBySlugSafe,
    findBySlugAllStatuses,
    createPage,
    updatePage,
    deletePage,
    upsertPage,
    schemaFacts: ops.facts
  };
}

async function createForForceCreate(params: {
  plan: ContentPlan;
  now: Date;
  slugExists: boolean;
  createPage: (plan: ContentPlan, slugOverride?: string) => Promise<string>;
}): Promise<{ finalSlug: string }> {
  const baseSlug = params.plan.page.slug;
  const initialSlug = params.slugExists ? generateImportSlug(baseSlug, params.now) : baseSlug;

  try {
    const finalSlug = await params.createPage(params.plan, initialSlug);
    return { finalSlug };
  } catch (error) {
    if (!isSlugUniqueViolation(error)) {
      throw error;
    }

    const retrySlug =
      initialSlug === baseSlug
        ? generateImportSlug(baseSlug, params.now)
        : generateImportSlug(baseSlug, new Date(params.now.getTime() + 1));
    const finalSlug = await params.createPage(params.plan, retrySlug);
    return { finalSlug };
  }
}

async function deleteMatches(
  matches: PageLookupResult[],
  deletePage: (page: PageLookupResult) => Promise<void>,
  identifier: "documentId" | "id"
): Promise<void> {
  const seen = new Set<string>();

  for (const match of matches) {
    const key = identifier === "documentId" ? match.documentId : match.id;
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    await deletePage(match);
  }
}

function resolveApplyMode(options: UpsertOptions): ApplyMode {
  const enabledModes = [
    options.forceCreate ? "force-create" : undefined,
    options.forceUpdate ? "force-update" : undefined,
    options.forceReplace ? "force-replace" : undefined
  ].filter((item): item is ApplyMode => Boolean(item));

  if (enabledModes.length > 1) {
    throw new Error("Invalid options: choose only one of --force-create, --force-update, or --force-replace");
  }

  return enabledModes[0] ?? "upsert";
}

function resolveStatusCandidates(values: string[]): string[] {
  const unique = Array.from(new Set(values));
  const ordered: string[] = [];

  for (const status of ["DRAFT", "PREVIEW", "PUBLISHED"]) {
    if (unique.includes(status)) {
      ordered.push(status);
    }
  }

  for (const status of unique) {
    if (!ordered.includes(status)) {
      ordered.push(status);
    }
  }

  if (ordered.length === 0) {
    return ["DRAFT", "PUBLISHED"];
  }

  return ordered;
}

function toLookup(
  row: Record<string, unknown>,
  source: {
    status?: string;
    hasPublishedVersion?: boolean;
  }
): PageLookupResult {
  const id = row.id != null ? String(row.id) : undefined;
  const documentId = typeof row.documentId === "string" ? row.documentId : undefined;
  const publishedAt = typeof row.publishedAt === "string" ? row.publishedAt : undefined;

  let status: PageLookupResult["status"] = "unknown";
  if (publishedAt) {
    status = "published";
  } else if (source.status === "DRAFT" || source.status === "PREVIEW") {
    status = "draft";
  } else if (source.status === "PUBLISHED") {
    status = "published";
  }

  return {
    id,
    documentId,
    page: row,
    status,
    queryStatus: source.status,
    hasPublishedVersion: source.hasPublishedVersion
  };
}

function toLookupKey(lookup: PageLookupResult): string {
  const identifier = lookup.documentId ?? lookup.id ?? "unknown";
  const publishedAt = typeof lookup.page.publishedAt === "string" ? lookup.page.publishedAt : "draft";
  return `${identifier}:${publishedAt}`;
}

function compareLookupPriority(a: PageLookupResult, b: PageLookupResult): number {
  return rankLookup(a) - rankLookup(b);
}

function rankLookup(lookup: PageLookupResult): number {
  if (lookup.status === "draft") {
    return 0;
  }

  if (lookup.status === "published") {
    return 1;
  }

  return 2;
}

function isSlugUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /slug/i.test(message) && /(unique|already exists|must be unique|duplicate)/i.test(message);
}

function generateImportSlug(slug: string, timestamp: Date): string {
  const yyyy = String(timestamp.getUTCFullYear());
  const mm = String(timestamp.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(timestamp.getUTCDate()).padStart(2, "0");
  const hh = String(timestamp.getUTCHours()).padStart(2, "0");
  const min = String(timestamp.getUTCMinutes()).padStart(2, "0");
  const ss = String(timestamp.getUTCSeconds()).padStart(2, "0");
  const millis = String(timestamp.getUTCMilliseconds()).padStart(3, "0");
  return `${slug}--import-${yyyy}${mm}${dd}-${hh}${min}${ss}${millis}`;
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
  const body = sanitizeMutationObject(block, true);
  return resolvedTypename ? { __typename: resolvedTypename, ...body } : body;
}

function sanitizeMutationObject(value: Record<string, unknown>, isRoot = false): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(value)) {
    if (key === "id" || key === "__component") {
      continue;
    }

    if (key === "__typename") {
      if (isRoot) {
        continue;
      }
      continue;
    }

    const sanitized = sanitizeMutationValue(raw);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }

  return result;
}

function sanitizeMutationValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeMutationValue(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === "object") {
    return sanitizeMutationObject(value as Record<string, unknown>);
  }

  return value;
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
      const topErrors = error.errors.slice(0, 2).map((item) => ({
        message: item.message,
        path: item.path,
        extensions: item.extensions
      }));

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
