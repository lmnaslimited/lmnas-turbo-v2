import type { OnboardingBlockProposal, PageAssembly, ShellAssignment } from "@lmnas/contracts";

export function assemblePage(params: {
  slug: string;
  locale: string;
  shellAssignment: ShellAssignment;
  blocks: OnboardingBlockProposal[];
}): PageAssembly {
  const navbarVariantId = params.shellAssignment.navbarVariantId ?? "navbar-default";
  const footerVariantId = params.shellAssignment.footerVariantId ?? "footer-default";

  return {
    slug: params.slug,
    locale: params.locale,
    shellAssignment: params.shellAssignment,
    blockOrder: params.blocks.map((block) => block.id),
    navbarVariantId,
    footerVariantId
  };
}
