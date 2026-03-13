import type { StudioPageDocument } from "./studio-types";

export type PagePreviewAcceptanceResult = {
  previewValid: boolean;
  seoJsonLdValid: boolean;
  previewIssues: string[];
  seoIssues: string[];
};

function normalizeForFingerprint(page: StudioPageDocument) {
  return {
    name: page.name,
    slug: page.slug,
    locale: page.locale,
    activeShellId: page.activeShellId ?? "",
    shellId: page.shellId ?? "",
    shellKey: page.shellKey ?? "",
    themeId: page.themeId ?? "",
    themeKey: page.themeKey ?? "",
    blockOrder: page.blockOrder,
    fieldValues: page.fieldValues,
    actionOverrides: page.actionOverrides,
    productMapping: page.productMapping,
    industryMapping: page.industryMapping,
    primaryCta: page.primaryCta,
    conversionConfig: page.conversionConfig,
    campaignUtmStrategy: page.campaignUtmStrategy,
    taxonomyState: page.taxonomyState,
    seoMetadata: page.seoMetadata,
    previewHtml: page.previewHtml
  };
}

export function pageWorkflowFingerprint(page: StudioPageDocument): string {
  return JSON.stringify(normalizeForFingerprint(page));
}

export function invalidatePageValidationOnEdit(previous: StudioPageDocument, next: StudioPageDocument): StudioPageDocument {
  if (pageWorkflowFingerprint(previous) === pageWorkflowFingerprint(next)) {
    return next;
  }

  return {
    ...next,
    previewValid: false,
    seoJsonLdValid: false
  };
}

export function evaluatePagePreviewAcceptance(page: StudioPageDocument): PagePreviewAcceptanceResult {
  const previewIssues: string[] = [];
  const seoIssues: string[] = [];

  if (page.blockOrder.length === 0) {
    previewIssues.push("Add at least one block to the page before accepting preview.");
  }
  if (page.previewHtml.trim().length === 0) {
    previewIssues.push("Generate the latest draft preview before accepting it.");
  }

  if (page.seoMetadata.metaTitle.trim().length === 0) {
    seoIssues.push("Meta title is required.");
  }
  if (page.seoMetadata.metaDescription.trim().length === 0) {
    seoIssues.push("Meta description is required.");
  }

  return {
    previewValid: previewIssues.length === 0,
    seoJsonLdValid: seoIssues.length === 0,
    previewIssues,
    seoIssues
  };
}
