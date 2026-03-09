import React from "react";
import { OnboardingConsole } from "./OnboardingConsole.client";

export default function PlatformOnboardingPage() {
  return (
    <div className="min-h-screen bg-lmnas-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5">
        <section className="rounded-2xl border border-lmnas-border bg-lmnas-panel p-6 shadow-lg shadow-black/10">
          <h1 className="text-2xl font-extrabold tracking-tight text-lmnas-text">
            LMNAs Visual Onboarding Studio
          </h1>
          <p className="mt-1 text-sm text-lmnas-muted">
            Import pages and sections visually into governed shells, blocks, widgets, actions, and exits. This is the
            default operator path.
          </p>
        </section>
        <OnboardingConsole />
      </div>
    </div>
  );
}
