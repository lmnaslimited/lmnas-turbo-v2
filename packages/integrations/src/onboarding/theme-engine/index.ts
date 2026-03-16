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
  const colors: Record<string, string> = {};
  
  // 1. Precise extraction from tailwind.config
  const configMatch = html.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\})\s*(?:<\/script>|;|$)/i);
  if (configMatch) {
    try {
      const configStr = configMatch[1];
      const colorsMatch = configStr.match(/colors\s*:\s*\{([\s\S]*?)\}/i);
      if (colorsMatch) {
        const colorLines = colorsMatch[1].match(/["']([^"']+)["']\s*:\s*["']([^"']+)["']/g) || [];
        for (const line of colorLines) {
          const parts = line.split(":");
          const key = parts[0].replace(/["']/g, "").trim();
          const val = parts[1].replace(/["',]/g, "").trim();
          colors[key] = val;
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  // 2. Global fallback hex scanner (if nothing found or to supplement)
  if (Object.keys(colors).length === 0) {
    const hexMatches = Array.from(html.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi));
    hexMatches.forEach((match, index) => {
      const val = match[0].toLowerCase();
      // Only keep unique values
      if (!Object.values(colors).includes(val)) {
        colors[`extracted-color-${index + 1}`] = val;
      }
    });
  }

  return colors;
}

function extractTailwindRadii(html: string): Record<string, string> {
  const radii: Record<string, string> = {};
  
  // 1. Precise extraction from tailwind.config
  const configMatch = html.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\})\s*(?:<\/script>|;|$)/i);
  if (configMatch) {
    try {
      const configStr = configMatch[1];
      const radiiMatch = configStr.match(/borderRadius\s*:\s*\{([\s\S]*?)\}/i);
      if (radiiMatch) {
        // Match both "key": "value" and key: "value"
        const radiiLines = radiiMatch[1].match(/["']?([^"':\s]+)["']?\s*:\s*["']([^"']+)["']/g) || [];
        for (const line of radiiLines) {
          const parts = line.split(":");
          const key = parts[0].replace(/["']/g, "").trim();
          const val = parts[1].replace(/["',]/g, "").trim();
          radii[key] = val;
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  // 2. Class-based inference (if nothing found)
  if (Object.keys(radii).length === 0) {
    const classMatches = Array.from(html.matchAll(/class=["']([^"']+)["']/gi));
    const classes = classMatches.flatMap(m => m[1].split(/\s+/));
    const roundedClasses = classes.filter(c => c.startsWith('rounded-'));
    
    // Simplistic mapping for common TW radii if not explicitly defined in config
    if (roundedClasses.includes('rounded-sm')) radii['sm'] = '0.125rem';
    if (roundedClasses.includes('rounded')) radii['DEFAULT'] = '0.25rem';
    if (roundedClasses.includes('rounded-md')) radii['md'] = '0.375rem';
    if (roundedClasses.includes('rounded-lg')) radii['lg'] = '0.5rem';
    if (roundedClasses.includes('rounded-xl')) radii['xl'] = '0.75rem';
    if (roundedClasses.includes('rounded-2xl')) radii['2xl'] = '1rem';
    if (roundedClasses.includes('rounded-3xl')) radii['3xl'] = '1.5rem';
    if (roundedClasses.includes('rounded-full')) radii['full'] = '9999px';
  }

  return radii;
}

export function resolveArbitraryClasses(html: string, tokens: { key: string; value: string }[]): string {
  let resolvedHtml = html;

  // 1. Extract color tokens for lookup (e.g., color.primary -> #135bec)
  const colorMap: Record<string, string> = {};
  tokens.forEach((token) => {
    if (token.key.startsWith("color.")) {
      const name = token.key.replace("color.", "");
      // Normalize both to lowercase for comparison
      colorMap[token.value.toLowerCase()] = name;
    }
  });

  // 2. Resolve arbitrary color classes (e.g., bg-[#135bec] -> bg-primary)
  // We look for patterns like bg-[#...], text-[#...], border-[#...]
  const colorPrefixes = ["bg", "text", "border", "fill", "stroke"];
  
  colorPrefixes.forEach((prefix) => {
    // Regex to find arbitrary color values in classes: prefix-[#hex]
    // Example: bg-[#135bec] or text-[#fff]
    const regex = new RegExp(`\\b${prefix}-\\[(#[0-9a-f]{3,6})\\]`, "gi");
    resolvedHtml = resolvedHtml.replace(regex, (match, hex) => {
      const normalizedHex = hex.toLowerCase();
      const tokenName = colorMap[normalizedHex];
      if (tokenName) {
        return `${prefix}-${tokenName}`;
      }
      return match;
    });
  });

  // 3. Resolve arbitrary radius classes (e.g., rounded-[0.5rem] -> rounded-lg)
  const radiusMap: Record<string, string> = {};
  tokens.forEach((token) => {
    if (token.key.startsWith("radius.")) {
      const name = token.key.replace("radius.", "");
      radiusMap[token.value.toLowerCase()] = name === "default" ? "" : `-${name}`;
    }
  });

  if (Object.keys(radiusMap).length > 0) {
    const radiusRegex = /\brounded-\[([^\]]+)\]/gi;
    resolvedHtml = resolvedHtml.replace(radiusRegex, (match, value) => {
      const normalizedValue = value.toLowerCase().trim();
      const suffix = radiusMap[normalizedValue];
      if (suffix !== undefined) {
        return `rounded${suffix}`;
      }
      return match;
    });
  }

  return resolvedHtml;
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
  const extractedRadii = extractTailwindRadii(html);

  return {
    themeKey,
    tokenFirstMatchRatio,
    arbitraryValueCount,
    themeDebtSummary,
    hasDarkModeTrigger,
    extractedFonts,
    extractedColors,
    extractedRadii,
    utilityClassUsages: deduplicatedTokens
  };
}
