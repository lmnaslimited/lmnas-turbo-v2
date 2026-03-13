import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WidgetWorkflowPage from "./page";

describe("widgets workflow shared container mapping", () => {
  it("renders widget workflow with shared list/detail/action containers", () => {
    const html = renderToStaticMarkup(<WidgetWorkflowPage />);
    expect(html).toContain('data-testid="widgets-list-container"');
    expect(html).toContain('data-testid="widgets-detail-container"');
    expect(html).toContain('data-testid="widgets-action-container"');
  });
});
