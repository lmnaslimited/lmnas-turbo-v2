export type AnchorCandidate = {
  href: string;
  label: string;
  selectorHint: string;
};

export function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

export function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return undefined;
  }

  const value = stripTags(match[1]);
  return value.length > 0 ? value : undefined;
}

export function extractSections(html: string): string[] {
  const matches = Array.from(html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/gi)).map((match) => match[0]);
  if (matches.length > 0) {
    return matches;
  }

  const articleMatches = Array.from(html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)).map((match) => match[0]);
  if (articleMatches.length > 0) {
    return articleMatches;
  }

  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    return [bodyMatch[1]];
  }

  return [html];
}

export function extractAnchors(html: string): AnchorCandidate[] {
  const matches = Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));

  return matches
    .map((match, index) => {
      const href = match[1].trim();
      const label = stripTags(match[2]);
      if (!href || !label) {
        return undefined;
      }

      return {
        href,
        label,
        selectorHint: `a[href='${href}']:nth-of-type(${index + 1})`
      };
    })
    .filter((value): value is AnchorCandidate => Boolean(value));
}

export function includesAny(input: string, terms: string[]): boolean {
  const normalized = input.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}
