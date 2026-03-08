import React from "react";
import { OnboardingConsole } from "./OnboardingConsole.client";

export default function PlatformOnboardingPage() {
  return (
    <div className="lmnas-onboarding-shell">
      <section className="lmnas-onboarding-card">
        <h1>LMNAs Onboarding Console</h1>
        <p>
          Import sources into governed shell systems, canonical blocks, and exit contracts. This is the default
          operator path; CLI remains for debug and CI only.
        </p>
      </section>
      <OnboardingConsole />
    </div>
  );
}
