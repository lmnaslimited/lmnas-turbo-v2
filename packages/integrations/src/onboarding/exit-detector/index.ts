import type {
  OnboardingActionProposal,
  OnboardingExitProposal,
  OnboardingWidgetProposal,
  WidgetType
} from "@lmnas/contracts";
import { slugify } from "../shared/html";

type ExitShape = Pick<OnboardingExitProposal, "frontendAdapterType" | "backendAdapterType" | "workflowTarget" | "name">;

function resolveExitShape(action: OnboardingActionProposal): ExitShape {
  if (action.actionType === "download_asset") {
    return {
      name: `Download ${action.label}`,
      frontendAdapterType: "redirect",
      backendAdapterType: "none",
      workflowTarget: {
        kind: "url",
        value: action.destination.value ?? "/assets/download"
      }
    };
  }

  if (action.actionType === "external_booking") {
    return {
      name: `External Booking: ${action.label}`,
      frontendAdapterType: "redirect",
      backendAdapterType: "none",
      workflowTarget: {
        kind: "url",
        value: action.destination.value ?? "/book"
      }
    };
  }

  if (action.actionType === "open_widget") {
    return {
      name: action.label,
      frontendAdapterType: "modal",
      backendAdapterType: "n8n_webhook",
      workflowTarget: {
        kind: "n8n_webhook",
        value: `n8n://workflow/${slugify(action.label)}`
      }
    };
  }

  if (action.actionType === "submit_form") {
    return {
      name: `${action.label} Submission`,
      frontendAdapterType: "form",
      backendAdapterType: "n8n_webhook",
      workflowTarget: {
        kind: "n8n_webhook",
        value: `n8n://workflow/${slugify(action.label)}_submission`
      }
    };
  }

  if (action.actionType === "workflow") {
    return {
      name: action.label,
      frontendAdapterType: "none",
      backendAdapterType: "n8n_webhook",
      workflowTarget: {
        kind: "n8n_webhook",
        value: `n8n://workflow/${slugify(action.label)}`
      }
    };
  }

  return {
    name: action.label,
    frontendAdapterType: "none",
    backendAdapterType: "none",
    workflowTarget: {
      kind: "none",
      value: "none"
    }
  };
}

function defaultExitForWidget(widgetType: WidgetType): { id: string; name: string } | null {
  if (widgetType === "booking_popup") {
    return {
      id: "book_appointment_primary",
      name: "Book Appointment"
    };
  }

  if (widgetType === "download_gate") {
    return {
      id: "download_asset_primary",
      name: "Download Asset"
    };
  }

  if (widgetType === "chat_launcher") {
    return {
      id: "open_chat_primary",
      name: "Open Chat"
    };
  }

  return null;
}

export function detectExitProposals(actions: OnboardingActionProposal[], widgets: OnboardingWidgetProposal[]): OnboardingExitProposal[] {
  const proposals = new Map<string, OnboardingExitProposal>();

  for (const action of actions) {
    if (!["workflow", "submit_form", "open_widget", "external_booking", "download_asset"].includes(action.actionType)) {
      continue;
    }

    const exitId = action.suggestedExitId ?? slugify(action.label);
    if (proposals.has(exitId)) {
      continue;
    }

    const shape = resolveExitShape(action);
    proposals.set(exitId, {
      id: exitId,
      name: shape.name,
      eventName: `exit_${exitId}_triggered`,
      selectorHint: action.selectorHint,
      confidence: action.confidence,
      state: "active",
      frontendAdapterType: shape.frontendAdapterType,
      backendAdapterType: shape.backendAdapterType,
      workflowTarget: shape.workflowTarget,
      sourceActionId: action.id,
      suggestedBinding: {
        locationType: action.sourceSurface === "block" ? "block" : action.sourceSurface === "widget" ? "widget" : "page",
        locationId: action.sourceItemId ?? "page-root"
      }
    });
  }

  for (const widget of widgets) {
    const fallback = defaultExitForWidget(widget.widgetType);
    if (!fallback || proposals.has(fallback.id)) {
      continue;
    }

    proposals.set(fallback.id, {
      id: fallback.id,
      name: fallback.name,
      eventName: `exit_${fallback.id}_triggered`,
      selectorHint: widget.selectorHint,
      confidence: Math.max(0.42, widget.confidence - 0.22),
      state: "inactive",
      frontendAdapterType: "modal",
      backendAdapterType: "n8n_webhook",
      workflowTarget: {
        kind: "n8n_webhook",
        value: `n8n://workflow/${fallback.id}`
      },
      suggestedBinding: {
        locationType: "widget",
        locationId: widget.id
      }
    });
  }

  if (!proposals.has("book_appointment_primary")) {
    proposals.set("book_appointment_primary", {
      id: "book_appointment_primary",
      name: "Book Appointment",
      eventName: "exit_book_appointment_primary_triggered",
      selectorHint: "fallback:book-appointment",
      confidence: 0.35,
      state: "inactive",
      frontendAdapterType: "modal",
      backendAdapterType: "n8n_webhook",
      workflowTarget: {
        kind: "n8n_webhook",
        value: "n8n://workflow/book_appointment"
      },
      suggestedBinding: {
        locationType: "page",
        locationId: "page-root"
      }
    });
  }

  return Array.from(proposals.values());
}
