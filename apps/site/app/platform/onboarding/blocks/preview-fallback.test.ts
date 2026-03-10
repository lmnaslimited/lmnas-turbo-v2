import { describe, expect, it } from "vitest";
import { BLOCK_FALLBACK_FRAME_CLASS, injectProjectStyles, withBlockStructuralFallback } from "./preview-fallback";

describe("blocks preview fallback utility", () => {
  it("injects host styles and strips tailwind CDN scripts", () => {
    const sourceHtml = [
      "<html><head>",
      "<script src=\"https://cdn.tailwindcss.com\"></script>",
      "<script id=\"tailwind-config\">window.tailwind={};</script>",
      "</head><body><section class=\"flex\">Body</section></body></html>"
    ].join("");
    const projectStyles = "<style>.lmnas-block-fallback-frame{display:block}</style>";

    const result = injectProjectStyles(sourceHtml, projectStyles);
    expect(result).toContain(projectStyles);
    expect(result).not.toContain("cdn.tailwindcss.com");
    expect(result).not.toContain("tailwind-config");
    expect(result).toContain("<section class=\"flex\">Body</section>");
  });

  it("wraps snippets with structural fallback class", () => {
    const wrapped = withBlockStructuralFallback("<section>Test</section>");
    expect(wrapped).toContain(BLOCK_FALLBACK_FRAME_CLASS);
    expect(wrapped).toContain("<section>Test</section>");
  });
});
