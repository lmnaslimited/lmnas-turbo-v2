import defaults from "./defaults.json";
import type { ImportedDomSnapshotBlock } from "./schema";

const importedDomSnapshotDefaults = defaults as Omit<ImportedDomSnapshotBlock, "type">;

export function getImportedDomSnapshotMock(): ImportedDomSnapshotBlock {
  return {
    type: "imported_dom_snapshot",
    ...importedDomSnapshotDefaults
  };
}
