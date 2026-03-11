import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PagesWorkflowPage from "./page";

describe("pages workflow shared container mapping", () => {
  it("renders page workflow with shared list/detail/action containers", () => {
    const html = renderToStaticMarkup(<PagesWorkflowPage />);
    expect(html).toContain('data-testid="pages-list-container"');
    expect(html).toContain('data-testid="pages-detail-container"');
    expect(html).toContain('data-testid="pages-action-container"');
  });
});
