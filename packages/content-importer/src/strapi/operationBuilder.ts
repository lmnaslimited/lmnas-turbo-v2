import { typeMap, unwrapType, type IntrospectionField, type IntrospectionPayload, type IntrospectionType } from "./schema/introspection.js";
import { deriveSchemaFacts } from "./schema/facts.js";

export type OperationBundle = {
  facts: ReturnType<typeof deriveSchemaFacts>;
  statusValues: string[];
  findBySlugSafe: {
    operationName: string;
    query: string;
    variables: (input: { slug: string; locale?: string; status?: string; hasPublishedVersion?: boolean }) => Record<string, unknown>;
    parse: (payload: Record<string, unknown>) => Array<Record<string, unknown>>;
  };
  findBySlugFull: {
    operationName: string;
    query: string;
    variables: (input: { slug: string; locale?: string; status?: string; hasPublishedVersion?: boolean }) => Record<string, unknown>;
    parse: (payload: Record<string, unknown>) => Array<Record<string, unknown>>;
  };
  create: {
    operationName: string;
    mutation: string;
    variables: (input: { data: Record<string, unknown>; publishState: "draft" | "published" }) => Record<string, unknown>;
  };
  update: {
    operationName: string;
    mutation: string;
    identifier: "documentId" | "id";
    variables: (input: {
      identifierValue: string;
      data: Record<string, unknown>;
      publishState: "draft" | "published";
    }) => Record<string, unknown>;
  };
  delete: {
    operationName: string;
    mutation: string;
    identifier: "documentId" | "id";
    variables: (input: { identifierValue: string }) => Record<string, unknown>;
  };
};

export function buildOperations(payload: IntrospectionPayload): OperationBundle {
  const map = typeMap(payload);
  const facts = deriveSchemaFacts(payload);
  const queryTypeName = payload.data.__schema.queryType?.name;
  const mutationTypeName = payload.data.__schema.mutationType?.name;

  if (!queryTypeName || !mutationTypeName) {
    throw new Error("Introspection missing queryType/mutationType");
  }

  const queryType = map.get(queryTypeName);
  const mutationType = map.get(mutationTypeName);
  if (!queryType?.fields || !mutationType?.fields) {
    throw new Error("Introspection missing query or mutation fields");
  }

  const pagesField = queryType.fields.find((field) => field.name === facts.pagesQueryField.name);
  if (!pagesField) {
    throw new Error(`Cannot find pages field '${facts.pagesQueryField.name}'`);
  }

  const pageType = map.get(facts.pagesQueryField.pageTypeName);
  if (!pageType?.fields) {
    throw new Error(`Cannot find page type '${facts.pagesQueryField.pageTypeName}' fields`);
  }

  const findBySlugSafe = buildFindBySlugQuery(map, pagesField, pageType, "safe");
  const findBySlugFull = buildFindBySlugQuery(map, pagesField, pageType, "full");
  const createMutationField = findMutationField(mutationType.fields, "create", facts.pagesQueryField.pageTypeName);
  const updateMutationField = findMutationField(mutationType.fields, "update", facts.pagesQueryField.pageTypeName);
  const deleteMutationField = findMutationField(mutationType.fields, "delete", facts.pagesQueryField.pageTypeName);

  if (!createMutationField || !updateMutationField || !deleteMutationField) {
    throw new Error("Unable to find create/update/delete page mutations from introspection");
  }

  const createMutation = buildCreateMutation(map, createMutationField, pageType);
  const updateMutation = buildUpdateMutation(map, updateMutationField, pageType, facts.pageIdentifiers);
  const deleteMutation = buildDeleteMutation(map, deleteMutationField, pageType, facts.pageIdentifiers);
  const statusValues = resolveStatusValues(map, pagesField);

  return {
    facts,
    statusValues,
    findBySlugSafe,
    findBySlugFull,
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation
  };
}

