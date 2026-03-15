import type { OnboardingWidgetProposal, WidgetType } from "@lmnas/contracts";
import { extractAnchors, extractButtons, includesAny, slugify } from "../shared/html";

const WIDGET_RULES: Array<{ type: WidgetType; terms: string[]; confidence: number; defaultName: string }> = [
  {
    type: "modal",
    terms: ["modal", "popup", "dialog"],
    confidence: 0.82,
    defaultName: "Modal Widget"
  },
  {
    type: "drawer",
    terms: ["drawer", "slide", "offcanvas"],
    confidence: 0.82,
    defaultName: "Drawer Widget"
  },
  {
    type: "embedded_form",
    terms: ["form", "input", "textarea"],
    confidence: 0.78,
    defaultName: "Embedded Form"
  },
  {
    type: "subscription_popup",
    terms: ["newsletter", "subscribe", "subscription"],
    confidence: 0.86,
    defaultName: "Subscription Popup"
  },
  {
    type: "booking_popup",
    terms: ["book appointment", "book demo", "schedule", "calendly"],
    confidence: 0.9,
    defaultName: "Booking Popup"
  },
  {
    type: "download_gate",
    terms: ["download", "brochure", "report", "asset"],
    confidence: 0.87,
    defaultName: "Download Gate"
  },
  {
    type: "chat_launcher",
    terms: ["chat", "live support", "help"],
    confidence: 0.84,
    defaultName: "Chat Launcher"
  },
  {
    type: "inline_expand_collapse",
    terms: ["accordion", "expand", "collapse", "faq"],
    confidence: 0.74,
    defaultName: "Inline Expand / Collapse"
  },
  {
    type: "below_fold_widget",
    terms: ["below fold", "sticky widget", "assist panel"],
    confidence: 0.6,
    defaultName: "Below Fold Widget"
  }
];

function detectWidgetsFromClassAndId(html: string): OnboardingWidgetProposal[] {
  const candidates = new Map<string, OnboardingWidgetProposal>();
  const segments = Array.from(
    html.matchAll(/<(div|section|aside|form)\b[^>]*(class|id)=["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/gi)
  );

  for (const segment of segments) {
    const classLike = segment[3] ?? "";
    const block = segment[0];

    const rule = WIDGET_RULES.find((entry) => includesAny(classLike, entry.terms));
    if (!rule) {
      continue;
    }

    const id = `${rule.type}_${slugify(classLike)}`;
    if (candidates.has(id)) {
      continue;
    }

    candidates.set(id, {
      id,
      name: rule.defaultName,
      displayName: rule.defaultName,
      widgetType: rule.type,
      selectorHint: `<${segment[1]} class='${classLike}'>`,
      previewSelector:
        segment[2] === "id"
          ? `#${classLike}`
          : classLike
              .split(/\s+/)
              .filter((entry) => entry.length > 0)
              .map((entry) => `.${entry}`)
              .join(""),
      confidence: rule.confidence,
      editableFields: ["heading", "body", "buttonText"],
      triggerLabels: [],
      associatedActionIds: [],
      sourceSnippet: block
    });
  }

  return Array.from(candidates.values());
}

function detectWidgetsFromCallsToAction(html: string): OnboardingWidgetProposal[] {
  const candidates = new Map<string, OnboardingWidgetProposal>();
  const clickables = [
    ...extractAnchors(html).map((anchor) => ({ label: anchor.label, selectorHint: anchor.selectorHint })),
    ...extractButtons(html).map((button) => ({ label: button.label, selectorHint: button.selectorHint }))
  ];

  for (const clickable of clickables) {
    const label = clickable.label;
    const rule = WIDGET_RULES.find((entry) => includesAny(label, entry.terms));
    if (!rule) {
      continue;
    }

    const id = `${rule.type}_${slugify(label)}`;
    if (candidates.has(id)) {
      continue;
    }

    candidates.set(id, {
      id,
      name: rule.defaultName,
      displayName: rule.defaultName,
      widgetType: rule.type,
      selectorHint: clickable.selectorHint,
      previewSelector: clickable.selectorHint,
      confidence: Math.max(0.7, rule.confidence - 0.08),
      editableFields: ["heading", "body", "buttonText"],
      triggerLabels: [label],
      associatedActionIds: [],
      sourceSnippet: clickable.label
    });
  }

  return Array.from(candidates.values());
}

export function detectWidgetProposals(html: string): OnboardingWidgetProposal[] {
  const merged = new Map<string, OnboardingWidgetProposal>();

  for (const widget of [...detectWidgetsFromClassAndId(html), ...detectWidgetsFromCallsToAction(html)]) {
    if (!merged.has(widget.id)) {
      merged.set(widget.id, widget);
    }
  }

  if (merged.size === 0) {
    merged.set("widget_contact_drawer", {
      id: "widget_contact_drawer",
      name: "Contact Drawer",
      displayName: "Contact Drawer",
      widgetType: "drawer",
      selectorHint: "fallback:widget",
      previewSelector: "body",
      confidence: 0.32,
      editableFields: ["heading", "buttonText"],
      triggerLabels: [],
      associatedActionIds: [],
      sourceSnippet: "fallback"
    });
  }

  return Array.from(merged.values());
}
