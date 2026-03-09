import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SanitizedDomRoot } from "../import/domSanitizer.js";
import { createImportPlan } from "../index.js";

const tempDirs: string[] = [];

afterEach(async () => {
  delete process.env.LMNAS_IMPORT_ARTIFACTS_DIR;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "content-inline-style-alignment-"));
  tempDirs.push(dir);
  return dir;
}

type SnapshotBlock = {
  __component: "blocks.imported-dom-snapshot";
  domJson: SanitizedDomRoot;
  classMap: Record<string, string>;
  stylesheetRef: string;
};

type ElementWithPath = {
  path: string;
  tag: string;
  attributes: Record<string, string>;
  children: SanitizedDomRoot["children"];
};

function getSnapshotBlock(blocks: Array<Record<string, unknown>>): SnapshotBlock {
  const snapshot = blocks.find((block) => block.__component === "blocks.imported-dom-snapshot");
  if (!snapshot) {
    throw new Error("Expected imported-dom-snapshot block in generated plan");
  }

  return snapshot as unknown as SnapshotBlock;
}

function collectElementsWithPaths(domJson: SanitizedDomRoot): ElementWithPath[] {
  const elements: ElementWithPath[] = [];

  const visit = (nodes: SanitizedDomRoot["children"], parentPath: string) => {
    nodes.forEach((node, index) => {
      const path = parentPath ? `${parentPath}.${index}` : `${index}`;
      if (node.kind !== "element") {
        return;
      }

      elements.push({
        path,
        tag: node.tag,
        attributes: node.attributes,
        children: node.children
      });

      visit(node.children, path);
    });
  };

  visit(domJson.children, "");
  return elements;
}

function hasText(nodes: SanitizedDomRoot["children"], text: string): boolean {
  for (const node of nodes) {
    if (node.kind === "text" && node.text === text) {
      return true;
    }
    if (node.kind === "element" && hasText(node.children, text)) {
      return true;
    }
  }
  return false;
}

describe("inline style alignment in snapshot pipeline", () => {
  it("aligns inline styles to domJson paths after sanitizer removes script/style tags and handlers", async () => {
    const dir = await createTempDir();
    process.env.LMNAS_IMPORT_ARTIFACTS_DIR = dir;

    const htmlPath = path.join(dir, "alignment.html");
    await writeFile(
      htmlPath,
      '<html><head><title>Alignment</title></head><body><div style="margin-top:18px"><script>window.evil=1</script><p style="font-weight:700" onclick="alert(1)">Alpha</p><style>.ignored{color:red;}</style><span style="color:#112233" onclick="alert(2)">Beta</span><a href="/docs#section" style="margin-top:18px;color:#445566">Gamma</a></div><h1>Alignment Heading</h1></body></html>',
      "utf8"
    );

    const plan = await createImportPlan({
      slug: "alignment",
      locale: "en",
      html: htmlPath
    });

    const snapshot = getSnapshotBlock(plan.blocks as Array<Record<string, unknown>>);
    const domJson = snapshot.domJson;
    const classMap = snapshot.classMap;

    const serializedDom = JSON.stringify(domJson);
    expect(serializedDom).not.toContain('"tag":"script"');
    expect(serializedDom).not.toContain('"tag":"style"');

    const elements = collectElementsWithPaths(domJson);
    expect(elements.some((entry) => entry.tag === "script")).toBe(false);
    expect(elements.some((entry) => entry.tag === "style")).toBe(false);

    const divEntry = elements.find(
      (entry) =>
        entry.tag === "div" &&
        entry.children.some((child) => child.kind === "element" && child.tag === "p") &&
        entry.children.some((child) => child.kind === "element" && child.tag === "span") &&
        entry.children.some((child) => child.kind === "element" && child.tag === "a")
    );
    const pEntry = elements.find((entry) => entry.tag === "p" && hasText(entry.children, "Alpha"));
    const spanEntry = elements.find((entry) => entry.tag === "span" && hasText(entry.children, "Beta"));
    const anchorEntry = elements.find((entry) => entry.tag === "a" && hasText(entry.children, "Gamma"));

    if (!divEntry || !pEntry || !spanEntry || !anchorEntry) {
      throw new Error("Expected div/p/span/a nodes for alignment assertions");
    }

    expect(divEntry.attributes.style).toContain("margin-top: 18px");
    expect(divEntry.attributes.onclick).toBeUndefined();
    expect(pEntry.attributes.style).toContain("font-weight: 700");
    expect(pEntry.attributes.onclick).toBeUndefined();
    expect(spanEntry.attributes.style).toContain("color: #112233");
    expect(spanEntry.attributes.onclick).toBeUndefined();
    expect(anchorEntry.attributes.style).toContain("margin-top: 18px");
    expect(anchorEntry.attributes.style).toContain("color: #445566");
    expect(anchorEntry.attributes.onclick).toBeUndefined();

    expect(classMap[divEntry.path]).toContain("mt-[18px]");
    expect(classMap[pEntry.path]).toContain("font-bold");
    expect(classMap[spanEntry.path]).toContain("text-[#112233]");
    expect(classMap[anchorEntry.path]).toContain("mt-[18px]");
    expect(classMap[anchorEntry.path]).toContain("text-[#445566]");
  });
});
