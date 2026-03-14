export const BLOCK_FALLBACK_FRAME_CLASS = "lmnas-block-fallback-frame";

export function withBlockStructuralFallback(snippetHtml: string | undefined): string {
  const safeSnippet = snippetHtml && snippetHtml.trim().length > 0 ? snippetHtml : "<section><p>No preview available</p></section>";
  return `<div class=\"${BLOCK_FALLBACK_FRAME_CLASS}\">${safeSnippet}</div>`;
}

export function injectProjectStyles(html: string, projectStyles: string): string {
  if (!projectStyles || !html) {
    return html;
  }

  const tailwindCdnPattern = new RegExp("<script[^>]*src=['\"][^'\"]*cdn\\.tailwindcss\\.com[^'\"]*['\"][^>]*>[\\s\\S]*?<\\/script>", "gi");
  const tailwindConfigPattern = new RegExp("<script[^>]*id=['\"]tailwind-config['\"][^>]*>[\\s\\S]*?<\\/script>", "gi");
  const cleaned = html
    .replace(tailwindCdnPattern, "")
    .replace(tailwindConfigPattern, "");
  const idx = cleaned.indexOf("</head>");
  if (idx >= 0) {
    return cleaned.slice(0, idx) + projectStyles + cleaned.slice(idx);
  }

  return `<html><head>${projectStyles}</head><body>${cleaned}</body></html>`;
}
