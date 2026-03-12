import React, { useMemo } from "react";
import { StudioActionMenu, StudioDetailContainer, StudioListContainer } from "../_components/workflow";
import type { StudioFidelitySettings, StudioTheme } from "../_lib/studio-types";

export type PublishOverlayWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export type PublishOverlayResult = {
  mode: "dry-run" | "apply";
  applied: boolean;
  blocked: boolean;
  blockedBy?: {
    fidelity: boolean;
    governance: boolean;
  };
  source: "fallback" | "strapi";
  fidelityMode: StudioFidelitySettings["mode"];
  warnings: PublishOverlayWarning[];
  activeTheme: {
    id: string;
    themeKey: string;
    name: string;
    darkMode: boolean;
    status: StudioTheme["status"];
  };
  ignoredPreviewSwatchThemeId: string | null;
  rejectionReason: string | null;
  fidelity: {
    threshold: number;
    hasDarkMediaQuery: boolean;
    darkModeMismatchRatio: number;
    typographyMismatchRatio: number;
    highestMismatchRatio: number;
    exceedsThreshold: boolean;
  };
  governance?: {
    ready: boolean;
    page: {
      id: string;
      name: string;
      slug: string;
    } | null;
    source: "fallback" | "strapi";
    checks: Array<{
      id: string;
      label: string;
      pass: boolean;
    }>;
  };
  payload: Record<string, unknown>;
  persistence?: {
    source: "fallback" | "strapi";
    mutated: boolean;
    themeId: string | null;
  };
};

type PublishOverlayItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
};

export type PublishOverlayWorkflowProps = {
  isPublishing: boolean;
  publishResult: PublishOverlayResult | null;
  onRunPublish: () => void;
  onClose: () => void;
};

export function PublishOverlayWorkflow(props: PublishOverlayWorkflowProps): React.ReactElement {
  const { isPublishing, publishResult, onRunPublish, onClose } = props;

  const summaryItems = useMemo<PublishOverlayItem[]>(
    () => [
      {
        id: "overlay-source",
        title: "Persistence Source",
        subtitle: publishResult?.source ?? "pending",
        meta: publishResult?.persistence?.mutated ? `mutated theme ${publishResult.persistence.themeId ?? "n/a"}` : "no mutation yet"
      },
      {
        id: "overlay-mode",
        title: "Fidelity Mode",
        subtitle: publishResult?.fidelityMode ?? "pending",
        meta: publishResult ? `threshold ${publishResult.fidelity.threshold.toFixed(2)}` : "awaiting publish run"
      },
      {
        id: "overlay-result",
        title: "Publish Result",
        subtitle: publishResult ? (publishResult.applied ? "APPLIED" : "NOT APPLIED") : "not executed",
        meta: publishResult ? `highest mismatch ${publishResult.fidelity.highestMismatchRatio.toFixed(3)}` : "n/a"
      },
      {
        id: "overlay-governance",
        title: "Governance Readiness",
        subtitle: publishResult ? (publishResult.governance?.ready ? "READY" : "INCOMPLETE") : "pending",
        meta: publishResult?.governance?.page ? publishResult.governance.page.slug : "no page selected"
      }
    ],
    [publishResult]
  );

  return (
    <div
      data-testid="publish-overlay"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#020617]/70 px-4 py-8"
    >
      <div className="w-full max-w-[1000px] rounded-xl border border-white/[0.1] bg-[#0b1120] p-4 shadow-2xl">
        <header className="mb-4 border-b border-white/[0.08] pb-3">
          <h2 className="text-sm font-semibold text-slate-100">Final Publish Review</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Commit pipeline serializes backend active theme only and evaluates fidelity before write.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <StudioListContainer
            testId="publish-overlay-list-container"
            title="Publish Summary"
            description="Review source, mode, and mutation state."
            items={summaryItems}
            selectedId="overlay-result"
            onSelectItem={() => undefined}
            getItemTitle={(item) => item.title}
            getItemSubtitle={(item) => item.subtitle}
            getItemMeta={(item) => item.meta}
          />

          <div className="flex flex-col gap-4">
            <StudioDetailContainer
              testId="publish-overlay-detail-container"
              title="Verification Output"
              description="Warning and rejection states remain bounded to this review pane."
              isEmpty={!publishResult}
              emptyTitle="No publish execution yet"
              emptyDescription="Run publish commit to evaluate fidelity and persistence."
            >
              {publishResult ? (
                <div className="space-y-3">
                  {publishResult.blocked ? (
                    <div
                      data-testid="publish-rejection-overlay"
                      className="rounded-lg border border-red-500/30 bg-red-500/[0.08] p-3"
                    >
                      <p className="text-sm font-semibold text-red-300">Publish Hard-Blocked</p>
                      <p className="mt-1 text-xs text-red-200">
                        {publishResult.rejectionReason ?? "Fidelity threshold rejection."}
                      </p>
                      {publishResult.blockedBy ? (
                        <p className="mt-1 text-[11px] text-red-300">
                          blocked by: {publishResult.blockedBy.fidelity ? "fidelity " : ""}
                          {publishResult.blockedBy.governance ? "governance" : ""}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {!publishResult.blocked &&
                  publishResult.warnings.some((warning) => warning.severity === "warning" || warning.severity === "error") ? (
                    <div
                      data-testid="publish-warning-overlay"
                      className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3"
                    >
                      <p className="text-sm font-semibold text-amber-200">Publish Warning Overlay</p>
                      <p className="mt-1 text-xs text-amber-300">
                        Fidelity mismatches were detected but commit is allowed under current threshold mode.
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="text-xs text-slate-300">
                      Result: <strong>{publishResult.applied ? "APPLIED" : "NOT APPLIED"}</strong>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Fidelity mode: {publishResult.fidelityMode} • Highest mismatch:{" "}
                      {publishResult.fidelity.highestMismatchRatio.toFixed(3)}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Governance: {publishResult.governance?.ready ? "ready" : "incomplete"} • Page:{" "}
                      {publishResult.governance?.page?.slug ?? "n/a"}
                    </p>
                  </div>

                  {publishResult.governance ? (
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                      <p className="text-xs font-semibold text-slate-300">Governance Checklist</p>
                      <div className="mt-2 grid gap-1.5 md:grid-cols-2">
                        {publishResult.governance.checks.map((check) => (
                          <div key={check.id} className="flex items-center gap-2 text-[11px] text-slate-300">
                            <span
                              className={`material-symbols-outlined text-[15px] ${
                                check.pass ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {check.pass ? "check_circle" : "cancel"}
                            </span>
                            <span>{check.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <pre
                    data-testid="publish-payload-json"
                    className="max-h-[280px] overflow-auto rounded-lg border border-white/[0.08] bg-[#020617] p-3 text-[11px] text-slate-300"
                  >
                    {JSON.stringify(publishResult, null, 2)}
                  </pre>
                </div>
              ) : null}
            </StudioDetailContainer>

            <StudioActionMenu
              testId="publish-overlay-action-container"
              title="Overlay Actions"
              description="Run commit or close the verification pane."
              items={[
                {
                  id: "publish-commit",
                  label: isPublishing ? "Publishing…" : "Run Publish Commit",
                  description: "Executes the final publish verification sequence.",
                  tone: "accent",
                  disabled: isPublishing,
                  onSelect: onRunPublish
                },
                {
                  id: "close-overlay",
                  label: "Close Overlay",
                  description: "Return to settings and source configuration.",
                  tone: "neutral",
                  onSelect: onClose
                }
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
