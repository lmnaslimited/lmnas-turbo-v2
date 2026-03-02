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

  it("renders void tags (img/br/hr/etc) without children and without crashing", () => {
    const voidTagBlock = {
      type: "imported_dom_snapshot" as const,
      stylesheetRef: "/generated/imported/void-test.css",
      classMap: {
        "0": "mt-[18px]"
      },
      domJson: {
        kind: "root" as const,
        children: [
          {
            kind: "element" as const,
            tag: "img",
            attributes: {
              src: "https://example.com/image.png",
              alt: "Example"
            },
            children: [
              {
                kind: "text" as const,
                text: "ignored child text"
              }
            ]
          }
        ]
      }
    };

    const parsed = importedDomSnapshotBlockSchema.safeParse(voidTagBlock);
    expect(parsed.success).toBe(true);

    const tree = ImportedDomSnapshotBlockComponent({ block: voidTagBlock }) as React.ReactElement<Record<string, unknown>>;
    const firstChild = (tree.props.children as React.ReactElement<Record<string, unknown>>[])[0];
    expect(firstChild.type).toBe("img");
    expect(firstChild.props.children).toBeUndefined();
    expect(firstChild.props.dangerouslySetInnerHTML).toBeUndefined();

    expect(() => renderToString(<ImportedDomSnapshotBlockComponent block={voidTagBlock} />)).not.toThrow();

    const html = renderToString(<ImportedDomSnapshotBlockComponent block={voidTagBlock} />);
    expect(html).toContain("<img");
    expect(html).not.toContain("ignored child text");
  });
});
