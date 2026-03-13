import type { OnboardingBlockProposal, OnboardingOverride } from "@lmnas/contracts";

export function mapBlocksToSchema(
  blockProposals: OnboardingBlockProposal[],
  overrides?: OnboardingOverride
): OnboardingBlockProposal[] {
  return blockProposals.map((block) => {
    const overriddenFamily = overrides?.blockFamilyOverrides[block.id];
    const overriddenFields = overrides?.fieldOverrides[block.id];
    const segmentation = overrides?.segmentationOverrides[block.id] ?? block.segmentation;
    const mappedId = overrides?.mapToExisting[block.id] ?? block.id;

    return {
      ...block,
      id: mappedId,
      family: overriddenFamily ?? block.family,
      editableFields: overriddenFields ?? block.editableFields,
      segmentation
    };
  });
}
