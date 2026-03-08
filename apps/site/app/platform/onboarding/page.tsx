import React from "react";
import { OnboardingConsole } from "./OnboardingConsole.client";

export default function PlatformOnboardingPage() {
  return (
    <div className="lmnas-onboarding-shell">
      <section className="lmnas-onboarding-card">
        <h1>LMNAs Visual Onboarding Studio</h1>
        <p>
          Import pages and sections visually into governed shells, blocks, widgets, actions, and exits. This is the
          default operator path.
        </p>
      </section>
      <OnboardingConsole />
    </div>
  );
}
