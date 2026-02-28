import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { blockFieldAllowlist } from "./blockFieldAllowlist.js";

type IntrospectionTypeRef = {
  kind: string;
  name?: string | null;
  ofType?: IntrospectionTypeRef | null;
};

type IntrospectionField = {
  name: string;
  type: IntrospectionTypeRef;
};

type IntrospectionType = {
  kind: string;
  name?: string | null;
  fields?: IntrospectionField[] | null;
  possibleTypes?: Array<{ name?: string | null }> | null;
};

type IntrospectionSchema = {
  data?: {
    __schema?: {
      types?: IntrospectionType[];
    };
  };
};

type GeneratedArtifacts = {
  unionName?: string;
  componentTypes: string[];
  fragmentBody: string;
  selectedFields: Record<string, string[]>;
};

function unwrapType(typeRef: IntrospectionTypeRef): { kind: string; name?: string } {
  let cursor: IntrospectionTypeRef | null | undefined = typeRef;
  while (cursor && (cursor.kind === "NON_NULL" || cursor.kind === "LIST")) {
    cursor = cursor.ofType;
  }

  return {
    kind: cursor?.kind ?? "UNKNOWN",
    name: cursor?.name ?? undefined
  };
}

function isScalarLike(kind: string): boolean {
  return kind === "SCALAR" || kind === "ENUM";
}

function getTypeMap(schema: IntrospectionSchema): Map<string, IntrospectionType> {
  const types = schema.data?.__schema?.types ?? [];
  const map = new Map<string, IntrospectionType>();
  for (const type of types) {
    if (type.name) {
      map.set(type.name, type);
    }
  }
  return map;
}

function detectPageType(typeMap: Map<string, IntrospectionType>): IntrospectionType {
  const namedPage = typeMap.get("Page");
  if (namedPage?.fields?.some((field) => field.name === "blocks")) {
    return namedPage;
  }

  for (const type of typeMap.values()) {
    const fields = type.fields ?? [];
    const hasSlug = fields.some((field) => field.name === "slug");
    const hasBlocks = fields.some((field) => field.name === "blocks");
    if (type.kind === "OBJECT" && hasSlug && hasBlocks) {
      return type;
    }
  }

  throw new Error("Unable to detect Page type for blocks union discovery");
}

function collectSubFields(typeMap: Map<string, IntrospectionType>, typeName: string, depth: number): string[] {
  const type = typeMap.get(typeName);
  if (!type?.fields || depth <= 0) {
    return [];
  }

  const selected: string[] = [];
  for (const field of type.fields) {
    const unwrapped = unwrapType(field.type);
    if (isScalarLike(unwrapped.kind) && !blockFieldAllowlist.scalar.deny.includes(field.name)) {
      selected.push(field.name);
      continue;
    }

    if (!unwrapped.name || depth === 0) {
      continue;
    }

    const nestedType = typeMap.get(unwrapped.name);
    if (!nestedType?.fields) {
      continue;
    }

    const nestedScalars = nestedType.fields
      .filter((nestedField) => isScalarLike(unwrapType(nestedField.type).kind) && !blockFieldAllowlist.scalar.deny.includes(nestedField.name))
      .map((nestedField) => nestedField.name);

    const allowNested =
      blockFieldAllowlist.nested.relationNames.includes(field.name) ||
      blockFieldAllowlist.media.fields.some((mediaField) => nestedScalars.includes(mediaField));

    if (!allowNested || nestedScalars.length === 0) {
      continue;
    }

    selected.push(`${field.name} { ${nestedScalars.join(" ")} }`);
  }

  return selected;
}

