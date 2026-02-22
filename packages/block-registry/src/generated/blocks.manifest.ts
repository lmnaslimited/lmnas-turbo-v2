// AUTO-GENERATED FILE. DO NOT EDIT.
// Run `pnpm contracts:gen` to regenerate.

export const blockManifest = [
  {
    "type": "hero",
    "strapi": {
      "schemaPath": "services/strapi/src/components/blocks/hero.json",
      "collectionName": "components_blocks_heroes",
      "displayName": "hero"
    },
    "governance": {
      "phase": "M1",
      "conversionBlock": true,
      "requiresProductMapping": true,
      "requiresConversionConfig": true,
      "requiresPrimaryCta": true
    },
    "editor": {
      "allowedOnPageTypes": [
        "home",
        "product",
        "solution",
        "industry",
        "simple"
      ]
    }
  }
] as const;

export type ManifestBlockEntry = (typeof blockManifest)[number];
export type ManifestBlockType = ManifestBlockEntry["type"];

export const manifestBlockTypes = blockManifest.map((block) => block.type) as ManifestBlockType[];
