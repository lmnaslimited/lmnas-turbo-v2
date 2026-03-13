export const STRICT_CONFIDENCE_THRESHOLD = 0.85;

export type ConfidenceInput = {
  recognizedNodes: number;
  totalNodes: number;
  mappedStyleDeclarations: number;
  totalStyleDeclarations: number;
  unsupportedSelectorCount: number;
  strippedInlineStyleCount: number;
};

export type ConfidenceMetrics = {
  recognizedNodeRatio: number;
  mappedStyleRatio: number;
  unsupportedSelectorPenalty: number;
  inlineStylePenalty: number;
};

export type SectionMode = "strict" | "snapshot";

export type SectionDecision = {
  sectionKey: string;
  mode: SectionMode;
  confidence: number;
  metrics: ConfidenceMetrics;
};

export function computeConfidenceMetrics(input: ConfidenceInput): ConfidenceMetrics {
  const recognizedNodeRatio = safeRatio(input.recognizedNodes, input.totalNodes);
  const mappedStyleRatio = safeRatio(input.mappedStyleDeclarations, input.totalStyleDeclarations);
  const unsupportedSelectorPenalty = Math.min(0.15, Math.max(0, input.unsupportedSelectorCount) * 0.01);
  const inlineStylePenalty = Math.min(0.15, Math.max(0, input.strippedInlineStyleCount) * 0.005);

  return {
    recognizedNodeRatio,
    mappedStyleRatio,
    unsupportedSelectorPenalty,
    inlineStylePenalty
  };
}

export function computeConfidenceScore(metrics: ConfidenceMetrics): number {
  const raw =
    0.6 * metrics.recognizedNodeRatio +
    0.4 * metrics.mappedStyleRatio -
    metrics.unsupportedSelectorPenalty -
    metrics.inlineStylePenalty;

  return clamp01(raw);
}

export function decideSectionMode(sectionKey: string, input: ConfidenceInput): SectionDecision {
  const metrics = computeConfidenceMetrics(input);
  const confidence = Number(computeConfidenceScore(metrics).toFixed(6));

  return {
    sectionKey,
    mode: confidence >= STRICT_CONFIDENCE_THRESHOLD ? "strict" : "snapshot",
    confidence,
    metrics: {
      recognizedNodeRatio: Number(metrics.recognizedNodeRatio.toFixed(6)),
      mappedStyleRatio: Number(metrics.mappedStyleRatio.toFixed(6)),
      unsupportedSelectorPenalty: Number(metrics.unsupportedSelectorPenalty.toFixed(6)),
      inlineStylePenalty: Number(metrics.inlineStylePenalty.toFixed(6))
    }
  };
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 1;
  }
  return clamp01(numerator / denominator);
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
