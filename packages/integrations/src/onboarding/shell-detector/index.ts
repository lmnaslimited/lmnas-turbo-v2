import type { OnboardingShellCandidate } from "@lmnas/contracts";
import { extractAnchors, includesAny, sanitizePreviewHtml } from "../shared/html";

const NAV_TERMS = ["navbar", "navigation", "header", "menu"];
const FOOTER_TERMS = ["footer", "legal", "copyright"];
const ANNOUNCEMENT_TERMS = ["announcement", "topbar", "utility", "notice", "promo"];

function collectTagSegments(html: string, tag: string): string[] {
  return Array.from(html.matchAll(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"))).map((match) => match[0]);
}

function collectCtaLabels(htmlSnippet: string): string[] {
  const anchors = extractAnchors(htmlSnippet);
  return anchors.map((anchor) => anchor.label).slice(0, 4);
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
    })),
    editableFields: ["navItemLabel", "navDestination"],
    ctaLabels: collectCtaLabels(htmlSnippet),
    previewHtml: sanitizePreviewHtml(htmlSnippet)
  };
}

function detectAnnouncementBars(html: string): OnboardingShellCandidate[] {
  const candidates: OnboardingShellCandidate[] = [];
  const matches = Array.from(html.matchAll(/<(div|section|aside)\b[^>]*(class|id)=["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/gi));

  for (let index = 0; index < matches.length; index += 1) {
    const classLike = matches[index][3] ?? "";
    if (!includesAny(classLike, ANNOUNCEMENT_TERMS)) {
      continue;
    }

    candidates.push({
      id: `announcement-candidate-${candidates.length + 1}`,
      type: includesAny(classLike, ["utility"]) ? "utility_bar" : "announcement_bar",
      selectorHint: `<${matches[index][1]} class='${classLike}'>`,
      confidence: 0.66,
      menuItems: [],
      editableFields: ["label", "buttonText", "buttonUrl"],
      ctaLabels: collectCtaLabels(matches[index][0]),
      previewHtml: sanitizePreviewHtml(matches[index][0])
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
    candidates.push(createShellCandidate(`navbar-header-${index + 1}`, "navbar", "<header>", 0.72, segment));
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
      menuItems: [],
      editableFields: ["navItemLabel", "navDestination"],
      ctaLabels: [],
      previewHtml: "<div>No navigation detected</div>"
    });
    candidates.push({
      id: "footer-fallback-1",
      type: "footer",
      selectorHint: "<body>",
      confidence: 0.3,
      menuItems: [],
      editableFields: ["footerLinks", "legalText"],
      ctaLabels: [],
      previewHtml: "<div>No footer detected</div>"
    });
  }

  return candidates;
}
