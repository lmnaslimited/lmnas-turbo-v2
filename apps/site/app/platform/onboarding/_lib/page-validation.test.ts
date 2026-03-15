import { describe, expect, it } from "vitest";
import type { StudioPageDocument } from "./studio-types";
import { evaluatePagePreviewAcceptance, invalidatePageValidationOnEdit } from "./page-validation";

function buildPage(overrides: Partial<StudioPageDocument> = {}): StudioPageDocument {
  return {
    id: "page-1",
    name: "Draft Page 1",
    slug: "draft-page-1",
    locale: "en",
    shellKey: "shell-main",
    themeKey: "default",
    lifecycle: "draft",
    status: "draft",
    blockOrder: ["block-1"],
    fieldValues: {},
    actionOverrides: {},
    productMapping: "lens-ai-revenue-platform",
    industryMapping: ["enterprise"],
    primaryCta: { text: "Read Customer Stories", url: "/contact" },
    conversionConfig: { trackConversions: true, strategy: "Track Conversions", valuePoints: 10 },
    campaignUtmStrategy: { source: "lmnas", medium: "studio", campaign: "transformercorp-testimonials" },
    taxonomyState: { valid: true, tags: ["enterprise"] },
    seoMetadata: { metaTitle: "Meta title", metaDescription: "Meta description" },
    seoJsonLdValid: true,
    blockSchemaValid: true,
    previewValid: true,
    updatedAt: "2026-03-13",
    ...overrides
  };
}

describe("page validation workflow", () => {
  it("invalidates preview and seo acceptance when the page changes", () => {
    const previous = buildPage();
    const next = buildPage({ productMapping: "updated-product" });

    expect(invalidatePageValidationOnEdit(previous, next)).toMatchObject({
      previewValid: false,
      seoJsonLdValid: false
    });
  });

  it("keeps acceptance flags when no preview-relevant fields changed", () => {
    const previous = buildPage();
    const next = buildPage({ updatedAt: "2026-03-14" });

    expect(invalidatePageValidationOnEdit(previous, next)).toMatchObject({
      previewValid: true,
      seoJsonLdValid: true
    });
  });

  it("marks preview valid and seo valid when preview html and seo metadata are complete", () => {
    const evaluation = evaluatePagePreviewAcceptance(buildPage());

    expect(evaluation.previewValid).toBe(true);
    expect(evaluation.seoJsonLdValid).toBe(true);
    expect(evaluation.previewIssues).toEqual([]);
    expect(evaluation.seoIssues).toEqual([]);
  });

  it("keeps seo invalid when metadata is incomplete", () => {
    const evaluation = evaluatePagePreviewAcceptance(buildPage({ seoMetadata: { metaTitle: "", metaDescription: "" } }));

    expect(evaluation.previewValid).toBe(true);
    expect(evaluation.seoJsonLdValid).toBe(false);
    expect(evaluation.seoIssues.length).toBe(2);
  });
});
