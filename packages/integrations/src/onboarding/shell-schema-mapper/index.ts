import type {
  NavigationMenu,
  NavbarVariant,
  FooterVariant,
  OnboardingShellCandidate,
  OnboardingOverride,
  ShellAssignment,
  ShellVariant
} from "@lmnas/contracts";

export type ShellSchemaMapResult = {
  menus: NavigationMenu[];
  navbarVariants: NavbarVariant[];
  footerVariants: FooterVariant[];
  shellVariants: ShellVariant[];
  shellAssignment: ShellAssignment;
};

function pickPrimaryCandidate(candidates: OnboardingShellCandidate[], type: OnboardingShellCandidate["type"]) {
  return candidates.filter((candidate) => candidate.type === type).sort((a, b) => b.confidence - a.confidence)[0];
}

export function mapShellCandidatesToSchema(params: {
  slug: string;
  shellCandidates: OnboardingShellCandidate[];
  overrides?: OnboardingOverride;
}): ShellSchemaMapResult {
  const navbarCandidate = pickPrimaryCandidate(params.shellCandidates, "navbar");
  const footerCandidate = pickPrimaryCandidate(params.shellCandidates, "footer");
  const navbarMappedId = navbarCandidate ? params.overrides?.mapToExisting[navbarCandidate.id] : undefined;
  const footerMappedId = footerCandidate ? params.overrides?.mapToExisting[footerCandidate.id] : undefined;

  const menuId = `menu-${params.slug}`;
  const footerMenuId = `footer-menu-${params.slug}`;
  const navbarVariantId = params.overrides?.navbarVariantId ?? navbarMappedId ?? `navbar-${params.slug}`;
  const footerVariantId = params.overrides?.footerVariantId ?? footerMappedId ?? `footer-${params.slug}`;
  const shellVariantId = params.overrides?.shellVariantId ?? `shell-${params.slug}`;

  const menus: NavigationMenu[] = [
    {
      id: menuId,
      name: `Primary menu for ${params.slug}`,
      items: navbarCandidate?.menuItems ?? [],
      groups: []
    },
    {
      id: footerMenuId,
      name: `Footer menu for ${params.slug}`,
      items: footerCandidate?.menuItems ?? [],
      groups: []
    }
  ];

  const navbarVariants: NavbarVariant[] = [
    {
      id: navbarVariantId,
      name: "Imported Navbar",
      menuId,
      sticky: true,
      mobileBehavior: "drawer",
      ctaSlotLabel: "Primary CTA",
      utilityBarEnabled: params.shellCandidates.some((candidate) => candidate.type === "utility_bar")
    }
  ];

  const footerVariants: FooterVariant[] = [
    {
      id: footerVariantId,
      name: "Imported Footer",
      columns: [
        {
          id: `footer-col-${params.slug}`,
          heading: "Links",
          links: footerCandidate?.menuItems ?? []
        }
      ],
      legalStrip: {
        copyrightText: "© LMNAs",
        legalLinks: []
      }
    }
  ];

  const shellVariants: ShellVariant[] = [
    {
      id: shellVariantId,
      name: "Imported Shell",
      navbarVariantId,
      footerVariantId,
      description: "Generated from onboarding shell detector"
    }
  ];

  const shellAssignment: ShellAssignment = {
    scope: "page",
    shellVariantId,
    pageSlug: params.slug,
    navbarVariantId,
    footerVariantId
  };

  return {
    menus,
    navbarVariants,
    footerVariants,
    shellVariants,
    shellAssignment
  };
}
