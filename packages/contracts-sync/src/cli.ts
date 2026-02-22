import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

interface BlockContract {
  type: string;
  meta: {
    strapi: {
      schemaPath: string;
      collectionName: string;
      displayName: string;
    };
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
  schema: unknown;
}

interface GeneratedOutput {
  relativePath: string;
  content: string;
}

const thisFilePath = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(thisFilePath), "../../..");
const contractsSrcBlocksDir = path.join(workspaceRoot, "packages/contracts/src/blocks");
const contractsDistDir = path.join(workspaceRoot, "packages/contracts/dist");
const manifestPath = "packages/block-registry/src/generated/blocks.manifest.ts";

function getZodTypeName(value: unknown): string {
  const unknownRecord = value as { _def?: { typeName?: string } };
  return unknownRecord?._def?.typeName ?? "Unknown";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBlockContract(value: unknown): value is BlockContract {
  if (!isObject(value) || typeof value.type !== "string" || !isObject(value.meta) || !("schema" in value)) {
    return false;
  }

  const { strapi, governance, editor } = value.meta as Record<string, unknown>;
  if (!isObject(strapi) || !isObject(governance) || !isObject(editor)) {
    return false;
  }

  return (
    typeof strapi.schemaPath === "string" &&
    typeof strapi.collectionName === "string" &&
    typeof strapi.displayName === "string" &&
    Array.isArray(editor.allowedOnPageTypes)
  );
}

function getObjectShape(schema: unknown, contextPath: string): Record<string, unknown> {
  const schemaRecord = schema as { _def?: { shape?: unknown } };
  const typeName = getZodTypeName(schema);

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
  let current = schema;
  let optional = false;

  while (true) {
    const typeName = getZodTypeName(current);
    if (typeName === "ZodOptional") {
      optional = true;
      current = (current as { _def?: { innerType?: unknown } })._def?.innerType;
      continue;
    }

    if (typeName === "ZodDefault") {
      optional = true;
      current = (current as { _def?: { innerType?: unknown } })._def?.innerType;
      continue;
    }

    return { optional, schema: current };
  }
}

function mapFieldToStrapiAttribute(fieldSchema: unknown, fieldPath: string): JsonObject {
  const unwrapped = unwrapOptional(fieldSchema);
  const typeName = getZodTypeName(unwrapped.schema);

  if (typeName === "ZodString") {
    const attribute: JsonObject = { type: "string" };
    if (!unwrapped.optional && hasMinOneStringCheck(unwrapped.schema)) {
      attribute.required = true;
    }
    return attribute;
  }

  throw new Error(`Unsupported Zod field at ${fieldPath}: ${typeName}`);
}

function schemaToStrapiAttributes(schema: unknown, contractType: string): Record<string, JsonObject> {
  const shape = getObjectShape(schema, `${contractType}.schema`);
  const attributes: Record<string, JsonObject> = {};

  for (const key of Object.keys(shape)) {
    if (key === "type") {
      continue;
    }

    attributes[key] = mapFieldToStrapiAttribute(shape[key], `${contractType}.${key}`);
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

async function loadContracts(): Promise<BlockContract[]> {
  const files = (await readdir(contractsSrcBlocksDir))
    .filter((file) => file.endsWith(".contract.ts"))
    .sort((a, b) => a.localeCompare(b));

  const contracts: BlockContract[] = [];

  for (const sourceFile of files) {
    const distFile = sourceFile.replace(/\.ts$/, ".js");
    const distPath = await findFileRecursive(contractsDistDir, distFile);
    if (!distPath) {
      throw new Error(`Cannot find built contract module for ${sourceFile}. Run build for @lmnas/contracts.`);
    }
    const moduleUrl = `${pathToFileURL(distPath).href}?cacheBust=${Date.now()}`;
    const importedModule = (await import(moduleUrl)) as Record<string, unknown>;

    for (const exportedValue of Object.values(importedModule)) {
      if (isBlockContract(exportedValue)) {
        contracts.push(exportedValue);
      }
    }
  }

  if (contracts.length === 0) {
    throw new Error("No contracts found under packages/contracts/src/blocks/*.contract.ts");
  }

  return contracts.sort((a, b) => a.type.localeCompare(b.type));
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

function generateOutputs(contracts: BlockContract[]): GeneratedOutput[] {
  const outputs: GeneratedOutput[] = [];

  for (const contract of contracts) {
    const attributes = schemaToStrapiAttributes(contract.schema, contract.type);
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

  outputs.push({
    relativePath: manifestPath,
    content: renderManifest(contracts)
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

async function runGen(contracts: BlockContract[]): Promise<void> {
  const outputs = generateOutputs(contracts);
  await writeOutputs(workspaceRoot, outputs);
  console.log(`Generated ${outputs.length} files from ${contracts.length} contract(s).`);
}

async function runCheck(contracts: BlockContract[]): Promise<void> {
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
