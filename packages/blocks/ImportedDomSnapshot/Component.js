import React from "react";
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
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
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
function normalizeTag(tag) {
    const normalized = tag.toLowerCase();
    return safeTags.has(normalized) ? normalized : "div";
}
function isVoidTag(tag) {
    return tag === "img" || tag === "br" || tag === "hr" || VOID_TAGS.has(tag);
}
function buildProps(attributes, pathKey, classMap) {
    const props = {};
    for (const [attributeName, attributeValue] of Object.entries(attributes)) {
        if (attributeName === "children" || attributeName === "dangerouslySetInnerHTML") {
            continue;
        }
        if (attributeName === "class") {
            props.className = attributeValue;
            continue;
        }
        if (attributeName === "style") {
            const styleObject = parseStyleAttribute(attributeValue);
            if (Object.keys(styleObject).length > 0) {
                props.style = styleObject;
            }
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
function parseStyleAttribute(styleText) {
    const style = {};
    const declarations = styleText
        .split(";")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    declarations.forEach((entry) => {
        const separatorIndex = entry.indexOf(":");
        if (separatorIndex === -1) {
            return;
        }
        const rawProperty = entry.slice(0, separatorIndex).trim();
        const rawValue = entry.slice(separatorIndex + 1).trim();
        if (!rawProperty || !rawValue) {
            return;
        }
        const camelProperty = rawProperty.replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
        style[camelProperty] = rawValue;
    });
    return style;
}
function renderNode(node, pathKey, classMap) {
    if (node.kind === "text") {
        return node.text;
    }
    const tag = normalizeTag(node.tag);
    const props = buildProps(node.attributes, pathKey, classMap);
    if (isVoidTag(tag)) {
        const voidProps = {};
        for (const [propName, propValue] of Object.entries(props)) {
            if (propName === "children" || propName === "dangerouslySetInnerHTML") {
                continue;
            }
            voidProps[propName] = propValue;
        }
        return React.createElement(tag, { key: pathKey, ...voidProps });
    }
    const children = node.children.map((childNode, index) => renderNode(childNode, `${pathKey}.${index}`, classMap));
    return React.createElement(tag, { key: pathKey, ...props }, children);
}
export function ImportedDomSnapshotBlockComponent({ block }) {
    const stylesheetImport = React.createElement("style", { key: "imported-snapshot-stylesheet" }, `@import url("${block.stylesheetRef}");`);
    const nodes = block.domJson.children.map((node, index) => renderNode(node, `${index}`, block.classMap));
    return (React.createElement("section", { "data-block-type": block.type, "data-stylesheet-ref": block.stylesheetRef }, [stylesheetImport, ...nodes]));
}
