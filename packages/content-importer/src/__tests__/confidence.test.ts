import { describe, expect, it } from "vitest";
import { computeConfidenceMetrics, computeConfidenceScore, decideSectionMode, STRICT_CONFIDENCE_THRESHOLD } from "../import/confidence.js";

describe("import confidence scoring", () => {
  it("computes the exact confidence formula with penalties", () => {
    const metrics = computeConfidenceMetrics({
      recognizedNodes: 8,
      totalNodes: 10,
      mappedStyleDeclarations: 3,
      totalStyleDeclarations: 5,
      unsupportedSelectorCount: 4,
      strippedInlineStyleCount: 6
    });

    expect(metrics).toEqual({
      recognizedNodeRatio: 0.8,
      mappedStyleRatio: 0.6,
      unsupportedSelectorPenalty: 0.04,
      inlineStylePenalty: 0.03
    });

    expect(computeConfidenceScore(metrics)).toBeCloseTo(0.65, 6);
  });

  it("uses strict mode when confidence is on threshold", () => {
    const decision = decideSectionMode("0", {
      recognizedNodes: 85,
      totalNodes: 100,
      mappedStyleDeclarations: 85,
      totalStyleDeclarations: 100,
      unsupportedSelectorCount: 0,
      strippedInlineStyleCount: 0
    });

    expect(decision.confidence).toBe(STRICT_CONFIDENCE_THRESHOLD);
    expect(decision.mode).toBe("strict");
  });

  it("falls back to snapshot when confidence is below threshold", () => {
    const decision = decideSectionMode("0", {
      recognizedNodes: 1,
      totalNodes: 10,
      mappedStyleDeclarations: 0,
      totalStyleDeclarations: 10,
      unsupportedSelectorCount: 5,
      strippedInlineStyleCount: 5
    });

    expect(decision.confidence).toBeLessThan(STRICT_CONFIDENCE_THRESHOLD);
    expect(decision.mode).toBe("snapshot");
  });
});
