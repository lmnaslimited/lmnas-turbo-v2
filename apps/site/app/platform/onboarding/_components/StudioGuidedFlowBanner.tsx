"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type GuidedStep = {
  id: string;
  label: string;
  href: string;
  hint: string;
};

const GUIDED_STEPS: GuidedStep[] = [
  {
    id: "blocks",
    label: "1. Import & Blocks",
    href: "/platform/onboarding/blocks",
    hint: "Bring in source content and refine reusable sections."
  },
  {
    id: "pages",
    label: "2. Compose Pages",
    href: "/platform/onboarding/pages",
    hint: "Assemble page structure from approved blocks."
  },
  {
    id: "widgets",
    label: "3. Bind Widgets",
    href: "/platform/onboarding/widgets",
    hint: "Attach interactive behavior through repo-first widget mappings."
  },
  {
    id: "shells",
    label: "4. Apply Shell",
    href: "/platform/onboarding/shells",
    hint: "Select the global shell for navigation and footer framing."
  },
  {
    id: "theme",
    label: "5. Apply Theme",
    href: "/platform/onboarding/theme",
    hint: "Review active styling and preview temporary swatches."
  },
  {
    id: "publish",
    label: "6. Preview & Publish",
    href: "/platform/onboarding/publish",
    hint: "Run final review and publish the active experience."
  }
];

function resolveCurrentStep(pathname: string): number {
  return GUIDED_STEPS.findIndex((step) => pathname.startsWith(step.href));
}

export function StudioGuidedFlowBanner(): React.ReactElement | null {
  const pathname = usePathname();
  if (!pathname || pathname === "/platform/onboarding") {
    return null;
  }

  const stepIndex = resolveCurrentStep(pathname);
  if (stepIndex < 0) {
    return null;
  }

  const currentStep = GUIDED_STEPS[stepIndex];
  const previousStep = stepIndex > 0 ? GUIDED_STEPS[stepIndex - 1] : null;
  const nextStep = stepIndex < GUIDED_STEPS.length - 1 ? GUIDED_STEPS[stepIndex + 1] : null;

  return (
    <section className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-200">Studio Guided Path</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{currentStep.hint}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {GUIDED_STEPS.map((step, index) => {
            const isCurrent = index === stepIndex;
            return (
              <Link
                key={step.id}
                href={step.href}
                className={`rounded-lg border px-2.5 py-1 text-[11px] ${
                  isCurrent
                    ? "border-blue-500/35 bg-blue-500/[0.12] text-blue-200"
                    : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-slate-200"
                }`}
              >
                {step.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px]">
        {previousStep ? (
          <Link className="text-slate-400 hover:text-slate-200" href={previousStep.href}>
            ← {previousStep.label}
          </Link>
        ) : (
          <span className="text-slate-600">Start of guided path</span>
        )}

        {nextStep ? (
          <Link className="text-blue-300 hover:text-blue-200" href={nextStep.href}>
            {nextStep.label} →
          </Link>
        ) : (
          <span className="text-emerald-300">Final step</span>
        )}
      </div>
    </section>
  );
}
