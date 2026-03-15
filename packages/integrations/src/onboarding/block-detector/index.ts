import type { CanonicalBlockFamily, OnboardingBlockProposal } from "@lmnas/contracts";
import { extractAnchors, extractSections, includesAny, stripTags } from "../shared/html";

type FamilyRule = {
  family: CanonicalBlockFamily;
  terms: string[];
};

const FAMILY_RULES: FamilyRule[] = [
  { family: "hero", terms: ["hero", "headline", "above the fold", "h1"] },
  { family: "logo_wall", terms: ["trusted by", "logos", "partners"] },
  { family: "problem_grid", terms: ["problem", "challenge", "pain"] },
  { family: "feature_grid", terms: ["feature", "capability", "what you get"] },
  { family: "testimonial_list", terms: ["testimonial", "customer says", "review"] },
  { family: "stats_band", terms: ["%", "stats", "metrics", "kpi"] },
  { family: "process_steps", terms: ["step", "process", "how it works"] },
  { family: "cta_banner", terms: ["book", "request demo", "get started", "contact sales"] },
  { family: "faq", terms: ["faq", "questions", "accordion"] },
  { family: "rich_text_section", terms: ["paragraph", "article", "overview"] },
  { family: "comparison_table", terms: ["compare", "versus", "comparison", "table"] },
  { family: "pricing_teaser", terms: ["pricing", "plan", "quote"] },
  { family: "contact_strip", terms: ["contact", "reach us", "email", "phone"] },
  { family: "authority_section", terms: ["certified", "authority", "proof"] },
  { family: "case_highlight", terms: ["case study", "highlight", "outcome"] },
  { family: "timeline", terms: ["timeline", "roadmap", "milestone"] },
  { family: "split_content_media", terms: ["image", "video", "media"] },
  { family: "form_section", terms: ["form", "submit", "input"] },
  { family: "embedded_asset_section", terms: ["embed", "iframe", "pdf", "download asset"] }
];

function classifyFamily(segment: string): { family: CanonicalBlockFamily; confidence: number } {
  const normalized = stripTags(segment).toLowerCase();

  let bestMatch: { family: CanonicalBlockFamily; score: number } = {
    family: "rich_text_section",
    score: 0
  };

  for (const rule of FAMILY_RULES) {
    const score = rule.terms.reduce((sum, term) => sum + (includesAny(normalized, [term]) ? 1 : 0), 0);
    if (score > bestMatch.score) {
      bestMatch = {
        family: rule.family,
        score
      };
    }
  }

  if (bestMatch.score === 0) {
    return {
      family: "rich_text_section",
      confidence: 0.42
    };
  }

  return {
    family: bestMatch.family,
    confidence: Math.min(0.95, 0.5 + bestMatch.score * 0.1)
  };
}

function extractCtaLabels(segment: string): string[] {
  return extractAnchors(segment)
    .map((anchor) => anchor.label)
    .slice(0, 6);
}

export function detectBlockProposals(html: string): OnboardingBlockProposal[] {
  const sections = extractSections(html);

  return sections.map((segment, index) => {
    const classification = classifyFamily(segment);
    const blockId = `block-${index + 1}`;

    return {
      id: blockId,
      displayName: `Block ${index + 1}`,
      family: classification.family,
      selectorHint: `section:nth-of-type(${index + 1})`,
      previewSelector: `section:nth-of-type(${index + 1})`,
      confidence: classification.confidence,
      editableFields: [],
      ctaLabels: extractCtaLabels(segment),
      actionIds: [],
      segmentation: "keep",
      rawHtmlSnippet: segment,
      sourceSnippet: segment
    };
  });
}
