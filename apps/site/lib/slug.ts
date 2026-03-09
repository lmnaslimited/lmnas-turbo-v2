const localePrefixes = new Set(["en", "fr", "de", "es", "it", "nl", "pt"]);

export function resolveCmsSlug(parts: string[] | undefined): string {
  if (!parts || parts.length === 0) {
    return "home";
  }

  const normalized = parts
    .filter(Boolean)
    .map((part) => decodeURIComponent(part).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);

  if (normalized.length === 0) {
    return "home";
  }

  if (localePrefixes.has(normalized[0].toLowerCase())) {
    const localeScoped = normalized.slice(1).join("/");
    return localeScoped || "home";
  }

  const joined = normalized.join("/");

  return joined || "home";
}