function buildFindBySlugQuery(
  map: Map<string, IntrospectionType>,
  pagesField: IntrospectionField,
  pageType: IntrospectionType,
  mode: "safe" | "full"
): OperationBundle["findBySlugSafe"] {
  const operationName = mode === "safe" ? "ImporterFindPageBySlugSafe" : "ImporterFindPageBySlugFull";
  const hasLocaleArg = (pagesField.args ?? []).some((arg) => arg.name === "locale");
  const args = ["filters: { slug: { eq: $slug } }", "pagination: { page: 1, pageSize: 1 }"];
  const variableDefs = ["$slug: String!"];

  if (hasLocaleArg) {
    const localeType = (pagesField.args ?? []).find((arg) => arg.name === "locale")?.type;
    if (localeType) {
      variableDefs.push(`$locale: ${renderVariableType(localeType)}`);
      args.push("locale: $locale");
    }
  }

  if ((pagesField.args ?? []).some((arg) => arg.name === "status")) {
    const statusType = (pagesField.args ?? []).find((arg) => arg.name === "status")?.type;
    if (statusType) {
      variableDefs.push(`$status: ${renderVariableType(statusType)}`);
      args.push("status: $status");
    }
  }

  const hasPublishedVersionArg = (pagesField.args ?? []).find((arg) => arg.name === "hasPublishedVersion");
  if (hasPublishedVersionArg) {
    variableDefs.push(`$hasPublishedVersion: ${renderVariableType(hasPublishedVersionArg.type)}`);
    args.push("hasPublishedVersion: $hasPublishedVersion");
  }

  const pageSelection = mode === "safe" ? buildSafePageSelection(pageType) : buildPageSelection(map, pageType);
  const outerReturnName = unwrapType(pagesField.type).name;
  const outerReturn = outerReturnName ? map.get(outerReturnName) : undefined;

  let bodySelection = pageSelection;
  let parsePath: Array<string> = [];

  if (outerReturn?.fields?.some((field) => field.name === "data")) {
    const dataField = outerReturn.fields.find((field) => field.name === "data");
    const dataName = dataField ? unwrapType(dataField.type).name : undefined;
    const dataType = dataName ? map.get(dataName) : undefined;
    if (dataType?.fields?.some((field) => field.name === "attributes")) {
      bodySelection = `data { id attributes { ${pageSelection} } }`;
      parsePath = [pagesField.name, "data"];
    } else {
      bodySelection = `data { ${pageSelection} }`;
      parsePath = [pagesField.name, "data"];
    }
  } else {
    parsePath = [pagesField.name];
  }

  const query = `query ${operationName}(${variableDefs.join(", ")}) {\n  ${pagesField.name}(${args.join(", ")}) {\n    ${bodySelection}\n  }\n}`;

  return {
    operationName,
    query,
    variables: (input) => ({
      slug: input.slug,
      ...(hasLocaleArg && input.locale ? { locale: input.locale } : {}),
      ...((pagesField.args ?? []).some((arg) => arg.name === "status") && input.status ? { status: input.status } : {}),
      ...(hasPublishedVersionArg ? { hasPublishedVersion: input.hasPublishedVersion } : {})
    }),
    parse: (payload) => parseFindResult(payload, parsePath)
  };
}

function buildSafePageSelection(pageType: IntrospectionType): string {
  const safeScalars = new Set(["documentId", "id", "slug", "publishedAt", "createdAt", "updatedAt", "pageType", "layoutKey"]);
  return (pageType.fields ?? [])
    .filter((field) => {
      if (!safeScalars.has(field.name)) {
        return false;
      }
      const kind = unwrapType(field.type).kind;
      return kind === "SCALAR" || kind === "ENUM";
    })
    .map((field) => field.name)
    .join("\n    ");
}

function parseFindResult(payload: Record<string, unknown>, parsePath: string[]): Array<Record<string, unknown>> {
  let cursor: unknown = payload;
  for (const segment of parsePath) {
    cursor = (cursor as Record<string, unknown> | undefined)?.[segment];
  }

  const rows = Array.isArray(cursor) ? cursor : [];
  return rows
    .map((row) => {
      const record = row as Record<string, unknown>;
      if (record.attributes && typeof record.attributes === "object") {
        return {
          ...record.attributes,
          id: record.id
        } as Record<string, unknown>;
      }
      return record;
    })
    .filter((row) => row && typeof row === "object");
}

function buildCreateMutation(
  map: Map<string, IntrospectionType>,
  mutationField: IntrospectionField,
  pageType: IntrospectionType
): OperationBundle["create"] {
  const operationName = "ImporterCreatePage";
  const args = mutationField.args ?? [];
  const dataArg = args.find((arg) => arg.name === "data");
  if (!dataArg) {
    throw new Error(`Mutation ${mutationField.name} missing data arg`);
  }

  const variableDefs = [`$data: ${renderVariableType(dataArg.type)}`];
  const argPairs = ["data: $data"];

  const statusArg = args.find((arg) => arg.name === "status");
  if (statusArg) {
    variableDefs.push(`$status: ${renderVariableType(statusArg.type)}`);
    argPairs.push("status: $status");
  }

  const selection = buildMutationResultSelection(map, mutationField, pageType);
  const mutation = `mutation ${operationName}(${variableDefs.join(", ")}) {\n  ${mutationField.name}(${argPairs.join(", ")}) {\n    ${selection}\n  }\n}`;

  return {
    operationName,
    mutation,
    variables: (input) => ({
      data: input.data,
      ...(statusArg ? { status: input.publishState === "published" ? "PUBLISHED" : "DRAFT" } : {})
    })
  };
}

