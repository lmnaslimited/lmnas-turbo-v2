import type { OnboardingBlockProposal } from "@lmnas/contracts";
import { extractSections } from "../shared/html";

export type AssemblyPreviewModel = {
  sourceSectionCount: number;
  mappedBlockCount: number;
  structuralMatchRatio: number;
};

export function renderAssemblyPreviewModel(sourceHtml: string, blocks: OnboardingBlockProposal[]): AssemblyPreviewModel {
  const sourceSectionCount = extractSections(sourceHtml).length;
  const mappedBlockCount = blocks.length;
  const structuralMatchRatio = sourceSectionCount === 0 ? 0 : Math.min(1, mappedBlockCount / sourceSectionCount);

  return {
    sourceSectionCount,
    mappedBlockCount,
    structuralMatchRatio
  };
}
