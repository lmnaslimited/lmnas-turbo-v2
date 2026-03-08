import type { OnboardingShellCandidate } from "@lmnas/contracts";
import { extractAnchors, includesAny } from "../shared/html";

const NAV_TERMS = ["navbar", "navigation", "header", "menu"];
const FOOTER_TERMS = ["footer", "legal", "copyright"];
const ANNOUNCEMENT_TERMS = ["announcement", "topbar", "utility", "notice"];

function collectTagSegments(html: string, tag: string): string[] {
  return Array.from(html.matchAll(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"))).map((match) => match[0]);
}

function createShellCandidate(
  id: string,
  type: OnboardingShellCandidate["type"],
  selectorHint: string,
  confidence: number,
  htmlSnippet: string
): OnboardingShellCandidate {
  const anchors = extractAnchors(htmlSnippet);

  return {
    id,
    type,
    selectorHint,
    confidence,
    menuItems: anchors.map((anchor) => ({
      label: anchor.label,
      destination: {
        type: anchor.href.startsWith("http") ? "external" : "internal",
        value: anchor.href
      },
      children: []
    }))
  };
}

function detectAnnouncementBars(html: string): OnboardingShellCandidate[] {
  const candidates: OnboardingShellCandidate[] = [];
  const attributeMatches = Array.from(html.matchAll(/<(div|section|aside)\b[^>]*(class|id)=["']([^"']+)["'][^>]*>/gi));

  for (let index = 0; index < attributeMatches.length; index += 1) {
    const classLike = attributeMatches[index][3] ?? "";
    if (!includesAny(classLike, ANNOUNCEMENT_TERMS)) {
      continue;
    }

    candidates.push({
      id: `announcement-candidate-${candidates.length + 1}`,
      type: "announcement_bar",
      selectorHint: `<${attributeMatches[index][1]} class='${classLike}'>`,
      confidence: 0.65,
      menuItems: []
    });
  }

  return candidates;
}

export function detectShellCandidates(html: string): OnboardingShellCandidate[] {
  const candidates: OnboardingShellCandidate[] = [];

  const navSegments = collectTagSegments(html, "nav");
  navSegments.forEach((segment, index) => {
    const confidence = includesAny(segment, NAV_TERMS) ? 0.92 : 0.8;
    candidates.push(createShellCandidate(`navbar-candidate-${index + 1}`, "navbar", "<nav>", confidence, segment));
  });

  const headerSegments = collectTagSegments(html, "header").filter((segment) => includesAny(segment, NAV_TERMS));
  headerSegments.forEach((segment, index) => {
    candidates.push(createShellCandidate(`navbar-header-${index + 1}`, "navbar", "<header>", 0.7, segment));
  });

  const footerSegments = collectTagSegments(html, "footer");
  footerSegments.forEach((segment, index) => {
    const confidence = includesAny(segment, FOOTER_TERMS) ? 0.9 : 0.78;
    candidates.push(createShellCandidate(`footer-candidate-${index + 1}`, "footer", "<footer>", confidence, segment));
  });

  candidates.push(...detectAnnouncementBars(html));

  if (candidates.length === 0) {
    candidates.push({
      id: "navbar-fallback-1",
      type: "navbar",
      selectorHint: "<body>",
      confidence: 0.35,
      menuItems: []
    });
    candidates.push({
      id: "footer-fallback-1",
      type: "footer",
      selectorHint: "<body>",
      confidence: 0.3,
      menuItems: []
    });
  }

  return candidates;
}
