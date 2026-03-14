import { importedDomSnapshotBlockSchema } from "@lmnas/blocks/ImportedDomSnapshot/schema.js";
import type { BlockContract } from "./hero.contract";

export const importedDomSnapshotContract: BlockContract = {
  type: "imported_dom_snapshot",
  meta: {
    strapi: {
      schemaPath: "services/strapi/src/components/blocks/imported-dom-snapshot.json",
      collectionName: "components_blocks_imported_dom_snapshots",
      displayName: "imported-dom-snapshot"
    },
    governance: {
      phase: "M1",
      conversionBlock: false,
      requiresProductMapping: false,
      requiresConversionConfig: false,
      requiresPrimaryCta: false
    },
    editor: {
      allowedOnPageTypes: ["home", "product", "solution", "industry", "simple"]
    }
  },
  schema: importedDomSnapshotBlockSchema
};
