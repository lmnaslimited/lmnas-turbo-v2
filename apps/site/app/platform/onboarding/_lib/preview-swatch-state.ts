"use client";

export const STUDIO_PREVIEW_SWATCH_EVENT = "studio-theme-swatch-preview-updated";
const STUDIO_PREVIEW_SWATCH_STORAGE_KEY = "lmnas-studio-preview-swatch-theme-id";

declare global {
  interface Window {
    __lmnasPreviewSwatchThemeId__?: string | null;
  }
}

export function readPreviewSwatchThemeId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const memoryValue = window.__lmnasPreviewSwatchThemeId__;
  if (typeof memoryValue === "string" && memoryValue.trim().length > 0) {
    return memoryValue;
  }
  const persistedValue = window.sessionStorage.getItem(STUDIO_PREVIEW_SWATCH_STORAGE_KEY);
  const value = typeof persistedValue === "string" && persistedValue.trim().length > 0 ? persistedValue : null;
  window.__lmnasPreviewSwatchThemeId__ = value;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function setPreviewSwatchThemeId(themeId: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  window.__lmnasPreviewSwatchThemeId__ = themeId;
  if (themeId && themeId.trim().length > 0) {
    window.sessionStorage.setItem(STUDIO_PREVIEW_SWATCH_STORAGE_KEY, themeId);
  } else {
    window.sessionStorage.removeItem(STUDIO_PREVIEW_SWATCH_STORAGE_KEY);
  }
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
