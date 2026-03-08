import type { ActionBinding, OnboardingActionProposal, OnboardingOverride } from "@lmnas/contracts";

function resolveLocation(action: OnboardingActionProposal): Pick<ActionBinding, "locationType" | "locationId"> {
  if (action.sourceSurface === "block") {
    return {
      locationType: "block",
      locationId: action.sourceItemId ?? "page-root"
    };
  }

  if (action.sourceSurface === "shell") {
    return {
      locationType: "navbar",
      locationId: action.sourceItemId ?? "page-root"
    };
  }

  if (action.sourceSurface === "widget") {
    return {
      locationType: "widget",
      locationId: action.sourceItemId ?? "page-root"
    };
  }

  return {
    locationType: "page",
    locationId: "page-root"
  };
}

function toActionBinding(action: OnboardingActionProposal, overrides?: OnboardingOverride): ActionBinding {
  const actionType = overrides?.actionTypeOverrides[action.id] ?? action.actionType;
  const targetOverride = overrides?.actionTargetOverrides[action.id] ?? {};

  const base = {
    id: `action-binding-${action.id}`,
    label: overrides?.actionLabelOverrides[action.id] ?? action.label,
    actionType,
    ...resolveLocation(action),
    openInNewTab: false
  } satisfies Omit<ActionBinding, "targetUrl" | "targetSectionId" | "widgetId" | "exitId">;

  if (["link_url", "download_asset", "external_booking"].includes(actionType)) {
    return {
      ...base,
      targetUrl: targetOverride.url ?? action.destination.value ?? "/"
    };
  }

  if (actionType === "scroll_to_section") {
    return {
      ...base,
      targetSectionId: targetOverride.sectionId ?? action.destination.value ?? "section-1"
    };
  }

  if (["open_modal", "open_drawer", "open_widget"].includes(actionType)) {
    return {
      ...base,
      widgetId: targetOverride.widgetId ?? action.destination.value ?? "widget_contact_drawer"
    };
  }

  if (["submit_form", "workflow"].includes(actionType)) {
    return {
      ...base,
      exitId: targetOverride.exitId ?? action.suggestedExitId ?? action.destination.value ?? `${action.id}_exit`
    };
  }

  return {
    ...base,
    targetUrl: targetOverride.url ?? action.destination.value ?? "/"
  };
}

export function mapActionsToSchema(actions: OnboardingActionProposal[], overrides?: OnboardingOverride): ActionBinding[] {
  return actions.map((action) => toActionBinding(action, overrides));
}