export function generateArtifactsFromIntrospection(schema: IntrospectionSchema): GeneratedArtifacts {
  const typeMap = getTypeMap(schema);
  const pageType = detectPageType(typeMap);
  const blocksField = (pageType.fields ?? []).find((field) => field.name === "blocks");

  if (!blocksField) {
    throw new Error("Page.blocks field is not present in introspection schema");
  }

  const unionTypeName = unwrapType(blocksField.type).name;
  if (!unionTypeName) {
    return {
      unionName: undefined,
      componentTypes: [],
      fragmentBody: "fragment ImporterPageBlocks on UnknownDynamicZone {\n  __typename\n}\n",
      selectedFields: {}
    };
  }

  const directUnion = typeMap.get(unionTypeName);
  const unionType =
    directUnion && (directUnion.kind === "UNION" || directUnion.kind === "INTERFACE")
      ? directUnion
      : resolveNestedUnionType(typeMap, directUnion);

  const componentTypes = (unionType?.possibleTypes ?? [])
    .map((item) => item.name)
    .filter((name): name is string => Boolean(name));

  if (!unionType || componentTypes.length === 0) {
    return {
      unionName: unionTypeName,
      componentTypes: [],
      fragmentBody: `fragment ImporterPageBlocks on ${unionTypeName} {\n  __typename\n}\n`,
      selectedFields: {}
    };
  }

  const selectedFields: Record<string, string[]> = {};
  const parts: string[] = [`fragment ImporterPageBlocks on ${unionTypeName} {`, "  __typename"];

  for (const componentTypeName of componentTypes) {
    const fields = collectSubFields(typeMap, componentTypeName, 1);
    selectedFields[componentTypeName] = fields;

    parts.push(`  ... on ${componentTypeName} {`);
    const fragmentFields = fields.length > 0 ? fields : ["__typename"];
    parts.push(...fragmentFields.map((field) => `    ${field}`));
    parts.push("  }");
  }

  parts.push("}");

  return {
    unionName: unionTypeName,
    componentTypes,
    fragmentBody: parts.join("\n") + "\n",
    selectedFields
  };
}

export async function writeGeneratedArtifacts(rootDir: string, artifacts: GeneratedArtifacts): Promise<void> {
  const operationsDir = path.join(rootDir, "src/strapi/operations");
  const generatedDir = path.join(rootDir, "src/strapi/generated");

  await mkdir(operationsDir, { recursive: true });
  await mkdir(generatedDir, { recursive: true });

  const fragmentPath = path.join(operationsDir, "pageBlocks.fragments.graphql");
  await writeFile(fragmentPath, artifacts.fragmentBody, "utf8");

  const generatedTs = [
    "/* This file is generated by content:schema. Do not edit manually. */",
    `export const BLOCKS_UNION_NAME = ${JSON.stringify(artifacts.unionName ?? null)};`,
    `export const BLOCK_COMPONENT_TYPES = ${JSON.stringify(artifacts.componentTypes, null, 2)} as const;`,
    `export const PAGE_BLOCKS_FRAGMENT = ${JSON.stringify(artifacts.fragmentBody)};`,
    `export const BLOCK_SELECTED_FIELDS = ${JSON.stringify(artifacts.selectedFields, null, 2)} as const;`,
    "",
    "export type ImporterBlockNode = Record<string, unknown> & { __typename?: string };"
  ].join("\n");

  await writeFile(path.join(generatedDir, "graphql.ts"), `${generatedTs}\n`, "utf8");
}

function resolveNestedUnionType(
  typeMap: Map<string, IntrospectionType>,
  maybeContainer: IntrospectionType | undefined
): IntrospectionType | undefined {
  if (!maybeContainer?.fields) {
    return undefined;
  }

  const onField = maybeContainer.fields.find((field) => field.name === "on");
  const onTypeName = onField ? unwrapType(onField.type).name : undefined;
  const onType = onTypeName ? typeMap.get(onTypeName) : undefined;
  if (onType && (onType.kind === "UNION" || onType.kind === "INTERFACE")) {
    return onType;
  }

  return undefined;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, val]) => [key, sortKeys(val)]));
  }

  return value;
}
