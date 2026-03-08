import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("exit execute route", () => {
  it("executes exit through adapter runtime", async () => {
    const response = await POST(
      new Request("http://localhost/api/platform/exits/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          definition: {
            id: "book_appointment_primary",
            name: "Book Appointment",
            state: "active",
            eventName: "exit_book_appointment_primary_triggered",
            payloadSchema: {
              format: "json-schema",
              schema: {}
            },
            frontendAdapterType: "redirect",
            backendAdapterType: "none",
            workflowTarget: {
              kind: "url",
              value: "/book"
            },
            fallbackBehavior: "fallback",
            successBehavior: "success",
            failureBehavior: "failure",
            analyticsMapping: {},
            policy: {
              environmentAllowlist: [],
              roleAllowlist: []
            }
          }
        })
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { ok: boolean; result: { status: string } };
    expect(payload.ok).toBe(true);
    expect(payload.result.status).toBe("success");
  });
});
