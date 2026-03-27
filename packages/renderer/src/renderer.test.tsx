import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageRenderer, renderValidatedBlock } from "./index";

describe("renderer", () => {
  it("renders valid blocks without crashing", () => {
    const html = renderToString(
      <PageRenderer
        blocks={[
          {
            type: "hero",
            heading: "Hello",
            subheading: "World",
            ctaLabel: "Start",
            ctaHref: "/start",
            conversionConfig: {
              intent: "book",
              eventName: "hero_primary_cta_click"
            }
          }
        ]}
      />
    );

    expect(html).toContain("Hello");
    expect(html).toContain("Start");
  });

  it("shows helpful validation error in preview mode", () => {
    const html = renderToString(
      renderValidatedBlock(
        {
          type: "hero",
          heading: "",
          subheading: "Subheading",
          ctaLabel: "Start",
          ctaHref: "/start",
          conversionConfig: {
            intent: "book",
            eventName: "hero_primary_cta_click"
          }
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
            type: "hero",
            heading: "",
            subheading: "Subheading",
            ctaLabel: "Start",
            ctaHref: "/start",
            conversionConfig: {
              intent: "book",
              eventName: "hero_primary_cta_click"
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
