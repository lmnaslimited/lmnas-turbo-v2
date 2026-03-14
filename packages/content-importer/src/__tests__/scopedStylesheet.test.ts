import { describe, expect, it } from "vitest";
import { generateScopedStylesheet, generateWrapperId, scopeCssText } from "../import/scopedStylesheet.js";

const domJson = {
  kind: "root" as const,
  children: [
    {
      kind: "element" as const,
      tag: "div",
      attributes: { class: "hero" },
      children: [
        {
          kind: "element" as const,
          tag: "h1",
          attributes: {},
          children: [{ kind: "text" as const, text: "Heading" }]
        }
      ]
    }
  ]
};

describe("scopedStylesheet", () => {
  it("builds deterministic wrapper id from domJson/classMap/themeKey", () => {
    const classMap = {
      "0": "hero",
      "0.0": "text-2xl"
    };

    const first = generateWrapperId({ domJson, classMap, themeKey: "default" });
    const second = generateWrapperId({ domJson, classMap, themeKey: "default" });

    expect(first).toBe(second);
    expect(first).toMatch(/^imported-[a-f0-9]{12}$/);
  });

  it("scopes selectors with strict #imported-<hash> wrapper under @layer components", () => {
    const scoped = generateScopedStylesheet({
      domJson,
      classMap: { "0": "hero" },
      cssText: ".hero { color: red; } h1, h2 { font-weight: 700; }",
      themeKey: "default"
    });

    expect(scoped.stylesheetRef).toMatch(/^\/generated\/imported\/imported-[a-f0-9]{12}\.css$/);
    expect(scoped.css).toContain("@layer components {");
    expect(scoped.css).toContain(`#${scoped.wrapperId} .hero { color: red; }`);
    expect(scoped.css).toContain(`#${scoped.wrapperId} h1, #${scoped.wrapperId} h2 { font-weight: 700; }`);
  });

  it("returns stable empty layer when no CSS rules exist", () => {
    expect(scopeCssText("", "imported-deadbeef0001")).toBe("@layer components {\n}\n");
  });
});
