import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

interface StrapiContract {
  meta: {
    strapi: {
      schemaPath: string;
      collectionName: string;
      displayName: string;
      componentFields?: Record<string, string>;
    };
  };
  schema: unknown;
}

interface BlockContract extends StrapiContract {
  type: string;
  meta: StrapiContract["meta"] & {
    governance: {
      phase: string;
      conversionBlock: boolean;
      requiresProductMapping: boolean;
      requiresConversionConfig: boolean;
      requiresPrimaryCta: boolean;
    };
    editor: {
      allowedOnPageTypes: string[];
    };
  };
}

interface GeneratedOutput {
  relativePath: string;
  content: string;
}

const thisFilePath = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(thisFilePath), "../../..");
const contractsSrcDir = path.join(workspaceRoot, "packages/contracts/src");
const contractsDistDir = path.join(workspaceRoot, "packages/contracts/dist");
const manifestPath = "packages/block-registry/src/generated/blocks.manifest.ts";

function getZodTypeName(value: unknown): string {
  const unknownRecord = value as { _def?: { typeName?: string } };
  return unknownRecord?._def?.typeName ?? "Unknown";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStrapiContract(value: unknown): value is StrapiContract {
  if (!isObject(value) || !isObject(value.meta) || !("schema" in value)) {
    return false;
  }

  const { strapi } = value.meta as Record<string, unknown>;
  if (!isObject(strapi)) {
    return false;
  }

  return (
    typeof strapi.schemaPath === "string" &&
    typeof strapi.collectionName === "string" &&
    typeof strapi.displayName === "string"
  );
}

function isBlockContract(value: StrapiContract): value is BlockContract {
  if (!("type" in value) || typeof value.type !== "string") {
    return false;
  }

  const { governance, editor } = value.meta as Record<string, unknown>;
  return isObject(governance) && isObject(editor) && Array.isArray(editor.allowedOnPageTypes);
}

function unwrapSchema(schema: unknown): unknown {
  let current = schema;

  while (true) {
    const typeName = getZodTypeName(current);
    if (typeName === "ZodEffects") {
      current = (current as { _def?: { schema?: unknown } })._def?.schema;
      continue;
    }

    if (typeName === "ZodBranded" || typeName === "ZodReadonly") {
      current = (current as { _def?: { type?: unknown } })._def?.type;
      continue;
    }

    if (typeName === "ZodCatch") {
      current = (current as { _def?: { innerType?: unknown } })._def?.innerType;
      continue;
    }

    return current;
  }
}

function getObjectShape(schema: unknown, contextPath: string): Record<string, unknown> {
  const unwrappedSchema = unwrapSchema(schema);
  const schemaRecord = unwrappedSchema as { _def?: { shape?: unknown } };
  const typeName = getZodTypeName(unwrappedSchema);

  if (typeName !== "ZodObject") {
    throw new Error(`Unsupported Zod schema at ${contextPath}: expected ZodObject, got ${typeName}`);
  }

  const shape = schemaRecord?._def?.shape;
  if (typeof shape === "function") {
    const resolvedShape = (shape as () => Record<string, unknown>)();
    if (isObject(resolvedShape)) {
      return resolvedShape;
    }
  }

  throw new Error(`Unsupported Zod schema at ${contextPath}: unable to read object shape`);
}

function hasMinOneStringCheck(schema: unknown): boolean {
  const schemaRecord = schema as { _def?: { checks?: Array<{ kind?: string; value?: number }> } };
  const checks = schemaRecord?._def?.checks;
  if (!Array.isArray(checks)) {
    return false;
  }

  return checks.some((check) => check.kind === "min" && typeof check.value === "number" && check.value >= 1);
}

function unwrapOptional(schema: unknown): { optional: boolean; schema: unknown } {
  let current = unwrapSchema(schema);
  let optional = false;

  while (true) {
    const typeName = getZodTypeName(current);
    if (typeName === "ZodOptional") {
      optional = true;
      current = unwrapSchema((current as { _def?: { innerType?: unknown } })._def?.innerType);
      continue;
    }

    if (typeName === "ZodDefault") {
      optional = true;
      current = unwrapSchema((current as { _def?: { innerType?: unknown } })._def?.innerType);
      continue;
    }

    return { optional, schema: current };
  }
}

function mapFieldToStrapiAttribute(
  fieldName: string,
  fieldSchema: unknown,
  fieldPath: string,
  componentFields: Record<string, string>
): JsonObject {
  const unwrapped = unwrapOptional(fieldSchema);
  const componentRef = componentFields[fieldName];
  if (componentRef) {
    const attribute: JsonObject = {
      type: "component",
      repeatable: false,
      component: componentRef
    };
    if (!unwrapped.optional) {
      attribute.required = true;
    }
    return attribute;
  }

  const typeName = getZodTypeName(unwrapped.schema);

  if (typeName === "ZodString") {
    const attribute: JsonObject = { type: "string" };
    if (!unwrapped.optional && hasMinOneStringCheck(unwrapped.schema)) {
      attribute.required = true;
    }
    return attribute;
  }

  if (typeName === "ZodEnum") {
    const values = (unwrapped.schema as { _def?: { values?: unknown } })._def?.values;
    if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
      throw new Error(`Unsupported Zod enum at ${fieldPath}: expected string values`);
    }

    const attribute: JsonObject = { type: "enumeration", enum: values as string[] };
    if (!unwrapped.optional) {
      attribute.required = true;
    }
    return attribute;
  }

  if (typeName === "ZodObject") {
    const attribute: JsonObject = { type: "json" };
    if (!unwrapped.optional) {
      attribute.required = true;
    }
    return attribute;
  }

  throw new Error(`Unsupported Zod field at ${fieldPath}: ${typeName}`);
}

