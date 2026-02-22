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

export function isKnownBlockType(type: string): type is BlockType {
  if (manifestTypeSet.has(type)) {
    return type in blockRegistry;
  }

  return type in blockRegistry;
}

export function assertKnownBlockType(type: string): asserts type is BlockType {
  if (!isKnownBlockType(type)) {
    throw new Error(`Unknown block type: ${type}`);
  }
}