function buildUpdateMutation(
  map: Map<string, IntrospectionType>,
  mutationField: IntrospectionField,
  pageType: IntrospectionType,
  identifierFacts: { preferred: "documentId" | "id" | "none" }
): OperationBundle["update"] {
  const operationName = "ImporterUpdatePage";
  const args = mutationField.args ?? [];
  const dataArg = args.find((arg) => arg.name === "data");
  if (!dataArg) {
    throw new Error(`Mutation ${mutationField.name} missing data arg`);
  }

  const identifierArg =
    args.find((arg) => arg.name === "documentId") ??
    args.find((arg) => arg.name === "id") ??
    args.find((arg) => arg.name.endsWith("Id"));

  if (!identifierArg) {
    throw new Error(`Mutation ${mutationField.name} missing identifier arg`);
  }

  const identifier = identifierArg.name === "documentId" ? "documentId" : "id";

  if (identifierFacts.preferred === "documentId" && identifier !== "documentId") {
    console.warn("[content-importer] Introspection preferred documentId but update mutation did not expose documentId; falling back to id.");
  }

  const variableDefs = [`$${identifierArg.name}: ${renderVariableType(identifierArg.type)}`, `$data: ${renderVariableType(dataArg.type)}`];
  const argPairs = [`${identifierArg.name}: $${identifierArg.name}`, "data: $data"];

  const statusArg = args.find((arg) => arg.name === "status");
  if (statusArg) {
    variableDefs.push(`$status: ${renderVariableType(statusArg.type)}`);
    argPairs.push("status: $status");
  }

  const selection = buildMutationResultSelection(map, mutationField, pageType);
  const mutation = `mutation ${operationName}(${variableDefs.join(", ")}) {\n  ${mutationField.name}(${argPairs.join(", ")}) {\n    ${selection}\n  }\n}`;

  return {
    operationName,
    mutation,
    identifier,
    variables: (input) => ({
      [identifierArg.name]: input.identifierValue,
      data: input.data,
      ...(statusArg ? { status: input.publishState === "published" ? "PUBLISHED" : "DRAFT" } : {})
    })
  };
}

function buildDeleteMutation(
  map: Map<string, IntrospectionType>,
  mutationField: IntrospectionField,
  pageType: IntrospectionType,
  identifierFacts: { preferred: "documentId" | "id" | "none" }
): OperationBundle["delete"] {
  const operationName = "ImporterDeletePage";
  const args = mutationField.args ?? [];
  const identifierArg =
    args.find((arg) => arg.name === "documentId") ??
    args.find((arg) => arg.name === "id") ??
    args.find((arg) => arg.name.endsWith("Id"));

  if (!identifierArg) {
    throw new Error(`Mutation ${mutationField.name} missing identifier arg`);
  }

  const identifier = identifierArg.name === "documentId" ? "documentId" : "id";
  if (identifierFacts.preferred === "documentId" && identifier !== "documentId") {
    console.warn("[content-importer] Introspection preferred documentId but delete mutation did not expose documentId; falling back to id.");
  }

  const variableDefs = [`$${identifierArg.name}: ${renderVariableType(identifierArg.type)}`];
  const argPairs = [`${identifierArg.name}: $${identifierArg.name}`];
  const selection = buildMutationResultSelection(map, mutationField, pageType);
  const mutation = `mutation ${operationName}(${variableDefs.join(", ")}) {\n  ${mutationField.name}(${argPairs.join(", ")}) {\n    ${selection}\n  }\n}`;

  return {
    operationName,
    mutation,
    identifier,
    variables: (input) => ({
      [identifierArg.name]: input.identifierValue
    })
  };
}

function buildPageSelection(map: Map<string, IntrospectionType>, pageType: IntrospectionType): string {
  const fields = pageType.fields ?? [];
  const scalars = fields
    .filter((field) => {
      const kind = unwrapType(field.type).kind;
      return kind === "SCALAR" || kind === "ENUM";
    })
    .map((field) => field.name);

  const wantedScalars = ["documentId", "id", "slug", "pageType", "layoutKey", "createdAt", "updatedAt", "publishedAt"];
  const selectedScalars = wantedScalars.filter((name) => scalars.includes(name));

  const selections: string[] = [...selectedScalars];

  for (const name of ["conversionConfig", "seo"]) {
    const field = fields.find((item) => item.name === name);
    if (!field) {
      continue;
    }
    const sub = selectNestedFields(map, field);
    if (sub.length > 0) {
      selections.push(`${name} { ${sub.join(" ")} }`);
    }
  }

  const blocks = fields.find((item) => item.name === "blocks");
  if (blocks) {
    const blockSelection = selectBlocks(map, blocks);
    selections.push(`blocks { ${blockSelection} }`);
  }

  return selections.join("\n    ");
}