function schemaToStrapiAttributes(
  schema: unknown,
  contractType: string,
  componentFields: Record<string, string>
): Record<string, JsonObject> {
  const shape = getObjectShape(schema, `${contractType}.schema`);
  const attributes: Record<string, JsonObject> = {};

  for (const key of Object.keys(shape)) {
    if (key === "type") {
      continue;
    }

    attributes[key] = mapFieldToStrapiAttribute(key, shape[key], `${contractType}.${key}`, componentFields);
  }

  return attributes;
}

function renderManifest(contracts: BlockContract[]): string {
  const entries = contracts
    .map((contract) => ({
      type: contract.type,
      strapi: {
        schemaPath: contract.meta.strapi.schemaPath,
        collectionName: contract.meta.strapi.collectionName,
        displayName: contract.meta.strapi.displayName
      },
      governance: {
        phase: contract.meta.governance.phase,
        conversionBlock: contract.meta.governance.conversionBlock,
        requiresProductMapping: contract.meta.governance.requiresProductMapping,
        requiresConversionConfig: contract.meta.governance.requiresConversionConfig,
        requiresPrimaryCta: contract.meta.governance.requiresPrimaryCta
      },
      editor: {
        allowedOnPageTypes: contract.meta.editor.allowedOnPageTypes
      }
    }))
    .sort((a, b) => a.type.localeCompare(b.type));

  return [
    "// AUTO-GENERATED FILE. DO NOT EDIT.",
    "// Run `pnpm contracts:gen` to regenerate.",
    "",
    `export const blockManifest = ${JSON.stringify(entries, null, 2)} as const;`,
    "",
    "export type ManifestBlockEntry = (typeof blockManifest)[number];",
    "export type ManifestBlockType = ManifestBlockEntry[\"type\"];",
    "",
    "export const manifestBlockTypes = blockManifest.map((block) => block.type) as ManifestBlockType[];",
    ""
  ].join("\n");
}

