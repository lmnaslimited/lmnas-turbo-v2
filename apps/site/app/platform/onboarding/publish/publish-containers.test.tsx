import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PublishWorkflowPage from "./page";
import { PublishOverlayWorkflow, type PublishOverlayResult } from "./PublishOverlayWorkflow";

const SAMPLE_RESULT: PublishOverlayResult = {
  mode: "apply",
  applied: true,
  blocked: false,
  source: "fallback",
  fidelityMode: "allow-below-threshold",
  warnings: [
    {
      code: "publish.fidelity_dark_media_detected",
      message: "Source includes @media(dark).",
      severity: "info"
    }
  ],
  activeTheme: {
    id: "theme-default",
    themeKey: "default",
    name: "Default",
    darkMode: true,
    status: "active"
  },
  ignoredPreviewSwatchThemeId: null,
  rejectionReason: null,
  fidelity: {
    threshold: 0.25,
    hasDarkMediaQuery: true,
    darkModeMismatchRatio: 0.1,
    typographyMismatchRatio: 0.1,
    highestMismatchRatio: 0.1,
    exceedsThreshold: false
  },
  payload: {
    activeTheme: {
      themeKey: "default"
    }
  },
  persistence: {
    source: "fallback",
    mutated: true,
    themeId: "theme-default"
  }
};

describe("publish/settings container hardening", () => {
  it("renders settings surface with shared workflow containers", () => {
    const html = renderToStaticMarkup(<PublishWorkflowPage />);
    expect(html).toContain("data-testid=\"publish-settings-list-container\"");
    expect(html).toContain("data-testid=\"publish-settings-detail-container\"");
    expect(html).toContain("data-testid=\"publish-settings-action-container\"");
  });

  it("renders publish overlay with shared workflow containers", () => {
    const html = renderToStaticMarkup(
      <PublishOverlayWorkflow isPublishing={false} publishResult={SAMPLE_RESULT} onRunPublish={() => undefined} onClose={() => undefined} />
    );
    expect(html).toContain("data-testid=\"publish-overlay-list-container\"");
    expect(html).toContain("data-testid=\"publish-overlay-detail-container\"");
    expect(html).toContain("data-testid=\"publish-overlay-action-container\"");
    expect(html).toContain("data-testid=\"publish-payload-json\"");
  });
});
