import type {
  FidelityWarning,
  OnboardingActionProposal,
  OnboardingBlockProposal,
  OnboardingShellCandidate,
  OnboardingThemeNotes,
  OnboardingWidgetProposal
} from "@lmnas/contracts";

export function buildFidelityWarnings(params: {
  shellCandidates: OnboardingShellCandidate[];
  blockProposals: OnboardingBlockProposal[];
  widgetProposals: OnboardingWidgetProposal[];
  actionProposals: OnboardingActionProposal[];
  theme: OnboardingThemeNotes;
}): FidelityWarning[] {
  const warnings: FidelityWarning[] = [];

  if (!params.shellCandidates.some((candidate) => candidate.type === "navbar")) {
    warnings.push({
      code: "shell.navbar_missing",
      message: "No navbar candidate detected. Assign a fallback navbar variant before publish.",
      severity: "warning"
    });
  }

  if (!params.shellCandidates.some((candidate) => candidate.type === "footer")) {
    warnings.push({
      code: "shell.footer_missing",
      message: "No footer candidate detected. Assign a fallback footer variant before publish.",
      severity: "warning"
    });
  }

  const lowConfidenceBlocks = params.blockProposals.filter((block) => block.confidence < 0.55);
  if (lowConfidenceBlocks.length > 0) {
    warnings.push({
      code: "blocks.low_confidence",
      message: `${lowConfidenceBlocks.length} block(s) need operator confirmation due to low confidence mapping.`,
      severity: "warning"
    });
  }

  const lowConfidenceWidgets = params.widgetProposals.filter((widget) => widget.confidence < 0.6);
  if (lowConfidenceWidgets.length > 0) {
    warnings.push({
      code: "widgets.low_confidence",
      message: `${lowConfidenceWidgets.length} widget candidate(s) need confirmation before publish.`,
      severity: "warning"
    });
  }

  const workflowActions = params.actionProposals.filter((action) => action.actionType === "workflow");
  if (workflowActions.length > 0) {
    warnings.push({
      code: "actions.workflow_review",
      message: `${workflowActions.length} CTA action(s) require workflow mapping review.`,
      severity: "info"
    });
  }

  if (params.theme.arbitraryValueCount > 0) {
    warnings.push({
      code: "theme.arbitrary_values",
      message: params.theme.themeDebtSummary,
      severity: "info"
    });
  }

  return warnings;
}
