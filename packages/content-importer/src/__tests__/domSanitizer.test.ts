import { describe, expect, it } from "vitest";
import { sanitizeDomToJson } from "../import/domSanitizer.js";

describe("sanitizeDomToJson", () => {
  it("strips scripts/style tags/inline handlers and keeps sanitized inline style attributes", () => {
    const html = `
      <div onclick="alert('x')" style="color:red; background-image:url('/hero.png')">
        <script>alert("x")</script>
        <style>.x { color: red; }</style>
        <p>  Hello   World </p>
      </div>
    `;

    const domJson = sanitizeDomToJson(html, "https://example.com/home");
    const rootElement = domJson.children[0];

    expect(rootElement).toMatchObject({
      kind: "element",
      tag: "div"
    });

    if (rootElement?.kind !== "element") {
      throw new Error("Expected root element node");
    }

    expect(rootElement.attributes.onclick).toBeUndefined();
    expect(rootElement.attributes.style).toContain("color: red");
    expect(rootElement.attributes.style).toContain("background-image: url(\"https://example.com/hero.png\")");
    expect(JSON.stringify(domJson)).not.toContain("script");
    expect(JSON.stringify(domJson)).not.toContain(".x { color: red; }");
    expect(JSON.stringify(domJson)).toContain("Hello World");
  });

  it("drops unsafe inline style expressions and javascript urls", () => {
    const html = `<div style="color: red; background-image: url(javascript:alert(1)); width: calc(100% - 1rem);"></div>`;
    const domJson = sanitizeDomToJson(html, "https://example.com");
    const node = domJson.children[0];
    if (node?.kind !== "element") {
      throw new Error("Expected element node");
    }

    expect(node.attributes.style).toContain("color: red");
    expect(node.attributes.style).toContain("width: calc(100% - 1rem)");
    expect(node.attributes.style).not.toContain("javascript:");
  });

  it("normalizes relative URLs and strips hash fragments", () => {
    const html = `
      <a href="/docs/start#section">Docs</a>
      <img src="images/hero.png?size=large#fragment" />
      <a href="javascript:alert('x')">Unsafe</a>
    `;

    const domJson = sanitizeDomToJson(html, "https://Example.com/path/page");
    const [linkNode, imageNode, unsafeLinkNode] = domJson.children;

    expect(linkNode).toMatchObject({
      kind: "element",
      tag: "a",
      attributes: {
        href: "https://example.com/docs/start"
      }
    });

    expect(imageNode).toMatchObject({
      kind: "element",
      tag: "img",
      attributes: {
        src: "https://example.com/path/images/hero.png?size=large"
      }
    });

    if (unsafeLinkNode?.kind !== "element") {
      throw new Error("Expected unsafe link node");
    }
    expect(unsafeLinkNode.attributes.href).toBeUndefined();
  });

  it("produces deterministic output for identical input", () => {
    const html = `<section><p data-x="1">Hello</p><p>World</p></section>`;
    const sourceUrl = "https://example.com/base/path";

    const firstPass = sanitizeDomToJson(html, sourceUrl);
    const secondPass = sanitizeDomToJson(html, sourceUrl);

    expect(secondPass).toEqual(firstPass);
    expect(JSON.stringify(secondPass)).toBe(JSON.stringify(firstPass));
  });
});
