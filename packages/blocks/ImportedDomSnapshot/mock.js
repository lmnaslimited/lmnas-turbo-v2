import defaults from "./defaults.json";
export function getImportedDomSnapshotMock() {
    return {
        type: "imported_dom_snapshot",
        ...defaults
    };
}
