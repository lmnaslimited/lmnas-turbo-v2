import type { StudioTheme } from "../../../../platform/onboarding/_lib/studio-types";

export type StudioFigmaValidationToken = {
  expectedTypography: string[];
  requiresDarkMode: boolean;
};

export type StudioFidelityReport = {
  threshold: number;
  hasDarkMediaQuery: boolean;
  darkModeMismatchRatio: number;
  typographyMismatchRatio: number;
  highestMismatchRatio: number;
  exceedsThreshold: boolean;
  sourceFonts: string[];
  themeTypographyFonts: string[];
  figmaTypographyFonts: string[];
};

export const DEFAULT_FIGMA_VALIDATION_TOKEN: StudioFigmaValidationToken = {
  expectedTypography: ["manrope", "inter"],
  requiresDarkMode: true
};

function sanitizeFontToken(value: string): string {
  return value
    .replace(/["']/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function splitFontFamilies(value: string): string[] {
  return value
    .split(",")
    .map((entry) => sanitizeFontToken(entry))
    .filter((entry) => entry.length > 0);
}

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values));
}

function extractSourceTypographyFonts(sourceHtml: string): string[] {
  const matches = sourceHtml.matchAll(/font-family\s*:\s*([^;}{\n]+)/gi);
  const fonts: string[] = [];
  for (const match of matches) {
    const raw = match[1];
    if (!raw) {
      continue;
    }
    fonts.push(...splitFontFamilies(raw));
  }
  return uniqueList(fonts);
}

function extractThemeTypographyFonts(theme: StudioTheme): string[] {
  const fonts = theme.tokens
    .filter((token) => token.category === "typography")
    .flatMap((token) => splitFontFamilies(token.value));
  return uniqueList(fonts);
}

function normalizeTypographyToken(token: StudioFigmaValidationToken): string[] {
  return uniqueList(token.expectedTypography.map((entry) => sanitizeFontToken(entry)).filter((entry) => entry.length > 0));
}

function hasDarkMediaQuery(sourceHtml: string): boolean {
  return /@media\s*\(\s*(?:dark|prefers-color-scheme\s*:\s*dark)\s*\)/i.test(sourceHtml);
}

function computeTypographyMismatch(params: {
  sourceFonts: string[];
  themeFonts: string[];
  figmaFonts: string[];
}): number {
  if (params.figmaFonts.length === 0) {
    return 0;
  }

  const baseline = params.sourceFonts.length > 0 ? params.sourceFonts : params.themeFonts;
  if (baseline.length === 0) {
    return 1;
  }

  const hitCount = params.figmaFonts.filter((font) => baseline.includes(font)).length;
  const coverage = hitCount / params.figmaFonts.length;
  return Number((1 - coverage).toFixed(4));
}

function computeDarkModeMismatch(params: {
  hasDarkMedia: boolean;
  themeDarkMode: boolean;
  tokenRequiresDarkMode: boolean;
}): number {
  const checks: boolean[] = [
    params.hasDarkMedia === params.tokenRequiresDarkMode,
    params.themeDarkMode === params.tokenRequiresDarkMode
  ];
  const mismatchCount = checks.filter((pass) => !pass).length;
  return Number((mismatchCount / checks.length).toFixed(4));
}

function sanitizeThreshold(threshold: number): number {
  if (!Number.isFinite(threshold)) {
    return 0.25;
  }
  if (threshold < 0) {
    return 0;
  }
  if (threshold > 1) {
    return 1;
  }
  return Number(threshold.toFixed(4));
}

export function evaluateStudioFidelity(input: {
  sourceHtml: string;
  activeTheme: StudioTheme;
  threshold: number;
  validationToken?: Partial<StudioFigmaValidationToken> | null;
}): StudioFidelityReport {
  const threshold = sanitizeThreshold(input.threshold);
  const token: StudioFigmaValidationToken = {
    expectedTypography:
      input.validationToken?.expectedTypography && Array.isArray(input.validationToken.expectedTypography)
        ? input.validationToken.expectedTypography.filter((entry): entry is string => typeof entry === "string")
        : DEFAULT_FIGMA_VALIDATION_TOKEN.expectedTypography,
    requiresDarkMode:
      typeof input.validationToken?.requiresDarkMode === "boolean"
        ? input.validationToken.requiresDarkMode
        : DEFAULT_FIGMA_VALIDATION_TOKEN.requiresDarkMode
  };

  const sourceFonts = extractSourceTypographyFonts(input.sourceHtml);
  const themeTypographyFonts = extractThemeTypographyFonts(input.activeTheme);
  const figmaTypographyFonts = normalizeTypographyToken(token);
  const hasDarkMedia = hasDarkMediaQuery(input.sourceHtml);
  const darkModeMismatchRatio = computeDarkModeMismatch({
    hasDarkMedia,
    themeDarkMode: input.activeTheme.darkMode,
    tokenRequiresDarkMode: token.requiresDarkMode
  });
  const typographyMismatchRatio = computeTypographyMismatch({
    sourceFonts,
    themeFonts: themeTypographyFonts,
    figmaFonts: figmaTypographyFonts
  });
  const highestMismatchRatio = Number(Math.max(darkModeMismatchRatio, typographyMismatchRatio).toFixed(4));

  return {
    threshold,
    hasDarkMediaQuery: hasDarkMedia,
    darkModeMismatchRatio,
    typographyMismatchRatio,
    highestMismatchRatio,
    exceedsThreshold: highestMismatchRatio > threshold,
    sourceFonts,
    themeTypographyFonts,
    figmaTypographyFonts
  };
}
