export const ALLOWED_THEME_SOURCES = [
  "url",
  "html_upload",
  "figma_export",
  "stitch_export",
  "zip_upload",
  "local_repo_path"
] as const;

export type StudioThemeSourceType = (typeof ALLOWED_THEME_SOURCES)[number];

export function isStudioThemeSourceType(value: unknown): value is StudioThemeSourceType {
  return typeof value === "string" && ALLOWED_THEME_SOURCES.includes(value as StudioThemeSourceType);
}

export function normalizeThemeKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized.length > 0 ? normalized : `theme-${Date.now()}`;
}
