import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudioStore, replaceStore, resetStore } from "../_lib/store";

vi.mock("../_lib/strapi", () => ({
  isStrapiConfigured: () => false,
  requestStrapi: vi.fn(),
  unwrapStrapiEntity: (value: unknown) => value
}));

import { POST } from "./route";

function buildRequest(payload: Record<string, unknown>): Request {
  return new Request("http://localhost/api/platform/studio/publish", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

const SOURCE_WITH_DARK_AND_FONT_MISMATCH = `
  <style>
    @media(dark) {
      body { background: #000; color: #fff; }
    }
    body { font-family: 'Comic Sans MS', cursive; }
  </style>
`;

describe("studio publish route", () => {
  beforeEach(() => {
    resetStore();
  });

  it("uses active theme payload and ignores swatch preview id", async () => {
    const response = await POST(
      buildRequest({
        mode: "apply",
        sourceHtml: SOURCE_WITH_DARK_AND_FONT_MISMATCH,
        previewSwatchThemeId: "theme-preview-only"
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: {
        applied: boolean;
        blocked: boolean;
        ignoredPreviewSwatchThemeId: string | null;
        activeTheme: { themeKey: string };
        payload: Record<string, unknown>;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.applied).toBe(true);
    expect(payload.data.blocked).toBe(false);
    expect(payload.data.ignoredPreviewSwatchThemeId).toBe("theme-preview-only");
    expect(payload.data.activeTheme.themeKey).toBe("default");
    expect(payload.data.payload).not.toHaveProperty("previewSwatchThemeId");
  });

  it("hard blocks publish in disallow mode when fidelity exceeds threshold", async () => {
    const store = getStudioStore();
    replaceStore({
      ...store,
      settings: {
        fidelity: {
          mode: "disallow-below-threshold",
          threshold: 0.2
        }
      }
    });

    const response = await POST(
      buildRequest({
        mode: "apply",
        sourceHtml: SOURCE_WITH_DARK_AND_FONT_MISMATCH
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: {
        applied: boolean;
        blocked: boolean;
        warnings: Array<{ code: string }>;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.applied).toBe(false);
    expect(payload.data.blocked).toBe(true);
    expect(payload.data.warnings.some((warning) => warning.code === "publish.fidelity_hard_block")).toBe(true);
  });
});
