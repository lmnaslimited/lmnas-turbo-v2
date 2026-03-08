import type { OnboardingBlockProposal, OnboardingOverride } from "@lmnas/contracts";

export function mapBlocksToSchema(
  blockProposals: OnboardingBlockProposal[],
  overrides?: OnboardingOverride
): OnboardingBlockProposal[] {
  return blockProposals.map((block) => {
    const overriddenFamily = overrides?.blockFamilyOverrides[block.id];

    return {
      ...block,
      family: overriddenFamily ?? block.family
    };
  });
}
