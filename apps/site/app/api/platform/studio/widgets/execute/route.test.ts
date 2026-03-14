import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestStrapiMock, collectWidgetStrapiProbeSnapshotMock } = vi.hoisted(() => ({
  requestStrapiMock: vi.fn(),
  collectWidgetStrapiProbeSnapshotMock: vi.fn(async () => ({
    pages: 1,
    blocks: 1,
    shells: 1,
    source: "strapi" as const,
    warnings: []
  }))
}));

vi.mock("../../_lib/strapi", () => ({
  isStrapiConfigured: () => true,
  requestStrapi: requestStrapiMock,
  unwrapStrapiEntity: (value: unknown) => value
}));

vi.mock("../_lib/strapi-probe", () => ({
  collectWidgetStrapiProbeSnapshot: collectWidgetStrapiProbeSnapshotMock
}));

import { POST } from "./route";

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/platform/studio/widgets/execute", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("studio widgets execute route canonical mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes repo widgets from canonical studio-widgets records", async () => {
    requestStrapiMock.mockResolvedValueOnce({
      data: [
        {
          documentId: "widget-1",
          widgetKey: "widget-1",
          name: "Calendar Widget",
          widgetType: "booking_popup",
          surface: "modal",
          status: "active",
          lifecycle: "draft",
          readiness: "ready",
          repoPath: "/components/widgets/calendar-widget.ts",
          editableFields: [],
          placement: {
            mode: "reference"
          }
        }
      ]
    });

    const response = await POST(
      buildRequest({
        widgetId: "widget-1",
        event: "run"
      })
    );
    const payload = (await response.json()) as {
      ok: boolean;
      source: string;
      data: {
        widget: {
          id: string;
          repoPath: string;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("strapi");
    expect(payload.data.widget.id).toBe("widget-1");
    expect(payload.data.widget.repoPath).toBe("/components/widgets/calendar-widget.ts");
  });
});