async function loadContracts(): Promise<StrapiContract[]> {
  const files = await findContractSourceFiles(contractsSrcDir);

  const contracts: StrapiContract[] = [];

  for (const sourceFilePath of files) {
    const distFile = path.basename(sourceFilePath).replace(/\.ts$/, ".js");
    const distPath = await findFileRecursive(contractsDistDir, distFile);
    if (!distPath) {
      throw new Error(`Cannot find built contract module for ${sourceFilePath}. Run build for @lmnas/contracts.`);
    }
    const moduleUrl = `${pathToFileURL(distPath).href}?cacheBust=${Date.now()}`;
    const importedModule = (await import(moduleUrl)) as Record<string, unknown>;

    for (const exportedValue of Object.values(importedModule)) {
      if (isStrapiContract(exportedValue)) {
        contracts.push(exportedValue);
      }
    }
  }

  if (contracts.length === 0) {
    throw new Error("No contracts found under packages/contracts/src/**/*.contract.ts");
  }

  return contracts.sort((a, b) => a.meta.strapi.schemaPath.localeCompare(b.meta.strapi.schemaPath));
}

async function findFileRecursive(dirPath: string, fileName: string): Promise<string | null> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const resolved = await findFileRecursive(entryPath, fileName);
      if (resolved) {
        return resolved;
      }
      continue;
    }

    if (entry.isFile() && entry.name === fileName) {
      return entryPath;
    }
  }

  return null;
}

async function findContractSourceFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findContractSourceFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".contract.ts")) {
      files.push(entryPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function generateOutputs(contracts: StrapiContract[]): GeneratedOutput[] {
  const outputs: GeneratedOutput[] = [];

  for (const contract of contracts) {
    const contractIdentifier = isBlockContract(contract) ? contract.type : contract.meta.strapi.displayName;
    const attributes = schemaToStrapiAttributes(
      contract.schema,
      contractIdentifier,
      contract.meta.strapi.componentFields ?? {}
    );
    const strapiSchema = {
      collectionName: contract.meta.strapi.collectionName,
      info: {
        displayName: contract.meta.strapi.displayName
      },
      options: {},
      attributes
    };

    outputs.push({
      relativePath: contract.meta.strapi.schemaPath,
      content: `${JSON.stringify(strapiSchema, null, 2)}\n`
    });
  }

  const blockContracts = contracts.filter(isBlockContract);
  outputs.push({
    relativePath: manifestPath,
    content: renderManifest(blockContracts)
  });

  return outputs;
}

async function writeOutputs(baseDir: string, outputs: GeneratedOutput[]): Promise<void> {
  for (const output of outputs) {
    const filePath = path.join(baseDir, output.relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, output.content, "utf8");
  }
}

async function runGen(contracts: StrapiContract[]): Promise<void> {
  const outputs = generateOutputs(contracts);
  await writeOutputs(workspaceRoot, outputs);
  console.log(`Generated ${outputs.length} files from ${contracts.length} contract(s).`);
}

async function runCheck(contracts: StrapiContract[]): Promise<void> {
  const outputs = generateOutputs(contracts);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "lmnas-contracts-sync-"));
  await writeOutputs(tempDir, outputs);

  const driftedFiles: string[] = [];

  for (const output of outputs) {
    const expectedPath = path.join(tempDir, output.relativePath);
    const actualPath = path.join(workspaceRoot, output.relativePath);
    const expectedContent = await readFile(expectedPath, "utf8");
    let actualContent = "";

    try {
      actualContent = await readFile(actualPath, "utf8");
    } catch {
      driftedFiles.push(output.relativePath);
      continue;
    }

    if (actualContent !== expectedContent) {
      driftedFiles.push(output.relativePath);
    }
  }

  if (driftedFiles.length > 0) {
    throw new Error(`Contract drift detected:\n- ${driftedFiles.join("\n- ")}\nRun pnpm contracts:gen`);
  }

  console.log("contracts:check passed.");
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command !== "gen" && command !== "check") {
    throw new Error("Usage: node dist/cli.js <gen|check>");
  }

  const contracts = await loadContracts();
  if (command === "gen") {
    await runGen(contracts);
    return;
  }

  await runCheck(contracts);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
