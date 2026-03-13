"use client";

export const STUDIO_PREVIEW_SWATCH_EVENT = "studio-theme-swatch-preview-updated";

declare global {
  interface Window {
    __lmnasPreviewSwatchThemeId__?: string | null;
  }
}

export function readPreviewSwatchThemeId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.__lmnasPreviewSwatchThemeId__;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function setPreviewSwatchThemeId(themeId: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  window.__lmnasPreviewSwatchThemeId__ = themeId;
  window.dispatchEvent(
    new CustomEvent<{ swatchThemeId: string | null }>(STUDIO_PREVIEW_SWATCH_EVENT, {
      detail: {
        swatchThemeId: themeId
      }
    })
  );
}

export function subscribePreviewSwatchThemeId(handler: (themeId: string | null) => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = (event: Event): void => {
    const customEvent = event as CustomEvent<{ swatchThemeId: string | null }>;
    const nextThemeId =
      customEvent.detail && typeof customEvent.detail.swatchThemeId === "string" && customEvent.detail.swatchThemeId.trim().length > 0
        ? customEvent.detail.swatchThemeId
        : null;
    handler(nextThemeId);
  };

  window.addEventListener(STUDIO_PREVIEW_SWATCH_EVENT, listener);
  return () => {
    window.removeEventListener(STUDIO_PREVIEW_SWATCH_EVENT, listener);
  };
}
