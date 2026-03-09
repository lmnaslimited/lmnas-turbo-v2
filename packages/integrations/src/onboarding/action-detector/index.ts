import type {
  ActionType,
  OnboardingActionProposal,
  OnboardingBlockProposal,
  OnboardingShellCandidate,
  OnboardingWidgetProposal
} from "@lmnas/contracts";
import { extractAnchors, extractButtons, includesAny, slugify } from "../shared/html";

function resolveSourceSurface(params: {
  snippet: string;
  label: string;
  selectorHint: string;
  blocks: OnboardingBlockProposal[];
  shells: OnboardingShellCandidate[];
  widgets: OnboardingWidgetProposal[];
}): {
  sourceSurface: OnboardingActionProposal["sourceSurface"];
  sourceItemId?: string;
  sourceItemLabel?: string;
} {
  const block = params.blocks.find(
    (candidate) =>
      (candidate.rawHtmlSnippet ?? "").includes(params.snippet) ||
      (candidate.rawHtmlSnippet ?? "").toLowerCase().includes(params.label.toLowerCase())
  );

  if (block) {
    return {
      sourceSurface: "block",
      sourceItemId: block.id,
      sourceItemLabel: block.displayName ?? block.id
    };
  }

  const shell = params.shells.find(
    (candidate) =>
      (candidate.sourceSnippet ?? "").includes(params.snippet) ||
      (candidate.sourceSnippet ?? "").toLowerCase().includes(params.label.toLowerCase())
  );

  if (shell) {
    return {
      sourceSurface: "shell",
      sourceItemId: shell.id,
      sourceItemLabel: shell.displayName ?? shell.id
    };
  }

  const widget = params.widgets.find(
    (candidate) =>
      (candidate.sourceSnippet ?? "").includes(params.snippet) ||
      (candidate.sourceSnippet ?? "").toLowerCase().includes(params.label.toLowerCase()) ||
      candidate.selectorHint === params.selectorHint
  );

  if (widget) {
    return {
      sourceSurface: "widget",
      sourceItemId: widget.id,
      sourceItemLabel: widget.displayName ?? widget.name
    };
  }

  return {
    sourceSurface: "unknown"
  };
}

function findRelatedWidgetId(label: string, widgets: OnboardingWidgetProposal[]): string | undefined {
  const matchingWidget = widgets.find(
    (widget) =>
      includesAny(label, [widget.name, widget.widgetType.replaceAll("_", " ")]) ||
      widget.triggerLabels.some((trigger) => includesAny(label, [trigger]))
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

  anchors.forEach((anchor, index) => {
    const id = `action_${slugify(anchor.label)}_${index + 1}`;
    if (actions.has(id)) {
      return;
    }

    const classification = classifyAction({ label: anchor.label, href: anchor.href, widgets: params.widgets });
    const source = resolveSourceSurface({
      snippet: anchor.htmlSnippet,
      label: anchor.label,
      selectorHint: anchor.selectorHint,
      blocks: params.blocks,
      shells: params.shells,
      widgets: params.widgets
    });

    actions.set(id, {
      id,
      label: anchor.label,
      displayName: anchor.label,
      selectorHint: anchor.selectorHint,
      previewSelector: anchor.selectorHint,
      confidence: 0.86,
      actionType: classification.actionType,
      sourceSurface: source.sourceSurface,
      sourceItemId: source.sourceItemId,
      sourceItemLabel: source.sourceItemLabel,
      ctaKind: "anchor",
      ctaHref: anchor.href,
      destination: classification.destination,
      suggestedExitId: classification.suggestedExitId,
      summary: classification.summary,
      sourceSnippet: anchor.htmlSnippet,
      previewHtml: anchor.htmlSnippet
    });
  });

  buttons.forEach((button, index) => {
    const id = `action_${slugify(button.label)}_${button.type}_${index + 1}`;
    if (actions.has(id)) {
      return;
    }

    const classification = classifyAction({ label: button.label, buttonType: button.type, widgets: params.widgets });
    const source = resolveSourceSurface({
      snippet: button.htmlSnippet,
      label: button.label,
      selectorHint: button.selectorHint,
      blocks: params.blocks,
      shells: params.shells,
      widgets: params.widgets
    });

    actions.set(id, {
      id,
      label: button.label,
      displayName: button.label,
      selectorHint: button.selectorHint,
      previewSelector: button.selectorHint,
      confidence: 0.76,
      actionType: classification.actionType,
      sourceSurface: source.sourceSurface,
      sourceItemId: source.sourceItemId,
      sourceItemLabel: source.sourceItemLabel,
      ctaKind: "button",
      ctaButtonType: button.type,
      destination: classification.destination,
      suggestedExitId: classification.suggestedExitId,
      summary: classification.summary,
      sourceSnippet: button.htmlSnippet,
      previewHtml: button.htmlSnippet
    });
  });

  if (actions.size === 0) {
    actions.set("action_book_appointment_primary", {
      id: "action_book_appointment_primary",
      label: "Book Appointment",
      displayName: "Book Appointment",
      selectorHint: "fallback:primary-cta",
      previewSelector: "body",
      confidence: 0.4,
      actionType: "open_widget",
      sourceSurface: "unknown",
      ctaKind: "unknown",
      destination: {
        kind: "widget",
        value: "booking_popup_primary"
      },
      suggestedExitId: "book_appointment_primary",
      summary: "Open booking widget",
      sourceSnippet: "Book Appointment",
      previewHtml: "<button>Book Appointment</button>"
    });
  }

  return Array.from(actions.values());
}
