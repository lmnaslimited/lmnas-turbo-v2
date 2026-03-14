import { describe, expect, it } from "vitest";

import { sanitizeDomToJson, sanitizeHtmlToSafeMarkup } from "./studio-html-sanitizer";

describe("studioHtmlSanitizer", () => {
  it("removes executable handlers, blocked protocols, and unsafe embeds", () => {
    const html = `
      <section onclick="alert('x')">
        <a href="javascript:alert('x')" target="_blank">Unsafe link</a>
        <img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" />
        <iframe src="https://evil.example" srcdoc="<script>alert(1)</script>"></iframe>
        <div style="color:red; background-image:url(javascript:alert(1)); width:calc(100% - 1rem)">Safe text</div>
      </section>
    `;

    const serialized = sanitizeHtmlToSafeMarkup(html, "https://lmnas.com/en/runtime");

    expect(serialized).not.toContain("onclick");
    expect(serialized).not.toContain("javascript:");
    expect(serialized).not.toContain("data:text/html");
    expect(serialized).not.toContain("iframe");
    expect(serialized).toContain("color: red");
    expect(serialized).toContain("width: calc(100% - 1rem)");
    expect(serialized).toContain("Safe text");
  });

  it("keeps safe relative urls while normalizing and stripping fragments", () => {
    const domJson = sanitizeDomToJson(
      `<a href="/docs/start#section">Docs</a><img src="/hero.png#fragment" srcset="/hero.png 1x, javascript:alert(1) 2x" />`,
      "https://lmnas.com/en/runtime"
    );

    const serialized = JSON.stringify(domJson);

    expect(serialized).toContain("https://lmnas.com/docs/start");
    expect(serialized).toContain("https://lmnas.com/hero.png");
    expect(serialized).not.toContain("#section");
    expect(serialized).not.toContain("#fragment");
    expect(serialized).not.toContain("javascript:");
  });
});
