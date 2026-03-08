import type { OnboardingThemeNotes } from "@lmnas/contracts";

const TOKEN_LIKE_CLASSES = ["bg-", "text-", "border-", "font-", "rounded", "shadow", "px-", "py-", "mx-", "my-"];

function extractClassTokens(html: string): string[] {
  const matches = Array.from(html.matchAll(/class=["']([^"']+)["']/gi));
  const tokens = matches.flatMap((match) => match[1].split(/\s+/g).filter((token) => token.length > 0));
  return tokens;
}

export function analyzeTheme(html: string, themeKey: string): OnboardingThemeNotes {
  const classTokens = extractClassTokens(html);
  const arbitraryValueCount = classTokens.filter((token) => token.includes("[") && token.includes("]")).length;

  const tokenLikeCount = classTokens.filter((token) => TOKEN_LIKE_CLASSES.some((prefix) => token.startsWith(prefix))).length;
  const tokenFirstMatchRatio = classTokens.length === 0 ? 0.5 : Math.min(1, tokenLikeCount / classTokens.length);

  let themeDebtSummary = "Token-first mapping is healthy.";
  if (arbitraryValueCount > 0) {
    themeDebtSummary = `${arbitraryValueCount} arbitrary class values detected; convert to platform tokens where possible.`;
  }

  return {
    themeKey,
    tokenFirstMatchRatio,
    arbitraryValueCount,
    themeDebtSummary
  };
}
