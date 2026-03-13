import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchIntrospection } from "./introspection.js";
import { deriveSchemaFacts, formatSchemaFacts } from "./facts.js";
import { generateArtifactsFromIntrospection, stableJson, writeGeneratedArtifacts } from "./generateArtifacts.js";

export async function generateSchemaArtifacts(options: {
  strapiUrl: string;
  strapiToken: string;
  graphqlPath?: string;
  rootDir: string;
  debugSchema?: boolean;
}): Promise<void> {
  const introspection = await fetchIntrospection({
    strapiUrl: options.strapiUrl,
    strapiToken: options.strapiToken,
    graphqlPath: options.graphqlPath
  });

  const schemaDir = path.join(options.rootDir, "src/strapi/schema");
  await mkdir(schemaDir, { recursive: true });
  await writeFile(path.join(schemaDir, "introspection.json"), stableJson(introspection), "utf8");

  const artifacts = generateArtifactsFromIntrospection(introspection as never);
  await writeGeneratedArtifacts(options.rootDir, artifacts);

  if (options.debugSchema) {
    console.info("[content-importer] blocks union", artifacts.unionName);
    console.info("[content-importer] block component types", artifacts.componentTypes);
    console.info("[content-importer] selected fields", artifacts.selectedFields);
  }
}

export function printSchemaFactsFromPayload(payload: Record<string, unknown>): void {
  const facts = deriveSchemaFacts(payload as never);
  console.log(formatSchemaFacts(facts));
}
