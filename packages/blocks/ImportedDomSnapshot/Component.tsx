import React from "react";
import type { ImportedDomSnapshotBlock, SanitizedDomNode } from "./schema";

const safeTags = new Set([
  "a",
  "article",
  "aside",
  "b",
  "blockquote",
  "br",
  "button",
  "code",
  "div",
  "em",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "img",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul"
]);

const passthroughAttributes = new Set([
  "alt",
  "colspan",
  "href",
  "id",
  "rel",
  "rowspan",
  "scope",
  "src",
  "target",
  "title"
]);

function normalizeTag(tag: string): string {
  const normalized = tag.toLowerCase();
  return safeTags.has(normalized) ? normalized : "div";
}

function buildProps(attributes: Record<string, string>, pathKey: string, classMap: Record<string, string>) {
  const props: Record<string, string> = {};

  for (const [attributeName, attributeValue] of Object.entries(attributes)) {
    if (attributeName === "class") {
      props.className = attributeValue;
      continue;
    }

    if (attributeName.startsWith("data-") || attributeName.startsWith("aria-") || passthroughAttributes.has(attributeName)) {
      props[attributeName] = attributeValue;
    }
  }

  const mappedClass = classMap[pathKey];
  const mergedClass = [props.className, mappedClass].filter(Boolean).join(" ");
  if (mergedClass) {
    props.className = mergedClass;
  }

  return props;
}

function renderNode(node: SanitizedDomNode, pathKey: string, classMap: Record<string, string>): React.ReactNode {
  if (node.kind === "text") {
    return node.text;
  }

  const tag = normalizeTag(node.tag);
  const props = buildProps(node.attributes, pathKey, classMap);
  const children = node.children.map((childNode, index) => renderNode(childNode, `${pathKey}.${index}`, classMap));

  return React.createElement(tag, { key: pathKey, ...props }, children);
}

export function ImportedDomSnapshotBlockComponent({ block }: { block: ImportedDomSnapshotBlock }) {
  return (
    <section data-block-type={block.type} data-stylesheet-ref={block.stylesheetRef}>
      {block.domJson.children.map((node, index) => renderNode(node, `${index}`, block.classMap))}
    </section>
  );
}
