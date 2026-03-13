import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageRenderer, renderValidatedBlock } from "./index";

const validHeroBlock = {
  type: "hero",
  heading: "Hello",
  subheading: "World",
  productMapping: {
    product: "lens-cpq",
    industry: "complex-manufacturing"
  },
  primaryCta: {
    label: "Start",
    href: "/start",
    exitId: "book_appointment_primary"
  },
  conversionConfig: {
    intent: "book",
    eventName: "hero_primary_cta_click"
  }
} as const;

describe("renderer", () => {
  it("renders valid blocks without crashing", () => {
    const html = renderToString(<PageRenderer blocks={[validHeroBlock]} />);

    expect(html).toContain("Hello");
    expect(html).toContain("Start");
  });

  it("shows helpful validation error in preview mode", () => {
    const html = renderToString(
      renderValidatedBlock(
        {
          ...validHeroBlock,
          heading: ""
        },
        true
      )
    );

    expect(html).toContain("Invalid block");
    expect(html).toContain("heading");
  });

  it("skips invalid blocks safely in production mode", () => {
    const html = renderToString(
      <PageRenderer
        blocks={[
          {
            ...validHeroBlock,
            heading: ""
          }
        ]}
        preview={false}
      />
    );

    expect(html).toContain("was skipped because it is invalid");
  });

  it("skips conversion blocks when governance fields are invalid", () => {
    const html = renderToString(
      <PageRenderer
        blocks={[
          {
            ...validHeroBlock,
            productMapping: {
              product: "",
              industry: ""
            }
          }
        ]}
        preview={false}
      />
    );

    expect(html).toContain("was skipped because it is invalid");
  });

  it("fails fast on unknown block types", () => {
    expect(() =>
      renderValidatedBlock(
        {
          type: "unknown_block",
          title: "Unknown"
        },
        false
      )
    ).toThrowError("Unknown block type: unknown_block");
  });
});
