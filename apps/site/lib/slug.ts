export function resolveCmsSlug(parts: string[] | undefined): string {
  if (!parts || parts.length === 0) {
    return "home";
  }

  const joined = parts
    .filter(Boolean)
    .map((part) => decodeURIComponent(part).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");

  return joined || "home";
}
