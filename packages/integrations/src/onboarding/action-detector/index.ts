import type {
  ActionType,
  OnboardingActionProposal,
  OnboardingBlockProposal,
  OnboardingShellCandidate,
  OnboardingWidgetProposal
} from "@lmnas/contracts";
import { extractAnchors, extractButtons, includesAny, slugify } from "../shared/html";

function resolveSourceSurface(params: {
  selectorHint: string;
  label: string;
  blocks: OnboardingBlockProposal[];
  shells: OnboardingShellCandidate[];
}): { sourceSurface: OnboardingActionProposal["sourceSurface"]; sourceItemId?: string } {
  const block = params.blocks.find((candidate) => (candidate.rawHtmlSnippet ?? "").includes(params.label));
  if (block) {
    return {
      sourceSurface: "block",
      sourceItemId: block.id
    };
  }

  const shell = params.shells.find((candidate) => candidate.selectorHint === "<nav>" || candidate.type === "navbar");
  if (shell && params.selectorHint.startsWith("a[")) {
    return {
      sourceSurface: "shell",
      sourceItemId: shell.id
    };
  }

  return {
    sourceSurface: "unknown"
  };
}

function findRelatedWidgetId(label: string, widgets: OnboardingWidgetProposal[]): string | undefined {
  const matchingWidget = widgets.find(
    (widget) => includesAny(label, [widget.name, widget.widgetType.replaceAll("_", " ")]) || widget.triggerLabels.some((trigger) => includesAny(label, [trigger]))
  );

  return matchingWidget?.id;
}

function classifyAction(params: {
  label: string;
  href?: string;
  buttonType?: string;
  widgets: OnboardingWidgetProposal[];
}): {
  actionType: ActionType;
  destination: OnboardingActionProposal["destination"];
  suggestedExitId?: string;
  summary: string;
} {
  const normalizedLabel = params.label.toLowerCase();
  const href = params.href ?? "";
  const widgetId = findRelatedWidgetId(params.label, params.widgets);

  if (href.startsWith("#") && href.length > 1) {
    return {
      actionType: "scroll_to_section",
      destination: { kind: "section", value: href.slice(1) },
      summary: `Scroll to section ${href}`
    };
  }

  if (params.buttonType === "submit" || includesAny(normalizedLabel, ["submit", "send", "register"])) {
    return {
      actionType: "submit_form",
      destination: { kind: "exit", value: `${slugify(params.label)}_submission` },
      suggestedExitId: `${slugify(params.label)}_submission`,
      summary: "Submit form and trigger governed workflow"
    };
  }

  if (includesAny(normalizedLabel, ["book appointment", "book demo", "schedule", "consultation"])) {
    const bookingWidgetId = widgetId ?? "booking_popup_primary";
    return {
      actionType: "open_widget",
      destination: { kind: "widget", value: bookingWidgetId },
      suggestedExitId: "book_appointment_primary",
      summary: "Open booking widget"
    };
  }

  if (includesAny(normalizedLabel, ["download", "brochure", "report", "asset"])) {
    const target = href && href !== "#" ? href : "/assets/download";
    return {
      actionType: "download_asset",
      destination: { kind: "url", value: target },
      suggestedExitId: `${slugify(params.label)}_capture`,
      summary: "Download gated asset"
    };
  }

  if (includesAny(normalizedLabel, ["chat", "help", "support"])) {
    const chatWidgetId = widgetId ?? "chat_launcher_primary";
    return {
      actionType: "open_widget",
      destination: { kind: "widget", value: chatWidgetId },
      suggestedExitId: "open_chat_primary",
      summary: "Open chat launcher"
    };
  }

  if (/calendly|hubspot|meet\.google\.com/i.test(href)) {
    return {
      actionType: "external_booking",
      destination: { kind: "url", value: href },
      suggestedExitId: `${slugify(params.label)}_external`,
      summary: "Open external booking system"
    };
  }

  if (href.startsWith("http")) {
    return {
      actionType: "link_url",
      destination: { kind: "url", value: href },
      summary: "Navigate to external URL"
    };
  }

  if (href.startsWith("/") || href.length > 0) {
    return {
      actionType: "link_url",
      destination: { kind: "url", value: href },
      summary: "Navigate to page/URL"
    };
  }

  if (widgetId) {
    return {
      actionType: "open_widget",
      destination: { kind: "widget", value: widgetId },
      summary: "Open widget"
    };
  }

  return {
    actionType: "workflow",
    destination: { kind: "exit", value: `${slugify(params.label)}_workflow` },
    suggestedExitId: `${slugify(params.label)}_workflow`,
    summary: "Trigger backend workflow"
  };
}

export function detectActionProposals(params: {
  html: string;
  blocks: OnboardingBlockProposal[];
  shells: OnboardingShellCandidate[];
  widgets: OnboardingWidgetProposal[];
}): OnboardingActionProposal[] {
  const anchors = extractAnchors(params.html);
  const buttons = extractButtons(params.html);

  const actions = new Map<string, OnboardingActionProposal>();

  anchors.forEach((anchor) => {
    const id = `action_${slugify(anchor.label)}_${slugify(anchor.href) || "link"}`;
    if (actions.has(id)) {
      return;
    }

    const classification = classifyAction({ label: anchor.label, href: anchor.href, widgets: params.widgets });
    const source = resolveSourceSurface({
      selectorHint: anchor.selectorHint,
      label: anchor.label,
      blocks: params.blocks,
      shells: params.shells
    });

    actions.set(id, {
      id,
      label: anchor.label,
      selectorHint: anchor.selectorHint,
      confidence: 0.86,
      actionType: classification.actionType,
      sourceSurface: source.sourceSurface,
      sourceItemId: source.sourceItemId,
      destination: classification.destination,
      suggestedExitId: classification.suggestedExitId,
      summary: classification.summary,
      previewHtml: `<a href='${anchor.href}'>${anchor.label}</a>`
    });
  });

  buttons.forEach((button) => {
    const id = `action_${slugify(button.label)}_${button.type}`;
    if (actions.has(id)) {
      return;
    }

    const classification = classifyAction({ label: button.label, buttonType: button.type, widgets: params.widgets });
    const source = resolveSourceSurface({
      selectorHint: button.selectorHint,
      label: button.label,
      blocks: params.blocks,
      shells: params.shells
    });

    actions.set(id, {
      id,
      label: button.label,
      selectorHint: button.selectorHint,
      confidence: 0.76,
      actionType: classification.actionType,
      sourceSurface: source.sourceSurface,
      sourceItemId: source.sourceItemId,
      destination: classification.destination,
      suggestedExitId: classification.suggestedExitId,
      summary: classification.summary,
      previewHtml: `<button type='${button.type}'>${button.label}</button>`
    });
  });

  if (actions.size === 0) {
    actions.set("action_book_appointment_primary", {
      id: "action_book_appointment_primary",
      label: "Book Appointment",
      selectorHint: "fallback:primary-cta",
      confidence: 0.4,
      actionType: "open_widget",
      sourceSurface: "unknown",
      destination: {
        kind: "widget",
        value: "booking_popup_primary"
      },
      suggestedExitId: "book_appointment_primary",
      summary: "Open booking widget",
      previewHtml: "<button>Book Appointment</button>"
    });
  }

  return Array.from(actions.values());
}
