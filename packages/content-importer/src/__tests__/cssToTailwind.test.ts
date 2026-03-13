import { describe, expect, it } from "vitest";
import { collectSafelistClasses, emitClassMap, mapCssDeclarationsToUtilities, parseInlineStyle } from "../import/cssToTailwind.js";

describe("cssToTailwind", () => {
  it("maps common rules to stable utilities and uses arbitrary utilities only when needed", () => {
    const declarations = {
      color: "#112233",
      "font-size": "16px",
      "font-weight": "700",
      margin: "16px",
      "margin-top": "18px",
      display: "flex"
    };

    const classes = mapCssDeclarationsToUtilities(declarations);
    expect(classes).toEqual(["flex", "font-bold", "m-4", "mt-[18px]", "text-[#112233]", "text-base"]);
  });

  it("emits deterministic classMap ordering for path keys and classes", () => {
    const classMap = emitClassMap([
      {
        path: "0.1",
        declarations: { "font-size": "14px" },
        existingClassName: "zeta alpha"
      },
      {
        path: "0",
        declarations: { padding: "8px", "background-color": "#ffffff" },
        existingClassName: "container"
      }
    ]);

    expect(Object.keys(classMap)).toEqual(["0", "0.1"]);
    expect(classMap["0"]).toBe("bg-[#ffffff] container p-2");
    expect(classMap["0.1"]).toBe("alpha text-sm zeta");
  });

  it("parses inline style text and produces deterministic safelist classes", () => {
    const declarations = parseInlineStyle("margin-top: 16px; color: #123456; display: block;");
    const classMap = emitClassMap([
      { path: "0", declarations, existingClassName: "hero" },
      { path: "0.0", declarations: { "font-size": "16px" }, existingClassName: "hero-title" }
    ]);

    expect(declarations).toEqual({
      "margin-top": "16px",
      color: "#123456",
      display: "block"
    });
    expect(collectSafelistClasses(classMap)).toEqual([
      "block",
      "hero",
      "hero-title",
      "mt-4",
      "text-[#123456]",
      "text-base"
    ]);
  });
});
