import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImportedDomSnapshotBlockComponent } from "./Component";
import { getImportedDomSnapshotMock } from "./mock";
import { importedDomSnapshotBlockSchema } from "./schema";

const mockImportedDomSnapshotBlock = getImportedDomSnapshotMock();

describe("ImportedDomSnapshotBlock", () => {
  it("validates schema correctly", () => {
    const parsed = importedDomSnapshotBlockSchema.safeParse(mockImportedDomSnapshotBlock);
    expect(parsed.success).toBe(true);
  });

  it("renders sanitized domJson nodes without raw html", () => {
    const html = renderToString(<ImportedDomSnapshotBlockComponent block={mockImportedDomSnapshotBlock} />);

    expect(html).toContain("Imported Snapshot");
    expect(html).toContain("Rendered from sanitized domJson.");
    expect(html).toContain("data-stylesheet-ref");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });
});
