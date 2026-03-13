import { parseOnboardingIntake, type OnboardingIntake, type OnboardingSourceStyleProfile } from "@lmnas/contracts";
import { buildStyledSourcePreview } from "../preview-renderer";
import { extractTitle } from "../shared/html";

export type IngestedSource = {
  intake: OnboardingIntake;
  sourceRef: string;
  html: string;
  referencePreviewHtml: string;
  productionPreviewHtml: string;
  rawMarkupPreview?: string;
  styleProfile: OnboardingSourceStyleProfile;
  themeScopeClass: string;
  baseUrl?: string;
  title?: string;
};

function isInlineHtml(value: string): boolean {
  return /<\s*[a-z][\s\S]*>/i.test(value);
}

const SOURCE_URL_FETCH_TIMEOUT_MS = 12_000;

async function fetchUrlWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_URL_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Source URL request timed out after ${SOURCE_URL_FETCH_TIMEOUT_MS / 1000}s.`);
    }
    throw new Error(
      `Failed to fetch source URL: ${url}. ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveSourceHtml(intake: OnboardingIntake): Promise<{ sourceRef: string; html: string }> {
  if (intake.sourceType === "raw_html") {
    return {
      sourceRef: "raw-html",
      html: intake.sourceValue
    };
  }

  if (intake.sourceType === "url") {
    const response = await fetchUrlWithTimeout(intake.sourceValue);
    if (!response.ok) {
      throw new Error(`Failed to fetch source URL: ${intake.sourceValue} (${response.status})`);
    }

    return {
      sourceRef: intake.sourceValue,
      html: await response.text()
    };
  }

  if (isInlineHtml(intake.sourceValue)) {
    return {
      sourceRef: `${intake.sourceType}:inline`,
      html: intake.sourceValue
    };
  }

  // Figma/Stitch artifacts can be pasted as structured text; keep deterministic fallback wrapper.
  return {
    sourceRef: `${intake.sourceType}:artifact`,
    html: `<section data-source='${intake.sourceType}'><h1>${intake.slug}</h1><p>${intake.sourceValue}</p></section>`
  };
}

export async function ingestSource(input: unknown): Promise<IngestedSource> {
  const intake = parseOnboardingIntake(input);
  const source = await resolveSourceHtml(intake);
  const title = extractTitle(source.html);
  const styledPreview = buildStyledSourcePreview({
    sourceHtml: source.html,
    sourceRef: source.sourceRef,
    themeKey: intake.themeKey
  });

  return {
    intake,
    sourceRef: source.sourceRef,
    html: source.html,
    referencePreviewHtml: styledPreview.referencePreviewHtml,
    productionPreviewHtml: styledPreview.productionPreviewHtml,
    rawMarkupPreview: styledPreview.rawMarkupPreview,
    styleProfile: styledPreview.styleProfile,
    themeScopeClass: styledPreview.themeScopeClass,
    baseUrl: styledPreview.baseUrl,
    title
  };
}
