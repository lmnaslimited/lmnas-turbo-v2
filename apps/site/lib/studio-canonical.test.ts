import { describe, expect, it } from "vitest";
import type { StudioBlockTemplate, StudioPageDocument, StudioTheme } from "../app/platform/onboarding/_lib/studio-types";
import {
  buildCanonicalPageComposition,
  buildStudioThemeCssVariables,
  containsRuntimeArtifacts,
  createCanonicalBlockSnapshot,
  renderCanonicalBlockMarkup,
  themeIsDarkMode
} from "./studio-canonical";

describe("studio canonical model helpers", () => {
  it("creates portable canonical block snapshots without runtime host artifacts", () => {
    const snapshot = createCanonicalBlockSnapshot({
      html: [
        "<main>",
        "<script src=\"http://localhost:3000/_next/static/chunks/app.js\"></script>",
        "<section onclick=\"alert(1)\"><a href=\"javascript:alert(1)\">Bad</a><img src=\"/hero.png\" /></section>",
        "</main>"
      ].join(""),
      sourceUrl: "https://source.example/landing/page",
      themeScopeClass: "theme-sunrise",
      stylesheetRef: "/studio-runtime.css"
    });

    const serialized = JSON.stringify(snapshot);
    expect(snapshot.blockType).toBe("imported_dom_snapshot");
    expect(serialized).not.toContain("localhost");
    expect(serialized).not.toContain("_next/static");
    expect(serialized).not.toContain("<script");
    expect(serialized).not.toContain("javascript:");
    expect(containsRuntimeArtifacts(serialized)).toBe(false);
  });

  it("round-trips canonical page records through export/import without environment rewrites", () => {
    const snapshot = createCanonicalBlockSnapshot({
      html: "<section class=\"hero\"><h1>Portable Hero</h1><img src=\"/hero.png\" /></section>",
      sourceUrl: "https://source.example/landing/page",
      themeScopeClass: "theme-sunrise",
      stylesheetRef: "/studio-runtime.css"
    });

    const block: StudioBlockTemplate = {
      id: "block-hero",
      key: "block-hero",
      name: "Portable Hero",
      blockType: snapshot.blockType,
      family: "hero",
      status: "active",
      lifecycle: "draft",
      scope: "global",
      schemaStatus: "valid",
      themeKey: "sunrise",
      sourceType: "import",
      sourceRef: "https://source.example/landing/page",
      domJson: snapshot.domJson,
      classMap: snapshot.classMap,
      stylesheetRef: snapshot.stylesheetRef,
      confidence: 0.91,
      editableFields: [],
      actions: [],
      previewHtml: "",
      inUseCount: 0,
      usageCount: 0,
      createdAt: "2026-03-14",
      updatedAt: "2026-03-14"
    };
    const page: StudioPageDocument = {
      id: "page-landing",
      name: "Landing",
      slug: "landing",
      locale: "en",
      shellKey: undefined,
      themeKey: "sunrise",
      lifecycle: "draft",
      status: "draft",
      blockOrder: ["block-hero"],
      fieldValues: {},
      actionOverrides: {},
      productMapping: "lens-ai",
      industryMapping: ["enterprise"],
      primaryCta: {
        text: "Book Demo",
        url: "/contact"
      },
      conversionConfig: {
        trackConversions: true,
        strategy: "Track Conversions",
        valuePoints: 10
      },
      campaignUtmStrategy: {
        source: "lmnas",
        medium: "studio",
        campaign: "landing"
      },
      taxonomyState: {
        valid: true,
        tags: ["enterprise"]
      },
      seoMetadata: {
        metaTitle: "Landing",
        metaDescription: "Landing"
      },
      seoJsonLdValid: true,
      blockSchemaValid: true,
      previewValid: true,
      previewHtml: "",
      updatedAt: "2026-03-14"
    };
    const theme: StudioTheme = {
      id: "theme-sunrise",
      themeKey: "sunrise",
      name: "Sunrise",
      status: "active",
      sourceRef: "figma://sunrise",
      themeScopeClass: "theme-sunrise",
      themeMode: "dark",
      createdAt: "2026-03-14",
      updatedAt: "2026-03-14",
      tokenCoverage: 0.95,
      themeDebt: "1 alias pending",
      darkMode: true,
      tokens: [
        {
          key: "primary",
          label: "Primary",
          category: "color",
          value: "#ff4f00",
          cssVariable: "--color-primary",
          mapped: true
        }
      ]
    };
    const settings = {
      fidelity: {
        mode: "allow-below-threshold" as const,
        threshold: 0.25
      }
    };

    const exported = JSON.stringify({
      page,
      blocks: [block],
      theme,
      settings
    });
    expect(exported).not.toContain("localhost");
    expect(exported).not.toContain("_next/static");
    expect(exported).not.toContain("<script");

    const imported = JSON.parse(exported) as {
      page: StudioPageDocument;
      blocks: StudioBlockTemplate[];
      theme: StudioTheme;
    };
    const composition = buildCanonicalPageComposition({
      page: imported.page,
      blocks: imported.blocks,
      sourceUrl: "https://site.example/en/landing"
    });
    const renderModel = renderCanonicalBlockMarkup(imported.blocks[0]);

    expect(composition.bodyHtml).toContain("Portable Hero");
    expect(composition.stylesheetRefs).toEqual(["/studio-runtime.css"]);
    expect(renderModel.bodyHtml).toContain("https://source.example/hero.png");
    expect(themeIsDarkMode(imported.theme)).toBe(true);
    expect(buildStudioThemeCssVariables(imported.theme)).toMatchObject({
      "--theme-primary": "#ff4f00"
    });
  });
});
