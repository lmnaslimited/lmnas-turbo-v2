import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import UnifiedStudioRecoveryPage from "./page";

describe("unified studio recovery container mapping", () => {
  it("renders shared list/detail/action containers for H-007 flow", () => {
    const html = renderToStaticMarkup(<UnifiedStudioRecoveryPage />);
    expect(html).toContain('data-testid="h007-step-list-container"');
    expect(html).toContain('data-testid="h007-detail-container"');
    expect(html).toContain('data-testid="h007-action-container"');
    expect(html).toContain('data-testid="h007-evidence-container"');
  });
});
