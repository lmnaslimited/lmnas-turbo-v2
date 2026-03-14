import React from "react";
import Link from "next/link";

const WORKFLOWS = [
  {
    title: "Import",
    description: "Import a Stitch/Figma/HTML source and stage governed reusable block candidates.",
    href: "/platform/onboarding/import",
    icon: "download",
    iconColor: "text-sky-400"
  },
  {
    title: "Theme & Shell",
    description: "Manage theme presets, shell presets, and token-first visual governance.",
    href: "/platform/onboarding/theme",
    icon: "palette",
    iconColor: "text-blue-400"
  },
  {
    title: "Blocks",
    description: "Import sections and components as reusable blocks into the studio.",
    href: "/platform/onboarding/blocks",
    icon: "dashboard_customize",
    iconColor: "text-violet-400"
  },
  {
    title: "Shells",
    description: "Manage navbar and footer variants. Configure CTAs and menu structure.",
    href: "/platform/onboarding/shells",
    icon: "web",
    iconColor: "text-emerald-400"
  },
  {
    title: "Publish",
    description: "Run final publish review with active-theme authorization and fidelity threshold guardrails.",
    href: "/platform/onboarding/publish",
    icon: "publish",
    iconColor: "text-rose-400"
  },
  {
    title: "Pages",
    description: "Assemble pages from blocks with the active shell. Edit content and actions.",
    href: "/platform/onboarding/pages",
    icon: "article",
    iconColor: "text-amber-400"
  },
  {
    title: "Widgets",
    description: "Map interactive logic via approved repo paths with non-executable visual mocks.",
    href: "/platform/onboarding/widgets",
    icon: "extension",
    iconColor: "text-cyan-400"
  }
] as const;

export default function OnboardingDashboard() {
  return (
    <div className="max-w-[900px] mx-auto flex flex-col gap-8 pt-4">
      <section>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">
          Theme &amp; Shell Studio
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Follow the governed pipeline: import, govern reusable assets, compose, validate, and publish.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {WORKFLOWS.map((wf) => (
          <Link
            key={wf.title}
            href={wf.href}
            className="group flex items-start gap-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] p-4.5 transition-all hover:bg-white/[0.04] hover:border-white/[0.12]"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.04]">
              <span className={`material-symbols-outlined text-xl ${wf.iconColor}`}>{wf.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                {wf.title}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{wf.description}</p>
            </div>
            <span className="material-symbols-outlined text-slate-600 group-hover:text-slate-400 transition-colors text-sm mt-1">
              arrow_forward
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
