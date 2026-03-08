import type { OnboardingBlockProposal, OnboardingExitProposal } from "@lmnas/contracts";
import { extractAnchors, slugify, stripTags } from "../shared/html";

const EXIT_LABEL_PATTERNS: Array<{ name: string; match: RegExp }> = [
  { name: "Book Appointment", match: /book\s+(an\s+)?appointment|book\s+consultation/i },
  { name: "Request Demo", match: /request\s+demo|book\s+demo/i },
  { name: "Download Asset", match: /download|brochure|report|asset/i },
  { name: "Contact Sales", match: /contact\s+sales|talk\s+to\s+sales|speak\s+to\s+expert/i },
  { name: "Register for Webinar", match: /webinar|register\s+now|join\s+event/i },
  { name: "Open Chat", match: /chat|talk\s+now|live\s+support/i },
  { name: "Submit Form", match: /submit|send\s+message|get\s+started/i }
];

function resolveExitName(label: string): string {
  const match = EXIT_LABEL_PATTERNS.find((entry) => entry.match.test(label));
  return match?.name ?? `Action: ${label}`;
}

function resolveExitId(exitName: string): string {
  if (exitName === "Book Appointment") {
    return "book_appointment_primary";
  }
  return slugify(exitName);
}

function buildWorkflowTarget(name: string, href: string) {
  if (/download/i.test(name)) {
    return {
      kind: "url" as const,
      value: href
    };
  }

  if (/chat/i.test(name)) {
    return {
      kind: "chat_drawer" as const,
      value: "chat://open"
    };
  }

  return {
    kind: "n8n_webhook" as const,
    value: `n8n://workflow/${slugify(name)}`
  };
}

function detectButtonActions(html: string): Array<{ label: string; selectorHint: string }> {
  const matches = Array.from(html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi));
  return matches
    .map((match, index) => ({
      label: stripTags(match[1]),
      selectorHint: `button:nth-of-type(${index + 1})`
    }))
    .filter((item) => item.label.length > 0);
}

export function detectExitProposals(html: string, blocks: OnboardingBlockProposal[]): OnboardingExitProposal[] {
  const anchors = extractAnchors(html);
  const buttons = detectButtonActions(html);

  const targetBlockId = blocks[0]?.id ?? "page-root";

  const anchorExits = anchors.map((anchor) => {
    const exitName = resolveExitName(anchor.label);
    const exitId = resolveExitId(exitName);

    return {
      id: exitId,
      name: exitName,
      eventName: `exit_${exitId}_triggered`,
      selectorHint: anchor.selectorHint,
      confidence: 0.86,
      state: "active" as const,
      frontendAdapterType: "redirect" as const,
      backendAdapterType: /download/i.test(exitName) ? ("none" as const) : ("n8n_webhook" as const),
      workflowTarget: buildWorkflowTarget(exitName, anchor.href),
      suggestedBinding: {
        locationType: "block" as const,
        locationId: targetBlockId
      }
    };
  });

  const buttonExits = buttons.map((button) => {
    const exitName = resolveExitName(button.label);
    const exitId = resolveExitId(exitName);

    return {
      id: exitId,
      name: exitName,
      eventName: `exit_${exitId}_triggered`,
      selectorHint: button.selectorHint,
      confidence: 0.7,
      state: "active" as const,
      frontendAdapterType: /chat/i.test(exitName) ? ("chat_drawer" as const) : ("modal" as const),
      backendAdapterType: "n8n_webhook" as const,
      workflowTarget: buildWorkflowTarget(exitName, "#"),
      suggestedBinding: {
        locationType: "block" as const,
        locationId: targetBlockId
      }
    };
  });

  const merged = new Map<string, OnboardingExitProposal>();
  for (const exit of [...anchorExits, ...buttonExits]) {
    if (!merged.has(exit.id)) {
      merged.set(exit.id, exit);
    }
  }

  if (!merged.has("book_appointment_primary")) {
    merged.set("book_appointment_primary", {
      id: "book_appointment_primary",
      name: "Book Appointment",
      eventName: "exit_book_appointment_primary_triggered",
      selectorHint: "fallback:book-appointment",
      confidence: 0.4,
      state: "inactive",
      frontendAdapterType: "redirect",
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

  return Array.from(merged.values());
}
