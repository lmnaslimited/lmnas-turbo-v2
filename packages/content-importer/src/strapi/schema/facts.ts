import { printType, typeMap, unwrapType, type IntrospectionField, type IntrospectionPayload, type IntrospectionType } from "./introspection.js";

export type SchemaFacts = {
  pagesQueryField: {
    name: string;
    args: Array<{ name: string; type: string }>;
    hasLocaleArg: boolean;
    pageTypeName: string;
  };
  pageIdentifiers: {
    hasDocumentId: boolean;
    hasId: boolean;
    preferred: "documentId" | "id" | "none";
  };
  i18nTypes: string[];
  conversionConfig: {
    kind: string;
    typeName?: string;
    fields: string[];
  };
  seo: {
    kind: string;
    typeName?: string;
    fields: string[];
  };
  blocks: {
    fieldName: string;
    containerTypeName?: string;
    unionTypeName?: string;
    componentTypes: string[];
  };
};

export function deriveSchemaFacts(payload: IntrospectionPayload): SchemaFacts {
  const map = typeMap(payload);
  const queryTypeName = payload.data.__schema.queryType?.name;
  if (!queryTypeName) {
    throw new Error("Introspection missing queryType");
  }

  const queryType = map.get(queryTypeName);
  if (!queryType?.fields) {
    throw new Error(`Introspection missing fields for query type ${queryTypeName}`);
  }

  const pagesField = findPagesField(queryType.fields);
  if (!pagesField) {
    throw new Error("Unable to detect pages query field from introspection");
  }

  const pageTypeName = resolvePageTypeName(map, pagesField);
  const pageType = map.get(pageTypeName);
  const pageFields = pageType?.fields ?? [];

  const conversionConfigField = pageFields.find((field) => field.name === "conversionConfig");
  const seoField = pageFields.find((field) => field.name === "seo");
  const blocksField = pageFields.find((field) => field.name === "blocks");

  const conversionConfigFacts = resolveNestedFieldFacts(map, conversionConfigField);
  const seoFacts = resolveNestedFieldFacts(map, seoField);
  const blocksFacts = resolveBlocksFacts(map, blocksField);

  const i18nTypes = Array.from(map.keys()).filter((name) => name.startsWith("I18N")).sort();

  const hasDocumentId = pageFields.some((field) => field.name === "documentId");
  const hasId = pageFields.some((field) => field.name === "id");

  return {
    pagesQueryField: {
      name: pagesField.name,
      args: (pagesField.args ?? []).map((arg) => ({ name: arg.name, type: printType(arg.type) })),
      hasLocaleArg: (pagesField.args ?? []).some((arg) => arg.name === "locale"),
      pageTypeName
    },
    pageIdentifiers: {
      hasDocumentId,
      hasId,
      preferred: hasDocumentId ? "documentId" : hasId ? "id" : "none"
    },
    i18nTypes,
    conversionConfig: conversionConfigFacts,
    seo: seoFacts,
    blocks: blocksFacts
  };
}

export function formatSchemaFacts(facts: SchemaFacts): string {
  const lines: string[] = [];
  lines.push(`pages query field: ${facts.pagesQueryField.name}`);
  lines.push(
    `pages args: ${facts.pagesQueryField.args.map((item) => `${item.name}:${item.type}`).join(", ") || "(none)"}`
  );
  lines.push(`pages has locale arg: ${facts.pagesQueryField.hasLocaleArg}`);
  lines.push(`page type name: ${facts.pagesQueryField.pageTypeName}`);
  lines.push(`page identifiers: preferred=${facts.pageIdentifiers.preferred}, documentId=${facts.pageIdentifiers.hasDocumentId}, id=${facts.pageIdentifiers.hasId}`);
  lines.push(`i18n types: ${facts.i18nTypes.join(", ") || "(none)"}`);
  lines.push(`conversionConfig: kind=${facts.conversionConfig.kind}, type=${facts.conversionConfig.typeName ?? "(none)"}, fields=${facts.conversionConfig.fields.join(", ") || "(none)"}`);
  lines.push(`seo: kind=${facts.seo.kind}, type=${facts.seo.typeName ?? "(none)"}, fields=${facts.seo.fields.join(", ") || "(none)"}`);
  lines.push(`blocks field: ${facts.blocks.fieldName}`);
  lines.push(`blocks container type: ${facts.blocks.containerTypeName ?? "(none)"}`);
  lines.push(`blocks union/interface: ${facts.blocks.unionTypeName ?? "(none)"}`);
  lines.push(`blocks component types: ${facts.blocks.componentTypes.join(", ") || "(none)"}`);
  return lines.join("\n");
}

