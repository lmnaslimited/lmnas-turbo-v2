import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStore } from "../_lib/store";

vi.mock("../_lib/strapi", () => ({
  isStrapiConfigured: () => false,
  requestStrapi: vi.fn()
}));

import { GET, POST } from "./route";

function buildPostRequest(body: unknown): Request {
  return new Request("http://localhost/api/platform/studio/widgets", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("studio widgets route", () => {
  beforeEach(() => {
    resetStore();
  });

  it("rejects raw executable script uploads", async () => {
    const response = await POST(
      buildPostRequest({
        widget: {
          id: "widget-raw-script",
          key: "widget-raw-script",
          name: "Raw Script Widget",
          repoPath: "/components/widgets/calendar-widget.ts",
          placement: {
            mode: "reference"
          }
        },
        rawScript: "<script>alert('bad')</script>"
      })
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      ok: boolean;
      code: string;
    };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("widgets.raw_script_forbidden");
  });

  it("saves repo-path mapping metadata and blocks executable html in visual mocks", async () => {
    const saveResponse = await POST(
      buildPostRequest({
        widget: {
          id: "widget-repo-path",
          key: "widget-repo-path",
          name: "Repo Mapping Widget",
          repoPath: "/components/widgets/report-download-widget.ts",
          widgetType: "download_gate",
          surface: "inline",
          placement: {
            mode: "reference"
          },
          visualMockHtml: "<div><strong>Mock only</strong></div>"
        }
      })
    );

    expect(saveResponse.status).toBe(200);
    const savePayload = (await saveResponse.json()) as {
      ok: boolean;
      data: Array<{
        id: string;
        repoPath: string;
        visualMockHtml?: string;
      }>;
    };
    expect(savePayload.ok).toBe(true);
    expect(savePayload.data.some((widget) => widget.id === "widget-repo-path")).toBe(true);
    expect(savePayload.data.find((widget) => widget.id === "widget-repo-path")?.repoPath).toBe(
      "/components/widgets/report-download-widget.ts"
    );

    const rejectVisualMockResponse = await POST(
      buildPostRequest({
        widget: {
          id: "widget-invalid-mock",
          key: "widget-invalid-mock",
          name: "Invalid Mock Widget",
          repoPath: "/components/widgets/calendar-widget.ts",
          placement: {
            mode: "reference"
          },
          visualMockHtml: "<div>ok</div><script>console.log('bad')</script>"
        }
      })
    );

    expect(rejectVisualMockResponse.status).toBe(400);
    const rejectPayload = (await rejectVisualMockResponse.json()) as {
      ok: boolean;
      code: string;
    };
    expect(rejectPayload.ok).toBe(false);
    expect(rejectPayload.code).toBe("widgets.raw_script_forbidden");

    const getResponse = await GET();
    expect(getResponse.status).toBe(200);
    const getPayload = (await getResponse.json()) as {
      ok: boolean;
      data: Array<{ id: string }>;
      catalog: Array<{ repoPath: string }>;
    };
    expect(getPayload.ok).toBe(true);
    expect(getPayload.data.some((widget) => widget.id === "widget-repo-path")).toBe(true);
    expect(getPayload.catalog.some((entry) => entry.repoPath === "/components/widgets/calendar-widget.ts")).toBe(true);
  });
});
