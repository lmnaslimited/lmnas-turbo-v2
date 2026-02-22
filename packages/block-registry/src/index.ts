import { HeroBlockComponent, heroBlockSchema, FAQBlockComponent, faqBlockSchema } from "@lmnas/blocks";
import { manifestBlockTypes } from "./generated/blocks.manifest";

export const blockRegistry = {
  hero: {
    component: HeroBlockComponent,
    schema: heroBlockSchema
  },
  faq: {
    component: FAQBlockComponent,
    schema: faqBlockSchema
  }
} as const;

export type BlockType = keyof typeof blockRegistry;

const manifestTypeSet = new Set<string>(manifestBlockTypes);
for (const manifestType of manifestTypeSet) {
  if (!(manifestType in blockRegistry)) {
    throw new Error(`Manifest block type "${manifestType}" is not registered in blockRegistry.`);
  }
}

const registryTypes = Object.keys(blockRegistry);
const registryOnlyTypes = registryTypes.filter((registryType) => !manifestTypeSet.has(registryType));
if (registryOnlyTypes.length > 0) {
  const message = `Registry block type(s) not present in manifest: ${registryOnlyTypes.join(", ")}`;
  if (process.env.LMNAS_STRICT_REGISTRY_MANIFEST_SYNC === "true") {
    throw new Error(message);
  }
  console.warn(`[block-registry] ${message}`);
}

export function isKnownBlockType(type: string): type is BlockType {
  return manifestTypeSet.has(type) && type in blockRegistry;
}

export function assertKnownBlockType(type: string): asserts type is BlockType {
  if (!isKnownBlockType(type)) {
    throw new Error(`Unknown block type: ${type}`);
  }
}