function findPagesField(fields: IntrospectionField[]): IntrospectionField | undefined {
  return fields.find((field) => field.name === "pages") ?? fields.find((field) => field.name.toLowerCase().includes("page"));
}

function resolvePageTypeName(map: Map<string, IntrospectionType>, pagesField: IntrospectionField): string {
  const outer = unwrapType(pagesField.type).name;
  if (!outer) {
    throw new Error("Unable to resolve pages return type");
  }

  const outerType = map.get(outer);
  if (!outerType) {
    throw new Error(`Unable to resolve pages return named type: ${outer}`);
  }

  if (outerType.kind === "OBJECT" && outerType.fields?.some((field) => field.name === "data")) {
    const dataField = outerType.fields.find((field) => field.name === "data");
    const inner = dataField ? unwrapType(dataField.type).name : undefined;
    if (inner) {
      const maybeEntity = map.get(inner);
      if (maybeEntity?.fields?.some((field) => field.name === "attributes")) {
        const attrs = maybeEntity.fields.find((field) => field.name === "attributes");
        const attrsName = attrs ? unwrapType(attrs.type).name : undefined;
        if (attrsName) {
          return attrsName;
        }
      }
      return inner;
    }
  }

  if (outerType.kind === "OBJECT") {
    return outer;
  }

  throw new Error(`Unsupported pages return kind: ${outerType.kind}`);
}

function resolveNestedFieldFacts(
  map: Map<string, IntrospectionType>,
  field: IntrospectionField | undefined
): { kind: string; typeName?: string; fields: string[] } {
  if (!field) {
    return { kind: "missing", fields: [] };
  }

  const unwrapped = unwrapType(field.type);
  if (!unwrapped.name) {
    return { kind: unwrapped.kind, fields: [] };
  }

  const type = map.get(unwrapped.name);
  const fields = (type?.fields ?? [])
    .filter((item) => {
      const kind = unwrapType(item.type).kind;
      return kind === "SCALAR" || kind === "ENUM";
    })
    .map((item) => item.name)
    .sort();

  return {
    kind: unwrapped.kind,
    typeName: unwrapped.name,
    fields
  };
}

function resolveBlocksFacts(
  map: Map<string, IntrospectionType>,
  blocksField: IntrospectionField | undefined
): { fieldName: string; containerTypeName?: string; unionTypeName?: string; componentTypes: string[] } {
  if (!blocksField) {
    return { fieldName: "(missing)", componentTypes: [] };
  }

  const containerTypeName = unwrapType(blocksField.type).name;
  const container = containerTypeName ? map.get(containerTypeName) : undefined;

  let unionTypeName: string | undefined;
  let componentTypes: string[] = [];

  if (container?.kind === "UNION" || container?.kind === "INTERFACE") {
    unionTypeName = containerTypeName;
    componentTypes = (container.possibleTypes ?? [])
      .map((item) => item.name)
      .filter((name): name is string => Boolean(name))
      .sort();
  }

  if ((!unionTypeName || componentTypes.length === 0) && container?.fields) {
    const onField = container.fields.find((field) => field.name === "on");
    const maybeUnionName = onField ? unwrapType(onField.type).name : undefined;
    const maybeUnion = maybeUnionName ? map.get(maybeUnionName) : undefined;
    if (maybeUnion?.possibleTypes?.length) {
      unionTypeName = maybeUnionName;
      componentTypes = maybeUnion.possibleTypes
        .map((item) => item.name)
        .filter((name): name is string => Boolean(name))
        .sort();
    }
  }

  return {
    fieldName: blocksField.name,
    containerTypeName,
    unionTypeName,
    componentTypes
  };
}
