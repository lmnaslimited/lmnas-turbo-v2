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
            ctaHref: "/start"
          },
          {
            type: "faq",
            title: "FAQ",
            items: [{ question: "Q1", answer: "A1" }]
          }
        ]}
      />
    );

    expect(html).toContain("Hello");
    expect(html).toContain("FAQ");
  });

  it("shows helpful validation error in preview mode", () => {
    const html = renderToString(
      renderValidatedBlock(
        {
          type: "faq",
          title: "Broken",
          items: [{ question: "", answer: "A" }]
        },
        true
      )
    );

    expect(html).toContain("Invalid block");
    expect(html).toContain("items.0.question");
  });

  it("skips invalid blocks safely in production mode", () => {
    const html = renderToString(
      <PageRenderer
        blocks={[
          {
            type: "faq",
            title: "Broken",
            items: [{ question: "", answer: "A" }]
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
