import React from "react";
import { describe, expect, it } from "vitest";
import { LayoutRegistry } from "./index";

describe("LayoutRegistry", () => {
  it("resolves all required layout keys", () => {
    expect(typeof LayoutRegistry.homeLayout).toBe("function");
    expect(typeof LayoutRegistry.productLayout).toBe("function");
    expect(typeof LayoutRegistry.solutionLayout).toBe("function");
    expect(typeof LayoutRegistry.industryLayout).toBe("function");
    expect(typeof LayoutRegistry.simpleLayout).toBe("function");
  });

  it("builds a shell-aware element tree", () => {
    const element = LayoutRegistry.homeLayout({
      title: "homeLayout",
      shell: {
        mainNavigation: {
          key: "main",
          items: [{ label: "Products", destination: { type: "internal", value: "/products" }, children: [] }]
        },
        footerNavigation: {
          key: "footer",
          items: [{ label: "About", destination: { type: "internal", value: "/about" }, children: [] }]
        }
      },
      children: <section>content</section>
    });

    expect(React.isValidElement(element)).toBe(true);

    const shellFrame = element as React.ReactElement<{ shell?: { mainNavigation?: { items: Array<{ label: string }> } } }>;
    expect(shellFrame.props.shell?.mainNavigation?.items[0]?.label).toBe("Products");
  });
});
