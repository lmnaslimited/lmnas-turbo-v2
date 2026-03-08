import type {
  OnboardingOverride,
  OnboardingWidgetProposal,
  WidgetDefinition,
  WidgetVariant
} from "@lmnas/contracts";

function toSurface(widgetType: OnboardingWidgetProposal["widgetType"]): WidgetVariant["surface"] {
  if (widgetType === "modal" || widgetType === "booking_popup" || widgetType === "subscription_popup") {
    return "modal";
  }

  if (widgetType === "drawer" || widgetType === "chat_launcher") {
    return "drawer";
  }

  if (widgetType === "below_fold_widget") {
    return "below_fold";
  }

  return "inline";
}

export function mapWidgetsToSchema(
  widgetProposals: OnboardingWidgetProposal[],
  overrides?: OnboardingOverride
): { definitions: WidgetDefinition[]; variants: WidgetVariant[] } {
  const definitions = widgetProposals.map((widget) => {
    const mappedId = overrides?.mapToExisting[widget.id] ?? widget.id;

    return {
      id: mappedId,
      name: widget.name,
      widgetType: widget.widgetType,
      state: "active",
      description: `Imported from ${widget.selectorHint}`,
      editableFields: overrides?.fieldOverrides[widget.id] ?? widget.editableFields,
      defaultExitId: widget.widgetType === "booking_popup" ? "book_appointment_primary" : undefined
    } satisfies WidgetDefinition;
  });

  const variants = definitions.map((definition) => ({
    id: `${definition.id}_default`,
    widgetId: definition.id,
    name: `${definition.name} Default`,
    surface: toSurface(definition.widgetType),
    config: {}
  } satisfies WidgetVariant));

  return {
    definitions,
    variants
  };
}