function selectNestedFields(map: Map<string, IntrospectionType>, field: IntrospectionField): string[] {
  const name = unwrapType(field.type).name;
  const type = name ? map.get(name) : undefined;
  if (!type?.fields) {
    return [];
  }

  return type.fields
    .filter((item) => {
      const kind = unwrapType(item.type).kind;
      return kind === "SCALAR" || kind === "ENUM";
    })
    .map((item) => item.name);
}

function selectBlocks(map: Map<string, IntrospectionType>, blocksField: IntrospectionField): string {
  const containerName = unwrapType(blocksField.type).name;
  const container = containerName ? map.get(containerName) : undefined;

  const unionType = resolveBlockUnion(map, container);
  if (!unionType || !(unionType.possibleTypes ?? []).length) {
    console.warn("[content-importer] Could not resolve blocks union; falling back to __typename only.");
    return "__typename";
  }

  const segments = ["__typename"];
  for (const maybeType of unionType.possibleTypes ?? []) {
    if (!maybeType.name) {
      continue;
    }
    const componentType = map.get(maybeType.name);
    if (!componentType?.fields) {
      continue;
    }

    const fields = selectComponentFields(map, componentType);

    segments.push(`... on ${maybeType.name} { ${fields.join(" ")} }`);
  }

  return segments.join(" ");
}

function selectComponentFields(map: Map<string, IntrospectionType>, componentType: IntrospectionType): string[] {
  const selected: string[] = [];
  for (const field of componentType.fields ?? []) {
    const unwrapped = unwrapType(field.type);
    if (unwrapped.kind === "SCALAR" || unwrapped.kind === "ENUM") {
      selected.push(field.name);
      continue;
    }

    const nested = selectNestedFields(map, field);
    if (nested.length > 0) {
      selected.push(`${field.name} { ${nested.join(" ")} }`);
    }
  }

  return selected;
}

function resolveBlockUnion(map: Map<string, IntrospectionType>, container: IntrospectionType | undefined): IntrospectionType | undefined {
  if (!container) {
    return undefined;
  }

  if ((container.kind === "UNION" || container.kind === "INTERFACE") && (container.possibleTypes ?? []).length > 0) {
    return container;
  }

  const onField = container.fields?.find((field) => field.name === "on");
  const onTypeName = onField ? unwrapType(onField.type).name : undefined;
  return onTypeName ? map.get(onTypeName) : undefined;
}

function buildMutationResultSelection(
  map: Map<string, IntrospectionType>,
  mutationField: IntrospectionField,
  pageType: IntrospectionType
): string {
  const mutationReturnName = unwrapType(mutationField.type).name;
  if (!mutationReturnName) {
    return "__typename";
  }

  const returnType = map.get(mutationReturnName);
  if (!returnType?.fields) {
    return "__typename";
  }

  if (returnType.fields.some((field) => field.name === "data")) {
    const dataField = returnType.fields.find((field) => field.name === "data");
    const dataTypeName = dataField ? unwrapType(dataField.type).name : undefined;
    const dataType = dataTypeName ? map.get(dataTypeName) : undefined;
    const selection = selectEntityIdentifiers(dataType ?? pageType);
    return `data { ${selection} }`;
  }

  return selectEntityIdentifiers(returnType);
}

function selectEntityIdentifiers(type: IntrospectionType): string {
  const fields = (type.fields ?? [])
    .filter((field) => ["id", "documentId", "slug"].includes(field.name))
    .map((field) => field.name);
  return fields.length ? fields.join(" ") : "__typename";
}

function findMutationField(
  fields: IntrospectionField[],
  action: "create" | "update" | "delete",
  pageTypeName: string
): IntrospectionField | undefined {
  const candidateByName = fields.find((field) => field.name.toLowerCase().includes(`${action}page`));
  if (candidateByName) {
    return candidateByName;
  }

  const lowerPage = pageTypeName.toLowerCase().replace(/type$/, "");
  return fields.find((field) => field.name.toLowerCase().includes(action) && field.name.toLowerCase().includes(lowerPage));
}

function resolveStatusValues(map: Map<string, IntrospectionType>, pagesField: IntrospectionField): string[] {
  const statusArg = (pagesField.args ?? []).find((arg) => arg.name === "status");
  if (!statusArg) {
    return [];
  }

  const enumTypeName = unwrapType(statusArg.type).name;
  const enumType = enumTypeName ? map.get(enumTypeName) : undefined;
  return (enumType?.enumValues ?? []).map((item) => item.name);
}

function renderVariableType(typeRef: { kind: string; name?: string | null; ofType?: any }): string {
  if (typeRef.kind === "NON_NULL" && typeRef.ofType) {
    return `${renderVariableType(typeRef.ofType)}!`;
  }
  if (typeRef.kind === "LIST" && typeRef.ofType) {
    return `[${renderVariableType(typeRef.ofType)}]`;
  }
  return typeRef.name ?? "String";
}
