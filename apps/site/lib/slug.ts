const localePrefixes = new Set(["en", "fr", "de", "es", "it", "nl", "pt"]);

export function resolveCmsRoute(parts: string[] | undefined): { locale: string; slug: string } {
  if (!parts || parts.length === 0) {
    return {
      locale: "en",
      slug: "home"
    };
  }

  const normalized = parts
    .filter(Boolean)
    .map((part) => decodeURIComponent(part).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);

  if (normalized.length === 0) {
    return {
      locale: "en",
      slug: "home"
    };
  }

  if (localePrefixes.has(normalized[0].toLowerCase())) {
    const localeScoped = normalized.slice(1).join("/");
    return {
      locale: normalized[0].toLowerCase(),
      slug: localeScoped || "home"
    };
  }

  const joined = normalized.join("/");
  return {
    locale: "en",
    slug: joined || "home"
  };
}

export function resolveCmsSlug(parts: string[] | undefined): string {
  return resolveCmsRoute(parts).slug;
}
