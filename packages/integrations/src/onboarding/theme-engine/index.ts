import type { OnboardingThemeNotes } from "@lmnas/contracts";

const TOKEN_LIKE_CLASSES = ["bg-", "text-", "border-", "font-", "rounded", "shadow", "px-", "py-", "mx-", "my-"];

function extractClassTokens(html: string): string[] {
  const matches = Array.from(html.matchAll(/class=["']([^"']+)["']/gi));
  const tokens = matches.flatMap((match) => match[1].split(/\s+/g).filter((token) => token.length > 0));
  return tokens;
}

function extractGoogleFonts(html: string): string[] {
  const matches = Array.from(html.matchAll(/family=([^&:]+)/gi));
  return Array.from(new Set(matches.map((m) => m[1].replace(/\+/g, " "))));
}

function extractTailwindColors(html: string): Record<string, string> {
  const configMatch = html.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\})/i);
  if (!configMatch) return {};

  const colors: Record<string, string> = {};
  try {
    const configStr = configMatch[1];
    // Very basic regex-based extraction to avoid full JS evaluation
    const colorsMatch = configStr.match(/colors\s*:\s*\{([\s\S]*?)\}/i);
    if (!colorsMatch) return {};

    const colorLines = colorsMatch[1].match(/["']([^"']+)["']\s*:\s*["']([^"']+)["']/g) || [];
    for (const line of colorLines) {
      const parts = line.split(":");
      const key = parts[0].replace(/["']/g, "").trim();
      const val = parts[1].replace(/["',]/g, "").trim();
      colors[key] = val;
    }
  } catch (e) {
    // Ignore parse errors for visual hints
  }
  return colors;
}

export function analyzeTheme(html: string, themeKey: string): OnboardingThemeNotes {
  const classTokens = extractClassTokens(html);
  const deduplicatedTokens = Array.from(new Set(classTokens));
  const arbitraryValueCount = classTokens.filter((token) => token.includes("[") && token.includes("]")).length;

  const tokenLikeCount = classTokens.filter((token) => TOKEN_LIKE_CLASSES.some((prefix) => token.startsWith(prefix))).length;
  const tokenFirstMatchRatio = classTokens.length === 0 ? 0.5 : Math.min(1, tokenLikeCount / classTokens.length);

  let themeDebtSummary = "Token-first mapping is healthy.";
  if (arbitraryValueCount > 0) {
    themeDebtSummary = `${arbitraryValueCount} arbitrary class values detected; convert to platform tokens where possible.`;
  }

  const hasDarkModeTrigger = /<html[^>]*class=["'][^"']*\bdark\b[^"']*["']/i.test(html) ||
    /<body[^>]*class=["'][^"']*\bdark\b[^"']*["']/i.test(html);

  const extractedFonts = extractGoogleFonts(html);
  const extractedColors = extractTailwindColors(html);

  return {
    themeKey,
    tokenFirstMatchRatio,
    arbitraryValueCount,
    themeDebtSummary,
    hasDarkModeTrigger,
    extractedFonts,
    extractedColors,
    utilityClassUsages: deduplicatedTokens
  };
}
