import type { OnboardingBlockProposal } from "@lmnas/contracts";

const FIELD_PATTERNS: Array<{ field: string; pattern: RegExp }> = [
  { field: "eyebrow", pattern: /<\s*(small|span)\b[^>]*>/i },
  { field: "heading", pattern: /<h[1-3]\b[^>]*>/i },
  { field: "subheading", pattern: /<h[4-6]\b[^>]*>|<p\b[^>]*>/i },
  { field: "richText", pattern: /<p\b[^>]*>/i },
  { field: "buttonText", pattern: /<a\b[^>]*>|<button\b[^>]*>/i },
  { field: "buttonUrl", pattern: /href=["'][^"']+["']/i },
  { field: "image", pattern: /<img\b[^>]*src=/i },
  { field: "icon", pattern: /icon|svg/i },
  { field: "items", pattern: /<li\b[^>]*>/i },
  { field: "stats", pattern: /\d+\s*[%+x]/i },
  { field: "faqItems", pattern: /question|faq|accordion/i }
];

function deriveFieldsFromSnippet(snippet: string | undefined): string[] {
  if (!snippet) {
    return [];
  }

  const fields = FIELD_PATTERNS.filter((entry) => entry.pattern.test(snippet)).map((entry) => entry.field);
  return Array.from(new Set(fields));
}

export function detectEditableFields(blocks: OnboardingBlockProposal[]): OnboardingBlockProposal[] {
  return blocks.map((block) => {
    const detected = deriveFieldsFromSnippet(block.rawHtmlSnippet);
    return {
      ...block,
      editableFields: detected.length > 0 ? detected : ["heading", "richText"]
    };
  });
}
