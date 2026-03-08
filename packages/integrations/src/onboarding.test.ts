import { describe, expect, it } from "vitest";
import { analyzeOnboardingSource, ExitContractRegistry, publishOnboardingDraft } from "./onboarding";

const sampleHtml = `
<html>
  <body>
    <div class="announcement-bar">Limited offer this month</div>
    <nav>
      <a href="/products">Products</a>
      <a href="/about">About</a>
    </nav>
    <section class="hero">
      <h1>Reimagine your revenue workflow</h1>
      <p>Accelerate quotes and improve margin quality.</p>
      <a href="/book-appointment">Book Appointment</a>
    </section>
    <section class="faq accordion">
      <h2>FAQ</h2>
      <button>Send me the Full Report</button>
    </section>
    <footer>
      <a href="/privacy">Privacy</a>
    </footer>
  </body>
</html>
`;

describe("onboarding pipeline", () => {
  it("analyzes source and detects shell, block, widget, action, and exit proposals", async () => {
    const analysis = await analyzeOnboardingSource({
      sourceType: "raw_html",
      sourceValue: sampleHtml,
      slug: "home",
      locale: "en",
      themeKey: "default"
    });

    expect(analysis.shellCandidates.some((candidate) => candidate.type === "navbar")).toBe(true);
    expect(analysis.shellCandidates.some((candidate) => candidate.type === "footer")).toBe(true);
    expect(analysis.blockProposals.length).toBeGreaterThan(0);
    expect(analysis.widgetProposals.length).toBeGreaterThan(0);
    expect(analysis.actionProposals.length).toBeGreaterThan(0);
    expect(analysis.exitProposals.some((proposal) => proposal.id === "book_appointment_primary")).toBe(true);
    expect(analysis.source.previewHtml.length).toBeGreaterThan(0);
  });

  it("produces publish payload in dry-run mode", async () => {
    const analysis = await analyzeOnboardingSource({
      sourceType: "raw_html",
      sourceValue: sampleHtml,
      slug: "home",
      locale: "en",
      themeKey: "default"
    });

    const result = await publishOnboardingDraft({
      analysis,
      mode: "dry-run",
      overrides: {
        blockFamilyOverrides: {},
        exitStateOverrides: {},
        itemImportState: {},
        itemTypeOverrides: {},
        fieldOverrides: {},
        mapToExisting: {},
        segmentationOverrides: {},
        actionTypeOverrides: {},
        actionLabelOverrides: {},
        actionTargetOverrides: {}
      }
    });

    expect(result.mode).toBe("dry-run");
    expect(result.applied).toBe(false);
    expect(result.summary.blocksToCreate).toBeGreaterThan(0);
    expect(result.summary.widgetsToCreate).toBeGreaterThan(0);
    expect(result.summary.actionsToCreate).toBeGreaterThan(0);
    expect(result.summary.exitsRequired).toBeGreaterThan(0);
    expect(result.previewLinks.length).toBeGreaterThan(0);
    expect(result.strapiPayload.widgetDefinitions.length).toBeGreaterThan(0);
    expect(result.strapiPayload.actionBindings.length).toBeGreaterThan(0);
  });
});

describe("exit contract registry", () => {
  it("registers and toggles exit states", () => {
    const registry = new ExitContractRegistry();
    registry.register({
      id: "book_appointment_primary",
      name: "Book Appointment",
      state: "active",
      eventName: "exit_book_appointment_primary_triggered",
      payloadSchema: {
        format: "json-schema",
        schema: {}
      },
      frontendAdapterType: "redirect",
      backendAdapterType: "n8n_webhook",
      workflowTarget: {
        kind: "n8n_webhook",
        value: "n8n://workflow/book_appointment"
      },
      fallbackBehavior: "show_fallback_contact",
      successBehavior: "show_success_message",
      failureBehavior: "show_error_message",
      analyticsMapping: {
        click: "exit_book_appointment_primary_triggered"
      },
      policy: {
        environmentAllowlist: [],
        roleAllowlist: []
      }
    });

    expect(registry.resolve("book_appointment_primary")?.state).toBe("active");
    registry.setState("book_appointment_primary", "inactive");
    expect(registry.resolve("book_appointment_primary")?.state).toBe("inactive");
  });
});
